import { Router } from 'express'
import { z } from 'zod'
import { hashPassword } from '../auth.js'
import {
  modulesForIndustry,
  parseModulesJson,
  settingsForIndustry,
  type BusinessModules,
} from '../industries.js'
import {
  audit,
  requireAuth,
  requirePlatformAdmin,
  requirePlatformSuperAdmin,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'
import {
  defaultTrialEndsAt,
  recordSubscriptionEvent,
  snapshotSubscription,
} from '../subscription.js'
import { isPlanId } from '../plans.js'

const MODULE_KEYS = [
  'sell',
  'inventory',
  'finance',
  'employees',
  'crm',
  'procurement',
  'intelligence',
  'pharmacy',
  'perishables',
  'labels',
  'transfers',
] as const satisfies ReadonlyArray<keyof BusinessModules>

async function serializePlatformBusiness(id: string) {
  const business = await prisma.business.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          products: true,
          sales: true,
          memberships: true,
          branches: true,
        },
      },
      memberships: {
        where: { role: 'OWNER', active: true },
        take: 1,
        include: {
          user: { select: { fullName: true, email: true } },
        },
      },
      sales: {
        where: { status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
    },
  })
  if (!business) return null

  const { memberships, sales, ...rest } = business
  const owner = memberships[0]?.user ?? null
  const subscription = snapshotSubscription(business)
  const modules = parseModulesJson(business.modulesJson, business.industry)
  const branchCount = business._count.branches
  const userCount = business._count.memberships
  const canAddBranch = branchCount < subscription.entitlements.maxBranches
  const canAddUser = userCount < subscription.entitlements.maxUsers

  return {
    ...rest,
    owner,
    modules,
    subscription,
    branchCount,
    userCount,
    canAddBranch,
    canAddUser,
    lastSaleAt: sales[0]?.createdAt?.toISOString() ?? null,
    fullAccess: subscription.fullAccess,
  }
}

export const platformRouter = Router()
platformRouter.use(requireAuth, requirePlatformAdmin)


platformRouter.get('/stats', async (_req, res) => {
  const [
    businesses,
    active,
    trial,
    pending,
    suspended,
    users,
    salesCount,
  ] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: { status: 'ACTIVE' } }),
    prisma.business.count({ where: { status: 'TRIAL' } }),
    prisma.business.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.business.count({ where: { status: 'SUSPENDED' } }),
    prisma.user.count(),
    prisma.sale.count({ where: { status: 'COMPLETED' } }),
  ])
  res.json({
    stats: {
      businesses,
      active,
      trial,
      pending,
      suspended,
      users,
      salesCount,
    },
  })
})

platformRouter.get('/businesses', async (req, res) => {
  // Paginated lean directory — required for 1000+ tenants (never load the world)
  const pageRaw = Number(req.query.page ?? 1)
  const sizeRaw = Number(req.query.pageSize ?? 50)
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1
  const pageSize = Math.min(
    100,
    Math.max(1, Number.isFinite(sizeRaw) ? Math.floor(sizeRaw) : 50),
  )
  const q = String(req.query.q ?? '')
    .trim()
    .slice(0, 120)
  const statusRaw = String(req.query.status ?? '')
    .trim()
    .toUpperCase()
  const planRaw = String(req.query.plan ?? '')
    .trim()
    .toLowerCase()

  const statusFilter =
    statusRaw &&
    statusRaw !== 'ALL' &&
    ['ACTIVE', 'TRIAL', 'PENDING_APPROVAL', 'SUSPENDED', 'CANCELLED'].includes(
      statusRaw,
    )
      ? (statusRaw as
          | 'ACTIVE'
          | 'TRIAL'
          | 'PENDING_APPROVAL'
          | 'SUSPENDED'
          | 'CANCELLED')
      : undefined
  const planFilter =
    planRaw && planRaw !== 'all' && isPlanId(planRaw) ? planRaw : undefined

  const where: import('@prisma/client').Prisma.BusinessWhereInput = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(planFilter ? { plan: planFilter } : {}),
    ...(q
      ? {
          OR: [
            { id: { equals: q } },
            { id: { startsWith: q } },
            { name: { contains: q } },
            { slug: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            {
              memberships: {
                some: {
                  role: 'OWNER',
                  active: true,
                  user: {
                    OR: [
                      { email: { contains: q } },
                      { fullName: { contains: q } },
                    ],
                  },
                },
              },
            },
          ],
        }
      : {}),
  }

  const [total, rows] = await Promise.all([
    prisma.business.count({ where }),
    prisma.business.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        industry: true,
        status: true,
        currency: true,
        plan: true,
        phone: true,
        address: true,
        email: true,
        createdAt: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
        graceEndsAt: true,
        billingProvider: true,
        lastPaymentAt: true,
        lastPaymentRef: true,
        // settingsJson needed for entitlement overrides in snapshot
        settingsJson: true,
        _count: {
          select: {
            products: true,
            sales: true,
            memberships: true,
            branches: true,
          },
        },
        memberships: {
          where: { role: 'OWNER', active: true },
          take: 1,
          select: {
            user: { select: { fullName: true, email: true } },
          },
        },
      },
    }),
  ])

  // One batched lookup for last sale — avoids per-row nested sales (N+1-ish)
  const ids = rows.map((r) => r.id)
  const lastSaleByBiz = new Map<string, Date>()
  if (ids.length) {
    const recent = await prisma.sale.findMany({
      where: { businessId: { in: ids }, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { businessId: true, createdAt: true },
      take: Math.min(ids.length * 3, 300),
    })
    for (const sale of recent) {
      if (!lastSaleByBiz.has(sale.businessId)) {
        lastSaleByBiz.set(sale.businessId, sale.createdAt)
      }
    }
  }

  const businesses = rows.map((business) => {
    const { memberships, settingsJson: _settingsJson, ...rest } = business
    const subscription = snapshotSubscription(
      business as unknown as import('@prisma/client').Business,
    )
    const branchCount = business._count.branches
    const userCount = business._count.memberships
    const last = lastSaleByBiz.get(business.id)
    return {
      ...rest,
      owner: memberships[0]?.user ?? null,
      // List skips modules payload — open Details for full entitlements/modules
      modules: {} as Record<string, boolean>,
      subscription,
      branchCount,
      userCount,
      canAddBranch: branchCount < subscription.entitlements.maxBranches,
      canAddUser: userCount < subscription.entitlements.maxUsers,
      lastSaleAt: last?.toISOString() ?? null,
      fullAccess: subscription.fullAccess,
    }
  })

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  res.json({
    businesses,
    total,
    page,
    pageSize,
    totalPages,
  })
})

platformRouter.get('/businesses/:id', async (req, res) => {
  const business = await serializePlatformBusiness(req.params.id)
  if (!business) return res.status(404).json({ error: 'Business not found' })
  const events = await prisma.subscriptionEvent.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: 'desc' },
    take: 25,
  })
  res.json({ business, events })
})

platformRouter.patch(
  '/businesses/:id',
  requirePlatformSuperAdmin,
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        name: z.string().min(2).optional(),
        industry: z.string().optional(),
        phone: z.string().nullable().optional(),
        address: z.string().nullable().optional(),
        email: z.string().email().nullable().optional(),
        modules: z
          .record(z.enum(MODULE_KEYS), z.boolean())
          .optional(),
      })
      .safeParse(req.body)
    if (!body.success) return res.status(400).json({ error: 'Invalid payload' })

    const existing = await prisma.business.findUnique({
      where: { id: req.params.id },
    })
    if (!existing) return res.status(404).json({ error: 'Business not found' })

    let modulesJson: string | undefined
    if (body.data.modules) {
      const current = parseModulesJson(existing.modulesJson, existing.industry)
      modulesJson = JSON.stringify({ ...current, ...body.data.modules })
    } else if (body.data.industry && body.data.industry !== existing.industry) {
      modulesJson = JSON.stringify(modulesForIndustry(body.data.industry))
    }

    await prisma.business.update({
      where: { id: existing.id },
      data: {
        name: body.data.name,
        industry: body.data.industry,
        phone: body.data.phone === undefined ? undefined : body.data.phone,
        address:
          body.data.address === undefined ? undefined : body.data.address,
        email: body.data.email === undefined ? undefined : body.data.email,
        ...(modulesJson !== undefined ? { modulesJson } : {}),
      },
    })

    await audit('platform.update_business', {
      businessId: existing.id,
      meta: {
        platformUserId: req.auth!.sub,
        fields: Object.keys(body.data),
      },
    })

    const business = await serializePlatformBusiness(existing.id)
    res.json({ business })
  },
)

platformRouter.post(
  '/businesses',
  requirePlatformSuperAdmin,
  async (req: AuthedRequest, res) => {

  const body = z
    .object({
      name: z.string().min(2),
      industry: z.string().default('retail'),
      currency: z.string().default('ZMW'),
      ownerName: z.string().min(2),
      ownerEmail: z.string().email(),
      ownerPassword: z.string().min(8),
      phone: z.string().optional(),
      address: z.string().optional(),
      plan: z.string().optional(),
      startTrial: z.boolean().optional(),
    })
    .safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'Invalid business' })

  const slugBase = body.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const slug = `${slugBase}-${Date.now().toString(36)}`
  const plan =
    body.data.plan && isPlanId(body.data.plan) ? body.data.plan : 'starter'
  const startTrial = body.data.startTrial !== false
  const trialEndsAt = startTrial ? defaultTrialEndsAt() : null

  try {
    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: body.data.name,
          slug,
          industry: body.data.industry,
          currency: body.data.currency,
          phone: body.data.phone,
          address: body.data.address,
          status: startTrial ? 'TRIAL' : 'ACTIVE',
          plan,
          trialEndsAt,
          billingProvider: 'manual',
          modulesJson: JSON.stringify(
            modulesForIndustry(body.data.industry),
          ),
          settingsJson: JSON.stringify({
            paymentMethods: ['CASH', 'MTN_MOMO', 'AIRTEL_MONEY', 'CARD'],
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
      const owner = await tx.user.upsert({
        where: { email: body.data.ownerEmail.toLowerCase() },
        update: { fullName: body.data.ownerName, passwordHash },
        create: {
          email: body.data.ownerEmail.toLowerCase(),
          fullName: body.data.ownerName,
          passwordHash,
        },
      })
      await tx.membership.create({
        data: {
          businessId: business.id,
          userId: owner.id,
          branchId: branch.id,
          role: 'OWNER',
        },
      })
      return { business, owner, branch }
    })

    await audit('platform.create_business', {
      businessId: result.business.id,
      entity: 'Business',
      entityId: result.business.id,
      meta: { platformUserId: req.auth!.sub },
    })
    await recordSubscriptionEvent({
      businessId: result.business.id,
      kind: startTrial ? 'trial.start' : 'subscription.activate',
      plan,
      note: startTrial
        ? `Trial until ${trialEndsAt?.toISOString()}`
        : 'Activated without trial',
    })

    res.status(201).json(result)
  } catch {
    res.status(400).json({ error: 'Could not create business (email in use?)' })
  }
})

platformRouter.patch(
  '/businesses/:id/status',
  requirePlatformSuperAdmin,
  async (req: AuthedRequest, res) => {

  const status = z
    .enum(['ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED', 'PENDING_APPROVAL'])
    .safeParse(req.body.status)
  if (!status.success) return res.status(400).json({ error: 'Invalid status' })

  const existing = await prisma.business.findUnique({
    where: { id: req.params.id },
  })
  if (!existing) return res.status(404).json({ error: 'Business not found' })

  const data: {
    status: typeof status.data
    trialEndsAt?: Date | null
  } = { status: status.data }

  // Approving a pending shop opens their trial clock
  if (
    existing.status === 'PENDING_APPROVAL' &&
    (status.data === 'TRIAL' || status.data === 'ACTIVE')
  ) {
    if (status.data === 'TRIAL') {
      data.trialEndsAt = defaultTrialEndsAt()
    }
  }

  const business = await prisma.business.update({
    where: { id: existing.id },
    data,
  })

  if (
    existing.status === 'PENDING_APPROVAL' &&
    (status.data === 'TRIAL' || status.data === 'ACTIVE')
  ) {
    const { ensureMainBranch } = await import('../branchStock.js')
    await ensureMainBranch(business.id)
    await recordSubscriptionEvent({
      businessId: business.id,
      kind: 'signup.approved',
      plan: business.plan,
      note: `Approved by platform → ${status.data} (admin ${req.auth!.sub})`,
    })
  }

  // Platform admins are not User rows — put actor in meta to avoid FK on AuditLog.userId
  await audit('platform.update_business_status', {
    businessId: business.id,
    meta: {
      status: status.data,
      from: existing.status,
      platformUserId: req.auth!.sub,
    },
  })
  res.json({ business })
})
