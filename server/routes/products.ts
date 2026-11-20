import { Router } from 'express'
import { z } from 'zod'
import {
  requireAuth,
  requireAnyPermission,
  requireBusinessMember,
  requirePermission,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'

export const productsRouter = Router()
productsRouter.use(requireAuth, requireBusinessMember)

productsRouter.get(
  '/',
  requireAnyPermission('sell', 'inventory', 'labels'),
  async (req: AuthedRequest, res) => {
  const q = String(req.query.q || '').trim()
  const products = await prisma.product.findMany({
    where: {
      businessId: req.businessId!,
      active: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { barcode: { contains: q } },
              { sku: { contains: q } },
            ],
          }
        : {}),
    },
    include: { category: true },
    orderBy: { name: 'asc' },
  })
  res.json({ products })
},
)

productsRouter.post('/', requirePermission('inventory'), async (req: AuthedRequest, res) => {
  const body = z
    .object({
      name: z.string().min(1),
      barcode: z.string().optional(),
      sku: z.string().optional(),
      category: z.string().optional(),
      costPrice: z.number().nonnegative().default(0),
      sellingPrice: z.number().nonnegative(),
      stockQuantity: z.number().int().nonnegative().default(0),
      lowStockThreshold: z.number().int().nonnegative().default(10),
      imageUrl: z.string().optional(),
    })
    .safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'Invalid product' })

  const businessId = req.businessId!
  let categoryId: string | undefined
  if (body.data.category) {
    const cat = await prisma.category.upsert({
      where: { businessId_name: { businessId, name: body.data.category } },
      update: {},
      create: { businessId, name: body.data.category },
    })
    categoryId = cat.id
  }

  try {
    const product = await prisma.product.create({
      data: {
        businessId,
        categoryId,
        name: body.data.name,
        barcode: body.data.barcode || null,
        sku: body.data.sku || null,
        costPrice: body.data.costPrice,
        sellingPrice: body.data.sellingPrice,
        stockQuantity: body.data.stockQuantity,
        lowStockThreshold: body.data.lowStockThreshold,
        imageUrl: body.data.imageUrl || null,
      },
    })
    await writeAudit('product.create', {
      businessId,
      userId: req.auth!.sub,
      entity: 'Product',
      entityId: product.id,
      after: {
        name: product.name,
        sellingPrice: product.sellingPrice,
        stockQuantity: product.stockQuantity,
      },
    })
    res.status(201).json({ product })
  } catch {
    res.status(400).json({ error: 'Could not create product (duplicate barcode/SKU?)' })
  }
})

productsRouter.put('/:id', requirePermission('inventory'), async (req: AuthedRequest, res) => {
  const businessId = req.businessId!
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, businessId },
  })
  if (!existing) return res.status(404).json({ error: 'Product not found' })

  const body = z
    .object({
      name: z.string().min(1),
      barcode: z.string().optional().nullable(),
      sku: z.string().optional().nullable(),
      costPrice: z.number().nonnegative(),
      sellingPrice: z.number().nonnegative(),
      stockQuantity: z.number().int().nonnegative(),
      lowStockThreshold: z.number().int().nonnegative(),
      imageUrl: z.string().optional().nullable(),
      category: z.string().optional(),
    })
    .safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'Invalid product' })

  let categoryId = existing.categoryId
  if (body.data.category) {
    const cat = await prisma.category.upsert({
      where: { businessId_name: { businessId, name: body.data.category } },
      update: {},
      create: { businessId, name: body.data.category },
    })
    categoryId = cat.id
  }

  try {
    const product = await prisma.product.update({
      where: { id: existing.id },
      data: {
        name: body.data.name,
        barcode: body.data.barcode || null,
        sku: body.data.sku || null,
        costPrice: body.data.costPrice,
        sellingPrice: body.data.sellingPrice,
        stockQuantity: body.data.stockQuantity,
        lowStockThreshold: body.data.lowStockThreshold,
        imageUrl: body.data.imageUrl || null,
        categoryId,
      },
    })
    await writeAudit('product.update', {
      businessId,
      userId: req.auth!.sub,
      entity: 'Product',
      entityId: product.id,
      before: {
        name: existing.name,
        sellingPrice: existing.sellingPrice,
        costPrice: existing.costPrice,
        stockQuantity: existing.stockQuantity,
      },
      after: {
        name: product.name,
        sellingPrice: product.sellingPrice,
        costPrice: product.costPrice,
        stockQuantity: product.stockQuantity,
      },
    })
    res.json({ product })
  } catch {
    res.status(400).json({ error: 'Update failed' })
  }
})

productsRouter.delete('/:id', requirePermission('inventory'), async (req: AuthedRequest, res) => {
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, businessId: req.businessId! },
  })
  if (!existing) return res.status(404).json({ error: 'Product not found' })
  await prisma.product.update({
    where: { id: existing.id },
    data: { active: false },
  })
  await writeAudit('product.deactivate', {
    businessId: req.businessId!,
    userId: req.auth!.sub,
    entity: 'Product',
    entityId: existing.id,
    before: { active: true, name: existing.name },
    after: { active: false },
  })
  res.json({ ok: true })
})

productsRouter.post('/:id/receive', requirePermission('receive_stock'), async (req: AuthedRequest, res) => {
  const businessId = req.businessId!
  const qty = Number(req.body.quantity)
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Quantity must be > 0' })
  }
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, businessId },
  })
  if (!existing) return res.status(404).json({ error: 'Product not found' })

  const product = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: existing.id },
      data: { stockQuantity: { increment: Math.floor(qty) } },
    })
    await tx.stockMovement.create({
      data: {
        businessId,
        productId: existing.id,
        type: 'PURCHASE',
        quantity: Math.floor(qty),
        note: req.body.note || 'Stock received',
      },
    })
    return updated
  })

  await writeAudit('product.receive_stock', {
    businessId,
    userId: req.auth!.sub,
    entity: 'Product',
    entityId: existing.id,
    before: { stockQuantity: existing.stockQuantity },
    after: { stockQuantity: product.stockQuantity, received: Math.floor(qty) },
  })
  res.json({ product })
})

productsRouter.get(
  '/:id/movements',
  requireAnyPermission('inventory', 'receive_stock'),
  async (req: AuthedRequest, res) => {
  const businessId = req.businessId!
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, businessId },
  })
  if (!existing) return res.status(404).json({ error: 'Product not found' })

  const movements = await prisma.stockMovement.findMany({
    where: { businessId, productId: existing.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  res.json({ movements })
},
)

