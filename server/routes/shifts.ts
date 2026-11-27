import { Router } from 'express'
import { z } from 'zod'
import { createOwnerAlert } from '../alerts.js'
import {
  requireAuth,
  requireBusinessMember,
  requireManager,
  requirePermission,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'

export const shiftsRouter = Router()
shiftsRouter.use(requireAuth, requireBusinessMember)

function mapShift(s: {
  id: string
  businessId: string
  branchId: string | null
  status: string
  openingFloat: number
  cashSalesTotal: number
  expectedCash: number | null
  declaredCash: number | null
  discrepancy: number | null
  discrepancyReason: string | null
  notes: string | null
  openedAt: Date
  closedAt: Date | null
  openedBy?: { id: string; fullName: string } | null
  closedBy?: { id: string; fullName: string } | null
  branch?: { id: string; name: string } | null
}) {
  return {
    id: s.id,
    businessId: s.businessId,
    branchId: s.branchId,
    status: s.status,
    openingFloat: s.openingFloat,
    cashSalesTotal: s.cashSalesTotal,
    expectedCash: s.expectedCash,
    declaredCash: s.declaredCash,
    discrepancy: s.discrepancy,
    discrepancyReason: s.discrepancyReason,
    notes: s.notes,
    openedAt: s.openedAt,
    closedAt: s.closedAt,
    openedBy: s.openedBy || null,
    closedBy: s.closedBy || null,
    branch: s.branch || null,
  }
}

const shiftInclude = {
  openedBy: { select: { id: true, fullName: true } },
  closedBy: { select: { id: true, fullName: true } },
  branch: { select: { id: true, name: true } },
} as const

/** Current open shift for this cashier (optionally branch-scoped). */
shiftsRouter.get('/current', requirePermission('sell'), async (req: AuthedRequest, res) => {
  const shift = await prisma.cashShift.findFirst({
    where: {
      businessId: req.businessId!,
      openedById: req.auth!.sub,
      status: 'OPEN',
      ...(req.branchId ? { branchId: req.branchId } : {}),
    },
    include: shiftInclude,
    orderBy: { openedAt: 'desc' },
  })
  res.json({ shift: shift ? mapShift(shift) : null })
})

/** Manager: list recent shifts. */
shiftsRouter.get('/', requireManager, async (req: AuthedRequest, res) => {
  const take = Math.min(Number(req.query.limit) || 40, 100)
  const shifts = await prisma.cashShift.findMany({
    where: { businessId: req.businessId! },
    include: shiftInclude,
    orderBy: { openedAt: 'desc' },
    take,
  })
  res.json({ shifts: shifts.map(mapShift) })
})

shiftsRouter.post('/open', requirePermission('sell'), async (req: AuthedRequest, res) => {
  const body = z
    .object({
      openingFloat: z.number().nonnegative().max(1_000_000),
      notes: z.string().max(500).optional(),
    })
    .safeParse(req.body)
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid opening float' })
  }

  const businessId = req.businessId!
  const userId = req.auth!.sub

  const existing = await prisma.cashShift.findFirst({
    where: {
      businessId,
      openedById: userId,
      status: 'OPEN',
      ...(req.branchId ? { branchId: req.branchId } : {}),
    },
  })
  if (existing) {
    return res.status(409).json({ error: 'You already have an open shift' })
  }

  const shift = await prisma.cashShift.create({
    data: {
      businessId,
      branchId: req.branchId || null,
      openedById: userId,
      status: 'OPEN',
      openingFloat: body.data.openingFloat,
      notes: body.data.notes?.trim() || null,
    },
    include: shiftInclude,
  })

  await writeAudit('shift.open', {
    businessId,
    userId,
    entity: 'CashShift',
    entityId: shift.id,
    after: {
      openingFloat: shift.openingFloat,
      branchName: shift.branch?.name,
      cashier: shift.openedBy?.fullName,
    },
  })

  res.status(201).json({ shift: mapShift(shift) })
})

shiftsRouter.post('/:id/close', requirePermission('sell'), async (req: AuthedRequest, res) => {
  const body = z
    .object({
      declaredCash: z.number().nonnegative().max(1_000_000),
      discrepancyReason: z.string().max(300).optional(),
      notes: z.string().max(500).optional(),
    })
    .safeParse(req.body)
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid close payload' })
  }

  const businessId = req.businessId!
  const userId = req.auth!.sub
  const role = String(req.membershipRole || '')
  const isManager =
    role === 'OWNER' || role === 'ADMIN' || role === 'BRANCH_MANAGER'

  const existing = await prisma.cashShift.findFirst({
    where: { id: req.params.id, businessId },
    include: shiftInclude,
  })
  if (!existing) return res.status(404).json({ error: 'Shift not found' })
  if (existing.status !== 'OPEN') {
    return res.status(400).json({ error: 'Shift already closed' })
  }
  if (existing.openedById !== userId && !isManager) {
    return res.status(403).json({ error: 'Only the opener or a manager can close' })
  }

  const cashSales = await prisma.sale.aggregate({
    where: {
      businessId,
      status: 'COMPLETED',
      paymentMethod: 'CASH',
      createdAt: { gte: existing.openedAt },
      soldById: existing.openedById,
      ...(existing.branchId ? { branchId: existing.branchId } : {}),
    },
    _sum: { total: true },
  })
  const cashSalesTotal = Number((cashSales._sum.total || 0).toFixed(2))
  const expectedCash = Number(
    (existing.openingFloat + cashSalesTotal).toFixed(2),
  )
  const declaredCash = Number(body.data.declaredCash.toFixed(2))
  const discrepancy = Number((declaredCash - expectedCash).toFixed(2))
  const absDisc = Math.abs(discrepancy)

  if (absDisc >= 1 && !(body.data.discrepancyReason || '').trim()) {
    return res.status(400).json({
      error: 'Cash discrepancy needs a short reason (logged on Audit)',
    })
  }

  const shift = await prisma.cashShift.update({
    where: { id: existing.id },
    data: {
      status: 'CLOSED',
      closedById: userId,
      closedAt: new Date(),
      cashSalesTotal,
      expectedCash,
      declaredCash,
      discrepancy,
      discrepancyReason: body.data.discrepancyReason?.trim() || null,
      notes: body.data.notes?.trim() || existing.notes,
    },
    include: shiftInclude,
  })

  await writeAudit('shift.close', {
    businessId,
    userId,
    entity: 'CashShift',
    entityId: shift.id,
    before: { status: 'OPEN', openingFloat: existing.openingFloat },
    after: {
      status: 'CLOSED',
      cashSalesTotal,
      expectedCash,
      declaredCash,
      discrepancy,
      discrepancyReason: shift.discrepancyReason,
      cashier: existing.openedBy?.fullName,
      branchName: existing.branch?.name,
    },
  })

  if (absDisc >= 10) {
    await createOwnerAlert({
      businessId,
      type: 'RISK',
      title: discrepancy < 0 ? 'Cash shortage on shift close' : 'Cash overage on shift close',
      body: `${existing.openedBy?.fullName || 'Cashier'}: expected ${expectedCash.toFixed(2)}, declared ${declaredCash.toFixed(2)} (Δ ${discrepancy.toFixed(2)})${
        shift.discrepancyReason ? ` — ${shift.discrepancyReason}` : ''
      }.`,
      meta: { shiftId: shift.id, discrepancy },
    })
  }

  res.json({ shift: mapShift(shift) })
})
