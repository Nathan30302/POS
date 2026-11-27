import { Router } from 'express'
import { z } from 'zod'
import {
  generateUniqueEan13Batch,
  refreshBatchExhaustion,
} from '../barcodeCodes.js'
import {
  requireAuth,
  requireAnyPermission,
  requireBusinessMember,
  requirePermission,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'

export const barcodeBatchesRouter = Router()
barcodeBatchesRouter.use(requireAuth, requireBusinessMember)

const COUNT_PRESETS = [10, 20, 50, 100, 200, 300] as const

function batchSummary(batch: {
  id: string
  label: string | null
  quantity: number
  status: string
  printedAt: Date | null
  exhaustedAt: Date | null
  createdAt: Date
  codes: { status: string }[]
}) {
  const available = batch.codes.filter((c) => c.status === 'AVAILABLE').length
  const claimed = batch.codes.filter((c) => c.status === 'CLAIMED').length
  return {
    id: batch.id,
    label: batch.label,
    quantity: batch.quantity,
    status: batch.status,
    printedAt: batch.printedAt,
    exhaustedAt: batch.exhaustedAt,
    createdAt: batch.createdAt,
    available,
    claimed,
  }
}

/** Unused (AVAILABLE) pool codes for product form assignment. */
barcodeBatchesRouter.get(
  '/codes/available',
  requireAnyPermission('labels', 'inventory'),
  async (req: AuthedRequest, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const codes = await prisma.barcodeCode.findMany({
      where: { businessId: req.businessId!, status: 'AVAILABLE' },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        code: true,
        batchId: true,
        createdAt: true,
      },
    })
    res.json({ codes })
  },
)

barcodeBatchesRouter.get(
  '/',
  requirePermission('labels'),
  async (req: AuthedRequest, res) => {
    const businessId = req.businessId!
    const [batches, statusGroups, availableTotal] = await Promise.all([
      prisma.barcodeBatch.findMany({
        where: { businessId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          label: true,
          quantity: true,
          status: true,
          printedAt: true,
          exhaustedAt: true,
          createdAt: true,
        },
      }),
      prisma.barcodeCode.groupBy({
        by: ['batchId', 'status'],
        where: { businessId },
        _count: { _all: true },
      }),
      prisma.barcodeCode.count({
        where: { businessId, status: 'AVAILABLE' },
      }),
    ])
    const counts = new Map<string, { available: number; claimed: number }>()
    for (const row of statusGroups) {
      const cur = counts.get(row.batchId) || { available: 0, claimed: 0 }
      if (row.status === 'AVAILABLE') cur.available = row._count._all
      if (row.status === 'CLAIMED') cur.claimed = row._count._all
      counts.set(row.batchId, cur)
    }
    res.json({
      batches: batches.map((b) => {
        const c = counts.get(b.id) || { available: 0, claimed: 0 }
        return {
          id: b.id,
          label: b.label,
          quantity: b.quantity,
          status: b.status,
          printedAt: b.printedAt,
          exhaustedAt: b.exhaustedAt,
          createdAt: b.createdAt,
          available: c.available,
          claimed: c.claimed,
        }
      }),
      availableTotal,
      countPresets: COUNT_PRESETS,
    })
  },
)

barcodeBatchesRouter.get(
  '/:id',
  requirePermission('labels'),
  async (req: AuthedRequest, res) => {
    const batch = await prisma.barcodeBatch.findFirst({
      where: { id: req.params.id, businessId: req.businessId! },
      include: {
        codes: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            code: true,
            status: true,
            productId: true,
            claimedAt: true,
          },
        },
      },
    })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })
    res.json({
      batch: {
        ...batchSummary(batch),
        codes: batch.codes,
      },
    })
  },
)

barcodeBatchesRouter.post(
  '/',
  requirePermission('labels'),
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        count: z.number().int().min(1).max(500),
        label: z.string().max(80).optional(),
      })
      .safeParse(req.body)
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid count (1–500)' })
    }

    const businessId = req.businessId!
    const { count, label } = body.data

    try {
      const result = await prisma.$transaction(async (tx) => {
        const codes = await generateUniqueEan13Batch(tx, businessId, count)
        const batch = await tx.barcodeBatch.create({
          data: {
            businessId,
            quantity: count,
            label: label?.trim() || `Batch of ${count}`,
            status: 'READY',
            codes: {
              create: codes.map((code) => ({
                businessId,
                code,
                status: 'AVAILABLE',
              })),
            },
          },
          include: {
            codes: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                code: true,
                status: true,
                productId: true,
                claimedAt: true,
              },
            },
          },
        })
        return batch
      })

      await writeAudit('barcode_batch.create', {
        businessId,
        userId: req.auth!.sub,
        entity: 'BarcodeBatch',
        entityId: result.id,
        after: { quantity: count, label: result.label },
      })

      res.status(201).json({
        batch: {
          ...batchSummary(result),
          codes: result.codes,
        },
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not generate batch'
      res.status(400).json({ error: message })
    }
  },
)

barcodeBatchesRouter.patch(
  '/:id',
  requirePermission('labels'),
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        status: z.enum(['READY', 'PRINTED', 'EXHAUSTED']),
        label: z.string().max(80).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return res.status(400).json({ error: 'Invalid update' })

    const businessId = req.businessId!
    const existing = await prisma.barcodeBatch.findFirst({
      where: { id: req.params.id, businessId },
      include: { codes: { select: { status: true } } },
    })
    if (!existing) return res.status(404).json({ error: 'Batch not found' })

    const data: {
      status: 'READY' | 'PRINTED' | 'EXHAUSTED'
      label?: string
      printedAt?: Date | null
      exhaustedAt?: Date | null
    } = { status: body.data.status }

    if (body.data.label !== undefined) {
      data.label = body.data.label.trim() || existing.label || undefined
    }
    if (body.data.status === 'PRINTED' && !existing.printedAt) {
      data.printedAt = new Date()
    }
    if (body.data.status === 'EXHAUSTED') {
      data.exhaustedAt = new Date()
    }
    if (body.data.status === 'READY') {
      data.exhaustedAt = null
    }

    const updated = await prisma.barcodeBatch.update({
      where: { id: existing.id },
      data,
      include: { codes: { select: { status: true } } },
    })

    if (body.data.status !== 'EXHAUSTED') {
      await refreshBatchExhaustion(prisma, existing.id)
    }

    await writeAudit('barcode_batch.update', {
      businessId,
      userId: req.auth!.sub,
      entity: 'BarcodeBatch',
      entityId: existing.id,
      before: { status: existing.status },
      after: { status: updated.status },
    })

    res.json({ batch: batchSummary(updated) })
  },
)
