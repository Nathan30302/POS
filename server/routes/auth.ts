import { Router } from 'express'
import { z } from 'zod'
import { hashPassword, signToken, verifyPassword } from '../auth.js'
import {
  clearSessionCookie,
  setSessionCookie,
} from '../sessionCookie.js'
import {
  modulesForIndustry,
  settingsForIndustry,
} from '../industries.js'
import { requireAuth, type AuthedRequest } from '../middleware.js'
import { businessSessionUser } from '../sessionUser.js'
import { isPlanId } from '../plans.js'
import { prisma } from '../prisma.js'
import { rateLimit } from '../rateLimit.js'
import { recordSubscriptionEvent } from '../subscription.js'

export const authRouter = Router()

/** Public shop signup — creates business + owner on a trial plan. */
authRouter.post(
  '/register',
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 8,
    key: (req) => String(req.body?.ownerEmail || req.ip || 'register').toLowerCase(),
  }),
  async (req, res) => {
    const body = z
      .object({
        businessName: z.string().min(2).max(120),
        industry: z.string().default('retail'),
        currency: z.string().default('ZMW'),
        phone: z.string().max(40).optional(),
        address: z.string().max(200).optional(),
        ownerName: z.string().min(2).max(80),
        ownerEmail: z.string().email(),
        ownerPassword: z.string().min(8).max(100),
      })
      .safeParse(req.body)
    if (!body.success) {
      return res.status(400).json({
        error:
          'Need shop name, owner name, email, and password (8+ characters)',
      })
    }

    const email = body.data.ownerEmail.toLowerCase()
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      const membership = await prisma.membership.findFirst({
        where: { userId: existingUser.id, active: true },
      })
      if (membership) {
        return res.status(409).json({
          error: 'That email already has a shop — sign in instead',
        })
      }
    }
    const platformHit = await prisma.platformUser.findUnique({
      where: { email },
    })
    if (platformHit) {
      return res.status(409).json({
        error: 'That email is reserved — use a different owner email',
      })
    }

    const slugBase = body.data.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
    const slug = `${slugBase || 'shop'}-${Date.now().toString(36)}`
    const plan = isPlanId('starter') ? 'starter' : 'starter'

    try {
      const result = await prisma.$transaction(async (tx) => {
        const business = await tx.business.create({
          data: {
            name: body.data.businessName.trim(),
            slug,
            industry: body.data.industry,
            currency: body.data.currency || 'ZMW',
            phone: body.data.phone?.trim() || null,
            address: body.data.address?.trim() || null,
            // Platform admin must Approve before the owner can sign in
            status: 'PENDING_APPROVAL',
            plan,
            trialEndsAt: null,
            billingProvider: 'manual',
            modulesJson: JSON.stringify(
              modulesForIndustry(body.data.industry),
            ),
            settingsJson: JSON.stringify({
              paymentMethods: ['CASH', 'MTN_MOMO', 'AIRTEL_MONEY', 'CARD'],
              signupRequestedAt: new Date().toISOString(),
              ...settingsForIndustry(body.data.industry),
            }),
          },
        })
        const branch = await tx.branch.create({
          data: {
            businessId: business.id,
            name: 'Main Branch',
            isMain: true,
          },
        })
        const passwordHash = await hashPassword(body.data.ownerPassword)
        const owner = existingUser
          ? await tx.user.update({
              where: { id: existingUser.id },
              data: {
                fullName: body.data.ownerName.trim(),
                passwordHash,
                active: true,
              },
            })
          : await tx.user.create({
              data: {
                email,
                fullName: body.data.ownerName.trim(),
                passwordHash,
              },
            })
        const membership = await tx.membership.create({
          data: {
            businessId: business.id,
            userId: owner.id,
            branchId: branch.id,
            role: 'OWNER',
          },
        })
        return { business, owner, membership }
      })

      await recordSubscriptionEvent({
        businessId: result.business.id,
        kind: 'signup.pending',
        plan,
        note: 'Self-serve signup — awaiting platform approval',
        actorUserId: result.owner.id,
      })

      // No token — owner cannot enter until platform Approves
      return res.status(201).json({
        pendingApproval: true,
        businessName: result.business.name,
        message: `“${result.business.name}” was submitted. A NEXORA admin must approve it before you can sign in.`,
      })
    } catch (err) {
      console.error('[auth.register]', err)
      return res.status(400).json({
        error: 'Could not create shop — try a different name or email',
      })
    }
  },
)

authRouter.post(
  '/login',
  rateLimit({
    // Several phones can share one demo login while testing
    windowMs: 60_000,
    max: 60,
    key: (req) => String(req.body?.email || req.ip || 'login').toLowerCase(),
  }),
  async (req, res) => {
  const body = z
    .object({ email: z.string().email(), password: z.string().min(1) })
    .safeParse(req.body)
  if (!body.success) {
    return res.status(400).json({ error: 'Valid email and password required' })
  }

  const email = body.data.email.toLowerCase()
  const platform = await prisma.platformUser.findUnique({ where: { email } })
  if (platform) {
    const ok = await verifyPassword(body.data.password, platform.passwordHash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
    const token = await signToken({
      sub: platform.id,
      kind: 'platform',
      email: platform.email,
      fullName: platform.fullName,
      role: platform.role,
    })
    setSessionCookie(res, token)
    return res.json({
      token,
      user: {
        id: platform.id,
        email: platform.email,
        fullName: platform.fullName,
        kind: 'platform',
        role: platform.role,
      },
    })
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { active: true },
        include: { business: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  const ok = await verifyPassword(body.data.password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
  if (!user.memberships.length) {
    return res.status(403).json({ error: 'No active business membership' })
  }
  const { refreshSubscriptionState, accessFromBusiness, snapshotSubscription } =
    await import('../subscription.js')

  // Prefer first membership that is not access-blocked (cheap status skip first)
  let membership = user.memberships[0]
  let liveBiz = membership.business
  let gate = accessFromBusiness(liveBiz)
  for (const m of user.memberships) {
    const st = m.business.status
    if (
      st === 'PENDING_APPROVAL' ||
      st === 'SUSPENDED' ||
      st === 'CANCELLED'
    ) {
      continue
    }
    const biz = await refreshSubscriptionState(m.businessId)
    const g = accessFromBusiness(biz)
    if (g.access !== 'blocked') {
      membership = m
      liveBiz = biz
      gate = g
      break
    }
  }
  if (gate.access === 'blocked') {
    // Refresh the chosen blocked shop so trial→suspend transitions stay accurate
    liveBiz = await refreshSubscriptionState(membership.businessId)
    gate = accessFromBusiness(liveBiz)
    return res.status(403).json({
      error: gate.accessMessage,
      code:
        liveBiz.status === 'PENDING_APPROVAL'
          ? 'PENDING_APPROVAL'
          : liveBiz.status,
    })
  }

  const token = await signToken({
    sub: user.id,
    kind: 'business',
    email: user.email,
    fullName: user.fullName,
    role: membership.role,
    businessId: membership.businessId,
    businessName: liveBiz.name,
    membershipId: membership.id,
  })

  const shops = user.memberships.map((m) => ({
    businessId: m.businessId,
    businessName: m.business.name,
    role: m.role,
    membershipId: m.id,
  }))

  setSessionCookie(res, token)
  return res.json({
    token,
    user: businessSessionUser(user, membership, liveBiz),
    subscription: snapshotSubscription(liveBiz),
    shops,
  })
})

/** Clear httpOnly session cookie (Bearer clients just discard their token). */
authRouter.post('/logout', (req, res) => {
  clearSessionCookie(res)
  res.json({ ok: true })
})

/** List shops the signed-in user can open. */
authRouter.get('/memberships', requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.kind !== 'business') {
    return res.status(403).json({ error: 'Business user only' })
  }
  const rows = await prisma.membership.findMany({
    where: { userId: req.auth!.sub, active: true },
    include: { business: true },
    orderBy: { createdAt: 'asc' },
  })
  res.json({
    shops: rows.map((m) => ({
      businessId: m.businessId,
      businessName: m.business.name,
      role: m.role,
      membershipId: m.id,
      status: m.business.status,
      industry: m.business.industry,
    })),
    currentBusinessId: req.auth!.businessId,
  })
})

/** Re-issue session JWT for another shop the user belongs to. */
authRouter.post('/switch-business', requireAuth, async (req: AuthedRequest, res) => {
  if (req.auth!.kind !== 'business') {
    return res.status(403).json({ error: 'Business user only' })
  }
  const businessId = String(req.body?.businessId || '').trim()
  if (!businessId) {
    return res.status(400).json({ error: 'businessId required' })
  }
  const membership = await prisma.membership.findFirst({
    where: {
      userId: req.auth!.sub,
      businessId,
      active: true,
    },
    include: { business: true, user: true },
  })
  if (!membership || !membership.user.active) {
    return res.status(403).json({ error: 'No access to that shop' })
  }
  const { refreshSubscriptionState, accessFromBusiness, snapshotSubscription } =
    await import('../subscription.js')
  const liveBiz = await refreshSubscriptionState(membership.businessId)
  const gate = accessFromBusiness(liveBiz)
  if (gate.access === 'blocked') {
    return res.status(403).json({ error: gate.accessMessage })
  }
  const token = await signToken({
    sub: membership.user.id,
    kind: 'business',
    email: membership.user.email,
    fullName: membership.user.fullName,
    role: membership.role,
    businessId: membership.businessId,
    businessName: liveBiz.name,
    membershipId: membership.id,
  })
  setSessionCookie(res, token)
  res.json({
    token,
    user: businessSessionUser(membership.user, membership, liveBiz),
    subscription: snapshotSubscription(liveBiz),
  })
})

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res) => {
  const auth = req.auth!
  if (auth.kind === 'platform') {
    const platform = await prisma.platformUser.findUnique({
      where: { id: auth.sub },
    })
    if (!platform) return res.status(401).json({ error: 'User not found' })
    return res.json({
      user: {
        id: platform.id,
        email: platform.email,
        fullName: platform.fullName,
        kind: 'platform',
        role: platform.role,
      },
    })
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: auth.sub, businessId: auth.businessId, active: true },
    include: { business: true, user: true },
  })
  if (!membership) return res.status(401).json({ error: 'Membership not found' })
  if (!membership.user.active) {
    return res.status(401).json({ error: 'Account deactivated' })
  }
  return res.json({
    user: businessSessionUser(
      membership.user,
      membership,
      membership.business,
    ),
  })
})
