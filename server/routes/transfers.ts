import { Router } from 'express'
import { z } from 'zod'
import {
  applyBranchStockDelta,
  ensureBranchStockSeeded,
} from '../branchStock.js'
import {
  requireAuth,
  requireAnyPermission,
  requireBusinessMember,
  requirePermission,
  requirePlanFeature,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'

export const transfersRouter = Router()
transfersRouter.use(
  requireAuth,
  requireBusinessMember,
  requirePlanFeature('transfers'),
)

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(100_000),
})

function serializeTransfer(
  t: Awaited<ReturnType<typeof loadTransfer>> extends infer R
    ? NonNullable<R>
    : never,
) {
  return {
    id: t.id,
    status: t.status,
    notes: t.notes,
    rejectReason: t.rejectReason,
    discrepancyNote: t.discrepancyNote,
    fromBranch: t.fromBranch,
    toBranch: t.toBranch,
    requestedById: t.requestedById,
    approvedById: t.approvedById,
    dispatchedById: t.dispatchedById,
    receivedById: t.receivedById,
    requestedAt: t.requestedAt,
    approvedAt: t.approvedAt,
    rejectedAt: t.rejectedAt,
    dispatchedAt: t.dispatchedAt,
    receivedAt: t.receivedAt,
    items: t.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product.name,
      sku: i.product.sku,
      requestedQty: i.requestedQty,
      approvedQty: i.approvedQty,
      dispatchedQty: i.dispatchedQty,
      receivedQty: i.receivedQty,
      discrepancy: i.discrepancy,
    })),
  }
}

async function loadTransfer(businessId: string, id: string) {
  return prisma.stockTransfer.findFirst({
    where: { id, businessId },
    include: {
      fromBranch: { select: { id: true, name: true, code: true } },
      toBranch: { select: { id: true, name: true, code: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
        },
      },
    },
  })
}

transfersRouter.get(
  '/',
  requireAnyPermission(
    'transfer_request',
    'transfer_approve',
    'transfer_receive',
  ),
  async (req: AuthedRequest, res) => {
    const businessId = req.businessId!
    await ensureBranchStockSeeded(businessId)

    const status = String(req.query.status || '').trim()
    const transfers = await prisma.stockTransfer.findMany({
      where: {
        businessId,
        ...(status ? { status: status as never } : {}),
        ...(req.branchId && !req.orgView
          ? {
              OR: [
                { fromBranchId: req.branchId },
                { toBranchId: req.branchId },
              ],
            }
          : {}),
      },
      include: {
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch: { select: { id: true, name: true, code: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    res.json({ transfers: transfers.map(serializeTransfer) })
  },
)

transfersRouter.get(
  '/:id',
  requireAnyPermission(
    'transfer_request',
    'transfer_approve',
    'transfer_receive',
  ),
  async (req: AuthedRequest, res) => {
    const t = await loadTransfer(req.businessId!, req.params.id)
    if (!t) return res.status(404).json({ error: 'Transfer not found' })
    res.json({ transfer: serializeTransfer(t) })
  },
)

transfersRouter.post(
  '/',
  requirePermission('transfer_request'),
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        fromBranchId: z.string().min(1),
        toBranchId: z.string().min(1),
        notes: z.string().max(500).optional(),
        items: z.array(itemSchema).min(1).max(100),
      })
      .safeParse(req.body)
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid transfer request' })
    }
    if (body.data.fromBranchId === body.data.toBranchId) {
      return res.status(400).json({ error: 'Source and destination must differ' })
    }

    const businessId = req.businessId!
    await ensureBranchStockSeeded(businessId)

    const [from, to] = await Promise.all([
      prisma.branch.findFirst({
        where: { id: body.data.fromBranchId, businessId },
      }),
      prisma.branch.findFirst({
        where: { id: body.data.toBranchId, businessId },
      }),
    ])
    if (!from || !to) {
      return res.status(400).json({ error: 'Unknown branch' })
    }

    const productIds = body.data.items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { businessId, id: { in: productIds }, active: true },
      select: { id: true },
    })
    if (products.length !== new Set(productIds).size) {
      return res.status(400).json({ error: 'One or more products are invalid' })
    }

    const created = await prisma.stockTransfer.create({
      data: {
        businessId,
        fromBranchId: from.id,
        toBranchId: to.id,
        notes: body.data.notes?.trim() || null,
        requestedById: req.auth!.sub,
        status: 'REQUESTED',
        items: {
          create: body.data.items.map((i) => ({
            productId: i.productId,
            requestedQty: i.quantity,
          })),
        },
      },
    })

    const transfer = await loadTransfer(businessId, created.id)
    await writeAudit('transfer.request', {
      businessId,
      userId: req.auth!.sub,
      entity: 'StockTransfer',
      entityId: created.id,
      after: {
        from: from.name,
        to: to.name,
        itemCount: body.data.items.length,
        status: 'REQUESTED',
      },
    })

    res.status(201).json({ transfer: serializeTransfer(transfer!) })
  },
)

transfersRouter.post(
  '/:id/approve',
  requirePermission('transfer_approve'),
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        items: z
          .array(
            z.object({
              productId: z.string().min(1),
              approvedQty: z.number().int().nonnegative().max(100_000),
            }),
          )
          .optional(),
      })
      .safeParse(req.body || {})
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid approve payload' })
    }

    const businessId = req.businessId!
    const existing = await loadTransfer(businessId, req.params.id)
    if (!existing) return res.status(404).json({ error: 'Transfer not found' })
    if (existing.status !== 'REQUESTED') {
      return res.status(400).json({ error: 'Only requested transfers can be approved' })
    }

    const qtyByProduct = new Map(
      (body.data.items || []).map((i) => [i.productId, i.approvedQty]),
    )

    await prisma.$transaction(async (tx) => {
      for (const item of existing.items) {
        const approved =
          qtyByProduct.get(item.productId) ?? item.requestedQty
        if (approved > item.requestedQty) {
          throw new Error('Approved qty cannot exceed requested')
        }
        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { approvedQty: approved },
        })
      }
      await tx.stockTransfer.update({
        where: { id: existing.id },
        data: {
          status: 'APPROVED',
          approvedById: req.auth!.sub,
          approvedAt: new Date(),
        },
      })
    })

    const transfer = await loadTransfer(businessId, existing.id)
    await writeAudit('transfer.approve', {
      businessId,
      userId: req.auth!.sub,
      entity: 'StockTransfer',
      entityId: existing.id,
      after: { status: 'APPROVED' },
    })
    res.json({ transfer: serializeTransfer(transfer!) })
  },
)

transfersRouter.post(
  '/:id/reject',
  requirePermission('transfer_approve'),
  async (req: AuthedRequest, res) => {
    const body = z
      .object({ reason: z.string().min(3).max(300) })
      .safeParse(req.body)
    if (!body.success) {
      return res.status(400).json({ error: 'Reject reason required' })
    }

    const businessId = req.businessId!
    const existing = await loadTransfer(businessId, req.params.id)
    if (!existing) return res.status(404).json({ error: 'Transfer not found' })
    if (existing.status !== 'REQUESTED' && existing.status !== 'APPROVED') {
      return res.status(400).json({ error: 'Cannot reject this transfer' })
    }

    await prisma.stockTransfer.update({
      where: { id: existing.id },
      data: {
        status: 'REJECTED',
        rejectReason: body.data.reason.trim(),
        rejectedAt: new Date(),
        approvedById: req.auth!.sub,
      },
    })

    const transfer = await loadTransfer(businessId, existing.id)
    await writeAudit('transfer.reject', {
      businessId,
      userId: req.auth!.sub,
      entity: 'StockTransfer',
      entityId: existing.id,
      after: { status: 'REJECTED', reason: body.data.reason.trim() },
    })
    res.json({ transfer: serializeTransfer(transfer!) })
  },
)

transfersRouter.post(
  '/:id/dispatch',
  requirePermission('transfer_approve'),
  async (req: AuthedRequest, res) => {
    const businessId = req.businessId!
    await ensureBranchStockSeeded(businessId)

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.stockTransfer.findFirst({
          where: { id: req.params.id, businessId },
          include: { items: true },
        })
        if (!existing) throw new Error('Transfer not found')
        if (existing.status !== 'APPROVED') {
          throw new Error('Approve the transfer before dispatch')
        }

        for (const item of existing.items) {
          const qty = item.approvedQty ?? item.requestedQty
          if (qty <= 0) continue
          await applyBranchStockDelta(tx, {
            businessId,
            branchId: existing.fromBranchId,
            productId: item.productId,
            delta: -qty,
            movementType: 'TRANSFER_OUT',
            note: `Transfer dispatch ${existing.id}`,
            referenceId: existing.id,
          })
          await tx.stockTransferItem.update({
            where: { id: item.id },
            data: { dispatchedQty: qty },
          })
        }

        return tx.stockTransfer.update({
          where: { id: existing.id },
          data: {
            status: 'DISPATCHED',
            dispatchedById: req.auth!.sub,
            dispatchedAt: new Date(),
          },
        })
      })

      const transfer = await loadTransfer(businessId, result.id)
      await writeAudit('transfer.dispatch', {
        businessId,
        userId: req.auth!.sub,
        entity: 'StockTransfer',
        entityId: result.id,
        after: { status: 'DISPATCHED' },
      })
      res.json({ transfer: serializeTransfer(transfer!) })
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Dispatch failed',
      })
    }
  },
)

transfersRouter.post(
  '/:id/receive',
  requirePermission('transfer_receive'),
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        items: z
          .array(
            z.object({
              productId: z.string().min(1),
              receivedQty: z.number().int().nonnegative().max(100_000),
            }),
          )
          .min(1),
        finalize: z.boolean().optional(),
        discrepancyNote: z.string().max(500).optional(),
      })
      .safeParse(req.body)
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid receive payload' })
    }

    const businessId = req.businessId!
    await ensureBranchStockSeeded(businessId)

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.stockTransfer.findFirst({
          where: { id: req.params.id, businessId },
          include: { items: true },
        })
        if (!existing) throw new Error('Transfer not found')
        if (
          existing.status !== 'DISPATCHED' &&
          existing.status !== 'PARTIAL'
        ) {
          throw new Error('Dispatch the transfer before receiving')
        }

        const recvMap = new Map(
          body.data.items.map((i) => [i.productId, i.receivedQty]),
        )
        let anyShort = false
        let allDone = true

        for (const item of existing.items) {
          const add = recvMap.get(item.productId)
          if (add === undefined) {
            if (item.receivedQty < item.dispatchedQty) allDone = false
            continue
          }
          const room = item.dispatchedQty - item.receivedQty
          if (add > room) {
            throw new Error(
              `Cannot receive more than dispatched for a line (max ${room})`,
            )
          }
          if (add > 0) {
            await applyBranchStockDelta(tx, {
              businessId,
              branchId: existing.toBranchId,
              productId: item.productId,
              delta: add,
              movementType: 'TRANSFER_IN',
              note: `Transfer receive ${existing.id}`,
              referenceId: existing.id,
            })
          }
          const newReceived = item.receivedQty + add
          const discrepancy = Math.max(0, item.dispatchedQty - newReceived)
          if (discrepancy > 0) anyShort = true
          if (newReceived < item.dispatchedQty) allDone = false

          await tx.stockTransferItem.update({
            where: { id: item.id },
            data: {
              receivedQty: newReceived,
              discrepancy:
                body.data.finalize || newReceived >= item.dispatchedQty
                  ? discrepancy
                  : 0,
            },
          })
        }

        // Re-check after updates
        const freshItems = await tx.stockTransferItem.findMany({
          where: { transferId: existing.id },
        })
        allDone = freshItems.every((i) => i.receivedQty >= i.dispatchedQty)
        anyShort = freshItems.some((i) => i.discrepancy > 0)
        const finalize = body.data.finalize || allDone

        let status: 'PARTIAL' | 'RECEIVED' = 'PARTIAL'
        if (finalize) {
          status = 'RECEIVED'
          for (const item of freshItems) {
            const disc = Math.max(0, item.dispatchedQty - item.receivedQty)
            if (disc !== item.discrepancy) {
              await tx.stockTransferItem.update({
                where: { id: item.id },
                data: { discrepancy: disc },
              })
            }
            if (disc > 0) anyShort = true
          }
        }

        return tx.stockTransfer.update({
          where: { id: existing.id },
          data: {
            status,
            receivedById: req.auth!.sub,
            receivedAt: finalize ? new Date() : existing.receivedAt,
            discrepancyNote:
              anyShort && (body.data.discrepancyNote || existing.discrepancyNote)
                ? (body.data.discrepancyNote || existing.discrepancyNote)
                : anyShort
                  ? 'Short receive vs dispatched qty'
                  : existing.discrepancyNote,
          },
        })
      })

      const transfer = await loadTransfer(businessId, result.id)
      const hasDisc = transfer!.items.some((i) => i.discrepancy > 0)
      await writeAudit('transfer.receive', {
        businessId,
        userId: req.auth!.sub,
        entity: 'StockTransfer',
        entityId: result.id,
        after: {
          status: result.status,
          discrepancy: hasDisc || undefined,
        },
      })
      res.json({ transfer: serializeTransfer(transfer!) })
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Receive failed',
      })
    }
  },
)
