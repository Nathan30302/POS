import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireBusiness, type AuthedRequest } from '../middleware.js'
import { effectivePermissions } from '../permissions.js'
import { prisma } from '../prisma.js'

export const salesRouter = Router()
salesRouter.use(requireAuth, requireBusiness)

const paymentMethods = [
  'CASH',
  'CARD',
  'MTN_MOMO',
  'AIRTEL_MONEY',
  'ZAMTEL',
  'BANK_TRANSFER',
  'OTHER',
] as const

salesRouter.get('/', async (req: AuthedRequest, res) => {
  const sales = await prisma.sale.findMany({
    where: { businessId: req.auth!.businessId! },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  res.json({ sales })
})

salesRouter.get('/:id', async (req: AuthedRequest, res) => {
  const sale = await prisma.sale.findFirst({
    where: { id: req.params.id, businessId: req.auth!.businessId! },
    include: { items: true },
  })
  if (!sale) return res.status(404).json({ error: 'Sale not found' })
  res.json({ sale })
})

salesRouter.post('/', async (req: AuthedRequest, res) => {
  const body = z
    .object({
      discount: z.number().nonnegative().default(0),
      paymentMethod: z.enum(paymentMethods),
      notes: z.string().optional(),
      lines: z
        .array(
          z.object({
            productId: z.string(),
            quantity: z.number().int().positive(),
          }),
        )
        .min(1),
    })
    .safeParse(req.body)

  if (!body.success) return res.status(400).json({ error: 'Invalid sale' })

  const businessId = req.auth!.businessId!
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
          throw new Error(`Not enough stock for ${product.name}`)
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

      const discount = Math.min(body.data.discount, subtotal)
      const total = Number((subtotal - discount).toFixed(2))
      const receiptNo = `NX-${Date.now().toString().slice(-8)}`

      const created = await tx.sale.create({
        data: {
          businessId,
          soldById: req.auth!.sub,
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

    res.status(201).json({ sale })
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Sale failed',
    })
  }
})

salesRouter.post('/:id/void', async (req: AuthedRequest, res) => {
  const businessId = req.auth!.businessId!
  const role = req.auth!.role
  const membership = await prisma.membership.findFirst({
    where: {
      userId: req.auth!.sub,
      businessId,
      active: true,
    },
  })
  const perms = effectivePermissions(role, membership?.permissions)
  const allowed =
    ['OWNER', 'ADMIN'].includes(role || '') || perms.includes('void_sales')
  if (!allowed) {
    return res.status(403).json({ error: 'Not allowed to void sales' })
  }

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
    res.json({ sale })
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Void failed',
    })
  }
})
