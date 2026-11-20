import { Router } from 'express'
import { z } from 'zod'
import {
  requireAuth,
  requireBusinessMember,
  requireManager,
  requirePermission,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'

export const salesRouter = Router()
salesRouter.use(requireAuth, requireBusinessMember)

salesRouter.get('/conflicts', requireManager, async (req: AuthedRequest, res) => {
  const conflicts = await prisma.stockConflict.findMany({
    where: { businessId: req.businessId! },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  res.json({ conflicts })
})

salesRouter.post(
  '/conflicts/:id/resolve',
  requireManager,
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        status: z.enum(['ACCEPTED_NEGATIVE', 'ADJUSTED', 'DISMISSED']),
        resolution: z.string().max(500).optional(),
      })
      .safeParse(req.body)
    if (!body.success) return res.status(400).json({ error: 'Invalid resolution' })

    const existing = await prisma.stockConflict.findFirst({
      where: { id: req.params.id, businessId: req.businessId! },
    })
    if (!existing) return res.status(404).json({ error: 'Conflict not found' })

    const conflict = await prisma.stockConflict.update({
      where: { id: existing.id },
      data: {
        status: body.data.status,
        resolution: body.data.resolution || body.data.status,
      },
    })
    await writeAudit('stock_conflict.resolve', {
      businessId: req.businessId!,
      userId: req.auth!.sub,
      entity: 'StockConflict',
      entityId: conflict.id,
      before: { status: existing.status },
      after: { status: conflict.status, resolution: conflict.resolution },
    })
    res.json({ conflict })
  },
)

const paymentMethods = [
  'CASH',
  'CARD',
  'MTN_MOMO',
  'AIRTEL_MONEY',
  'ZAMTEL',
  'BANK_TRANSFER',
  'OTHER',
] as const

salesRouter.get('/', requirePermission('ledger'), async (req: AuthedRequest, res) => {
  const sales = await prisma.sale.findMany({
    where: { businessId: req.businessId! },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  res.json({ sales })
})

salesRouter.get('/:id', requirePermission('ledger'), async (req: AuthedRequest, res) => {
  const sale = await prisma.sale.findFirst({
    where: { id: req.params.id, businessId: req.businessId! },
    include: { items: true },
  })
  if (!sale) return res.status(404).json({ error: 'Sale not found' })
  res.json({ sale })
})

salesRouter.post('/', requirePermission('sell'), async (req: AuthedRequest, res) => {
  const body = z
    .object({
      discount: z.number().nonnegative().default(0),
      paymentMethod: z.enum(paymentMethods),
      notes: z.string().max(2000).optional(),
      customerId: z.string().optional(),
      clientSaleId: z.string().min(8).max(80).optional(),
      allowStockConflict: z.boolean().optional(),
      lines: z
        .array(
          z.object({
            productId: z.string().min(1),
            quantity: z.number().int().positive().max(10000),
          }),
        )
        .min(1)
        .max(200),
    })
    .safeParse(req.body)

  if (!body.success) return res.status(400).json({ error: 'Invalid sale' })

  const discountRequested = body.data.discount
  if (discountRequested > 0 && !req.permissions?.includes('discounts')) {
    return res.status(403).json({ error: 'Missing permission: discounts' })
  }

  const businessId = req.businessId!

  // Idempotent replay for offline sync
  if (body.data.clientSaleId) {
    const existing = await prisma.sale.findFirst({
      where: { businessId, clientSaleId: body.data.clientSaleId },
      include: { items: true },
    })
    if (existing) {
      return res.status(200).json({ sale: existing, deduped: true })
    }
  }

  try {
    const sale = await prisma.$transaction(async (tx) => {
      let subtotal = 0
      const prepared: {
        productId: string
        productName: string
        quantity: number
        unitPrice: number
        lineTotal: number
        costPrice: number
      }[] = []

      for (const line of body.data.lines) {
        const product = await tx.product.findFirst({
          where: { id: line.productId, businessId, active: true },
        })
        if (!product) throw new Error('Product missing from catalogue')
        if (product.stockQuantity < line.quantity) {
          await tx.stockConflict.create({
            data: {
              businessId,
              productId: product.id,
              productName: product.name,
              clientSaleId: body.data.clientSaleId,
              requestedQty: line.quantity,
              availableQty: product.stockQuantity,
              status: 'OPEN',
            },
          })
          throw new Error(
            `Stock conflict: ${product.name} needs ${line.quantity}, only ${product.stockQuantity} left`,
          )
        }
        const lineTotal = product.sellingPrice * line.quantity
        subtotal += lineTotal
        prepared.push({
          productId: product.id,
          productName: product.name,
          quantity: line.quantity,
          unitPrice: product.sellingPrice,
          lineTotal,
          costPrice: product.costPrice,
        })
      }

      const discount = Math.min(discountRequested, subtotal)
      const total = Number((subtotal - discount).toFixed(2))
      const receiptNo = `NX-${Date.now().toString().slice(-8)}`

      const created = await tx.sale.create({
        data: {
          businessId,
          branchId: req.branchId || null,
          soldById: req.auth!.sub,
          customerId: body.data.customerId || null,
          clientSaleId: body.data.clientSaleId || null,
          status: 'COMPLETED',
          subtotal,
          discount,
          tax: 0,
          total,
          paymentMethod: body.data.paymentMethod,
          notes: body.data.notes,
          receiptNo,
          items: {
            create: prepared.map((p) => ({
              productId: p.productId,
              productName: p.productName,
              quantity: p.quantity,
              unitPrice: p.unitPrice,
              lineTotal: p.lineTotal,
              costPrice: p.costPrice,
            })),
          },
        },
        include: { items: true },
      })

      for (const p of prepared) {
        await tx.product.update({
          where: { id: p.productId },
          data: { stockQuantity: { decrement: p.quantity } },
        })
        await tx.stockMovement.create({
          data: {
            businessId,
            productId: p.productId,
            type: 'SALE',
            quantity: -p.quantity,
            referenceId: created.id,
            note: `Sale ${receiptNo}`,
          },
        })
      }

      return created
    })

    await writeAudit('sale.create', {
      businessId,
      userId: req.auth!.sub,
      entity: 'Sale',
      entityId: sale.id,
      after: {
        total: sale.total,
        discount: sale.discount,
        paymentMethod: sale.paymentMethod,
        receiptNo: sale.receiptNo,
        itemCount: sale.items.length,
      },
    })

    res.status(201).json({ sale })
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Sale failed',
    })
  }
})

salesRouter.post(
  '/:id/void',
  requirePermission('void_sales'),
  async (req: AuthedRequest, res) => {
    const businessId = req.businessId!

    try {
      const sale = await prisma.$transaction(async (tx) => {
        const existing = await tx.sale.findFirst({
          where: { id: req.params.id, businessId },
          include: { items: true },
        })
        if (!existing) throw new Error('Sale not found')
        if (existing.status !== 'COMPLETED') {
          throw new Error('Only completed sales can be voided')
        }

        for (const item of existing.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
          })
          await tx.stockMovement.create({
            data: {
              businessId,
              productId: item.productId,
              type: 'RETURN',
              quantity: item.quantity,
              referenceId: existing.id,
              note: 'Sale voided',
            },
          })
        }

        return tx.sale.update({
          where: { id: existing.id },
          data: { status: 'VOIDED' },
          include: { items: true },
        })
      })

      await writeAudit('sale.void', {
        businessId,
        userId: req.auth!.sub,
        entity: 'Sale',
        entityId: sale.id,
        before: { status: 'COMPLETED', total: sale.total },
        after: { status: 'VOIDED' },
      })

      res.json({ sale })
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Void failed',
      })
    }
  },
)
