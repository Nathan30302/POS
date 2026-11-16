import { Router } from 'express'
import { z } from 'zod'
import { hashPassword } from '../auth.js'
import { DEFAULT_MODULES } from '../constants.js'
import {
  audit,
  requireAuth,
  requirePlatformAdmin,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'

export { DEFAULT_MODULES }

export const platformRouter = Router()
platformRouter.use(requireAuth, requirePlatformAdmin)


platformRouter.get('/stats', async (_req, res) => {
  const [businesses, active, users, salesCount] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count(),
    prisma.sale.count({ where: { status: 'COMPLETED' } }),
  ])
  res.json({ stats: { businesses, active, users, salesCount } })
})

platformRouter.get('/businesses', async (_req, res) => {
  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { products: true, sales: true, memberships: true } },
    },
  })
  res.json({ businesses })
})

platformRouter.post('/businesses', async (req: AuthedRequest, res) => {
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
    })
    .safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'Invalid business' })

  const slugBase = body.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const slug = `${slugBase}-${Date.now().toString(36)}`

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
          status: 'ACTIVE',
          modulesJson: JSON.stringify(DEFAULT_MODULES),
          settingsJson: JSON.stringify({
            paymentMethods: ['CASH', 'MTN_MOMO', 'AIRTEL_MONEY', 'CARD'],
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
      userId: req.auth!.sub,
      entity: 'Business',
      entityId: result.business.id,
    })

    res.status(201).json(result)
  } catch {
    res.status(400).json({ error: 'Could not create business (email in use?)' })
  }
})

platformRouter.patch('/businesses/:id/status', async (req: AuthedRequest, res) => {
  const status = z
    .enum(['ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED'])
    .safeParse(req.body.status)
  if (!status.success) return res.status(400).json({ error: 'Invalid status' })
  const business = await prisma.business.update({
    where: { id: req.params.id },
    data: { status: status.data },
  })
  await audit('platform.update_business_status', {
    businessId: business.id,
    userId: req.auth!.sub,
    meta: { status: status.data },
  })
  res.json({ business })
})
