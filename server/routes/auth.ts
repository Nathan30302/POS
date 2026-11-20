import { Router } from 'express'
import { z } from 'zod'
import { signToken, verifyPassword } from '../auth.js'
import { requireAuth, type AuthedRequest } from '../middleware.js'
import { effectivePermissions } from '../permissions.js'
import { prisma } from '../prisma.js'
import { rateLimit } from '../rateLimit.js'

export const authRouter = Router()

authRouter.post(
  '/login',
  rateLimit({
    windowMs: 60_000,
    max: 20,
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
        take: 1,
      },
    },
  })
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  const ok = await verifyPassword(body.data.password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
  const membership = user.memberships[0]
  if (!membership) {
    return res.status(403).json({ error: 'No active business membership' })
  }
  if (membership.business.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'Business account is suspended' })
  }

  const token = await signToken({
    sub: user.id,
    kind: 'business',
    email: user.email,
    fullName: user.fullName,
    role: membership.role,
    businessId: membership.businessId,
    businessName: membership.business.name,
    membershipId: membership.id,
  })

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      kind: 'business',
      role: membership.role,
      businessId: membership.businessId,
      businessName: membership.business.name,
      permissions: effectivePermissions(
        membership.role,
        membership.permissions,
      ),
    },
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
  return res.json({
    user: {
      id: membership.user.id,
      email: membership.user.email,
      fullName: membership.user.fullName,
      kind: 'business',
      role: membership.role,
      businessId: membership.businessId,
      businessName: membership.business.name,
      permissions: effectivePermissions(
        membership.role,
        membership.permissions,
      ),
    },
  })
})
