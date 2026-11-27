import { Router } from 'express'
import { z } from 'zod'
import { ensureMainBranch } from '../branchStock.js'
import {
  requireAuth,
  requireBusinessMember,
  requireManager,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'

export const branchesRouter = Router()
branchesRouter.use(requireAuth, requireBusinessMember)

branchesRouter.get('/', async (req: AuthedRequest, res) => {
  await ensureMainBranch(req.businessId!)

  const branches = await prisma.branch.findMany({
    where: { businessId: req.businessId! },
    orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
  })

  let membershipBranchId: string | null = null
  if (req.membershipId) {
    const m = await prisma.membership.findUnique({
      where: { id: req.membershipId },
      select: { branchId: true },
    })
    membershipBranchId = m?.branchId ?? null
  }

  const mainId =
    branches.find((b) => b.isMain)?.id || branches[0]?.id || null

  res.json({
    branches,
    activeBranchId: req.branchId || membershipBranchId || mainId,
    membershipBranchId,
  })
})

branchesRouter.post('/', requireManager, async (req: AuthedRequest, res) => {
  const body = z
    .object({
      name: z.string().min(2).max(80),
      code: z.string().max(20).optional(),
      address: z.string().max(200).optional(),
      phone: z.string().max(40).optional(),
    })
    .safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'Invalid branch' })

  const { assertWithinEntitlement } = await import('../subscription.js')
  const cap = await assertWithinEntitlement(req.businessId!, 'branches')
  if (!cap.ok) return res.status(403).json({ error: cap.error })

  const branch = await prisma.branch.create({
    data: {
      businessId: req.businessId!,
      name: body.data.name.trim(),
      code: body.data.code?.trim() || null,
      address: body.data.address?.trim() || null,
      phone: body.data.phone?.trim() || null,
      isMain: false,
    },
  })

  await writeAudit('branch.create', {
    businessId: req.businessId!,
    userId: req.auth!.sub,
    entity: 'Branch',
    entityId: branch.id,
    after: { name: branch.name },
  })

  res.status(201).json({ branch })
})

branchesRouter.patch('/:id', requireManager, async (req: AuthedRequest, res) => {
  const body = z
    .object({
      name: z.string().min(2).max(80).optional(),
      code: z.string().max(20).nullable().optional(),
      address: z.string().max(200).nullable().optional(),
      phone: z.string().max(40).nullable().optional(),
    })
    .safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'Invalid branch' })

  const existing = await prisma.branch.findFirst({
    where: { id: req.params.id, businessId: req.businessId! },
  })
  if (!existing) return res.status(404).json({ error: 'Branch not found' })

  const branch = await prisma.branch.update({
    where: { id: existing.id },
    data: {
      name: body.data.name?.trim() ?? existing.name,
      code:
        body.data.code === undefined
          ? existing.code
          : body.data.code?.trim() || null,
      address:
        body.data.address === undefined
          ? existing.address
          : body.data.address?.trim() || null,
      phone:
        body.data.phone === undefined
          ? existing.phone
          : body.data.phone?.trim() || null,
    },
  })

  await writeAudit('branch.update', {
    businessId: req.businessId!,
    userId: req.auth!.sub,
    entity: 'Branch',
    entityId: branch.id,
    before: { name: existing.name, code: existing.code },
    after: { name: branch.name, code: branch.code },
  })

  res.json({ branch })
})

/** Persist preferred branch on the caller's membership (session switch). */
branchesRouter.post('/active', async (req: AuthedRequest, res) => {
  const body = z
    .object({
      branchId: z.string().min(1).nullable(),
    })
    .safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'Invalid branch' })

  if (!req.membershipId) {
    return res.status(400).json({ error: 'No membership to update' })
  }

  let branchId: string | null = body.data.branchId
  if (branchId === '__all__') {
    branchId = null
  } else if (branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, businessId: req.businessId! },
    })
    if (!branch) return res.status(404).json({ error: 'Branch not found' })
    branchId = branch.id
  }

  await prisma.membership.update({
    where: { id: req.membershipId },
    data: { branchId },
  })

  res.json({ activeBranchId: branchId })
})
