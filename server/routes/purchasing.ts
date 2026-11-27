import { Router } from 'express'
import { z } from 'zod'
import {
  applyBranchStockDelta,
  ensureBranchStockSeeded,
  resolveStockBranchId,
} from '../branchStock.js'
import {
  requireAuth,
  requireBusinessMember,
  requirePermission,
  requirePlanFeature,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import { prisma } from '../prisma.js'

export const purchasingRouter = Router()
purchasingRouter.use(
  requireAuth,
  requireBusinessMember,
  requirePlanFeature('purchasing'),
)

const poItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(100_000),
  unitCost: z.number().nonnegative().max(1_000_000),
})

const PO_STATUSES = [
  'DRAFT',
  'ORDERED',
  'PARTIAL',
  'RECEIVED',
  'CANCELLED',
] as const

function serializeSupplier(s: {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  balance: number
  createdAt: Date
  updatedAt: Date
  _count?: { purchaseOrders: number; products: number }
}) {
  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    email: s.email,
    address: s.address,
    notes: s.notes,
    balance: s.balance,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    orderCount: s._count?.purchaseOrders ?? undefined,
    productCount: s._count?.products ?? undefined,
  }
}

function serializePo(po: {
  id: string
  status: string
  total: number
  notes: string | null
  createdAt: Date
  orderedAt: Date | null
  receivedAt: Date | null
  createdById: string | null
  supplier: { id: string; name: string; phone: string | null }
  receiveBranch: { id: string; name: string } | null
  items: Array<{
    id: string
    productId: string
    quantity: number
    unitCost: number
    lineTotal: number
    receivedQty: number
    product: { id: string; name: string; sku: string | null }
  }>
}) {
  return {
    id: po.id,
    status: po.status,
    total: po.total,
    notes: po.notes,
    createdAt: po.createdAt,
    orderedAt: po.orderedAt,
    receivedAt: po.receivedAt,
    createdById: po.createdById,
    supplier: po.supplier,
    receiveBranch: po.receiveBranch,
    items: po.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product.name,
      sku: i.product.sku,
      quantity: i.quantity,
      unitCost: i.unitCost,
      lineTotal: i.lineTotal,
      receivedQty: i.receivedQty,
    })),
  }
}

const poInclude = {
  supplier: { select: { id: true, name: true, phone: true } },
  receiveBranch: { select: { id: true, name: true } },
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
  },
} as const

/* ─── Suppliers CRUD ─────────────────────────────────────────── */

purchasingRouter.get(
  '/suppliers',
  requirePermission('inventory'),
  async (req: AuthedRequest, res) => {
    const suppliers = await prisma.supplier.findMany({
      where: { businessId: req.businessId! },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { purchaseOrders: true, products: true } },
      },
    })
    res.json({ suppliers: suppliers.map(serializeSupplier) })
  },
)

purchasingRouter.get(
  '/suppliers/:id',
  requirePermission('inventory'),
  async (req: AuthedRequest, res) => {
    const supplier = await prisma.supplier.findFirst({
      where: { id: req.params.id, businessId: req.businessId! },
      include: {
        _count: { select: { purchaseOrders: true, products: true } },
        products: {
          where: { active: true },
          select: { id: true, name: true, sku: true, costPrice: true },
          take: 50,
          orderBy: { name: 'asc' },
        },
        purchaseOrders: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            status: true,
            total: true,
            createdAt: true,
          },
        },
      },
    })
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' })
    res.json({
      supplier: serializeSupplier(supplier),
      products: supplier.products,
      recentOrders: supplier.purchaseOrders,
    })
  },
)

purchasingRouter.post(
  '/suppliers',
  requirePermission('inventory'),
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        name: z.string().min(2).max(120),
        phone: z.string().max(40).optional(),
        email: z.string().email().max(120).optional().or(z.literal('')),
        address: z.string().max(300).optional(),
        notes: z.string().max(500).optional(),
      })
      .safeParse(req.body)
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid supplier' })
    }
    const supplier = await prisma.supplier.create({
      data: {
        businessId: req.businessId!,
        name: body.data.name.trim(),
        phone: body.data.phone?.trim() || null,
        email: body.data.email?.trim() || null,
        address: body.data.address?.trim() || null,
        notes: body.data.notes?.trim() || null,
      },
    })
    await writeAudit('supplier.create', {
      businessId: req.businessId!,
      userId: req.auth!.sub,
      entity: 'Supplier',
      entityId: supplier.id,
      after: { name: supplier.name },
    })
    res.status(201).json({ supplier: serializeSupplier(supplier) })
  },
)

purchasingRouter.patch(
  '/suppliers/:id',
  requirePermission('inventory'),
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        name: z.string().min(2).max(120).optional(),
        phone: z.string().max(40).optional().nullable(),
        email: z.string().email().max(120).optional().or(z.literal('')).nullable(),
        address: z.string().max(300).optional().nullable(),
        notes: z.string().max(500).optional().nullable(),
      })
      .safeParse(req.body)
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid supplier update' })
    }

    const existing = await prisma.supplier.findFirst({
      where: { id: req.params.id, businessId: req.businessId! },
    })
    if (!existing) return res.status(404).json({ error: 'Supplier not found' })

    const supplier = await prisma.supplier.update({
      where: { id: existing.id },
      data: {
        name: body.data.name?.trim() ?? existing.name,
        phone:
          body.data.phone === undefined
            ? existing.phone
            : body.data.phone?.trim() || null,
        email:
          body.data.email === undefined
            ? existing.email
            : body.data.email?.trim() || null,
        address:
          body.data.address === undefined
            ? existing.address
            : body.data.address?.trim() || null,
        notes:
          body.data.notes === undefined
            ? existing.notes
            : body.data.notes?.trim() || null,
      },
    })

    await writeAudit('supplier.update', {
      businessId: req.businessId!,
      userId: req.auth!.sub,
      entity: 'Supplier',
      entityId: supplier.id,
      before: { name: existing.name },
      after: { name: supplier.name },
    })

    res.json({ supplier: serializeSupplier(supplier) })
  },
)

purchasingRouter.delete(
  '/suppliers/:id',
  requirePermission('inventory'),
  async (req: AuthedRequest, res) => {
    const existing = await prisma.supplier.findFirst({
      where: { id: req.params.id, businessId: req.businessId! },
      include: { _count: { select: { purchaseOrders: true } } },
    })
    if (!existing) return res.status(404).json({ error: 'Supplier not found' })
    if (existing._count.purchaseOrders > 0) {
      return res.status(400).json({
        error: 'Supplier has purchase orders — archive by clearing preferred links instead',
      })
    }
    await prisma.product.updateMany({
      where: { preferredSupplierId: existing.id, businessId: req.businessId! },
      data: { preferredSupplierId: null },
    })
    await prisma.supplier.delete({ where: { id: existing.id } })
    await writeAudit('supplier.delete', {
      businessId: req.businessId!,
      userId: req.auth!.sub,
      entity: 'Supplier',
      entityId: existing.id,
      before: { name: existing.name },
    })
    res.json({ ok: true })
  },
)

/* ─── Purchase orders ────────────────────────────────────────── */

purchasingRouter.get(
  '/orders',
  requirePermission('inventory'),
  async (req: AuthedRequest, res) => {
    const status =
      typeof req.query.status === 'string' ? req.query.status.trim() : ''
    const orders = await prisma.purchaseOrder.findMany({
      where: {
        businessId: req.businessId!,
        ...(status && PO_STATUSES.includes(status as (typeof PO_STATUSES)[number])
          ? { status }
          : {}),
      },
      include: poInclude,
      orderBy: { createdAt: 'desc' },
      take: 80,
    })
    res.json({ orders: orders.map(serializePo) })
  },
)

purchasingRouter.post(
  '/orders',
  requirePermission('inventory'),
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        supplierId: z.string().min(1).optional(),
        supplierName: z.string().min(2).max(120).optional(),
        receiveBranchId: z.string().min(1).optional(),
        notes: z.string().max(500).optional(),
        status: z.enum(['DRAFT', 'ORDERED']).default('ORDERED'),
        items: z.array(poItemSchema).min(1).max(100),
      })
      .safeParse(req.body)
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid purchase order' })
    }

    const businessId = req.businessId!
    await ensureBranchStockSeeded(businessId)

    let supplierId = body.data.supplierId
    if (!supplierId && body.data.supplierName) {
      const created = await prisma.supplier.create({
        data: {
          businessId,
          name: body.data.supplierName.trim(),
        },
      })
      supplierId = created.id
    }
    if (!supplierId) {
      return res.status(400).json({ error: 'Supplier required' })
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, businessId },
    })
    if (!supplier) return res.status(400).json({ error: 'Unknown supplier' })

    const branchId =
      body.data.receiveBranchId ||
      (await resolveStockBranchId(businessId, req.branchId))
    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, businessId },
      })
      if (!branch) return res.status(400).json({ error: 'Unknown receive branch' })
    }

    const productIds = body.data.items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { businessId, id: { in: productIds }, active: true },
      select: { id: true },
    })
    if (products.length !== new Set(productIds).size) {
      return res.status(400).json({ error: 'One or more products are invalid' })
    }

    const total = body.data.items.reduce(
      (s, i) => s + i.quantity * i.unitCost,
      0,
    )
    const status = body.data.status

    const order = await prisma.purchaseOrder.create({
      data: {
        businessId,
        supplierId: supplier.id,
        receiveBranchId: branchId,
        status,
        total: Number(total.toFixed(2)),
        notes: body.data.notes?.trim() || null,
        createdById: req.auth!.sub,
        orderedAt: status === 'ORDERED' ? new Date() : null,
        items: {
          create: body.data.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitCost: i.unitCost,
            lineTotal: Number((i.quantity * i.unitCost).toFixed(2)),
          })),
        },
      },
      include: poInclude,
    })

    await writeAudit('purchase_order.create', {
      businessId,
      userId: req.auth!.sub,
      entity: 'PurchaseOrder',
      entityId: order.id,
      after: {
        supplier: supplier.name,
        total: order.total,
        itemCount: body.data.items.length,
        receiveBranchId: branchId,
        status,
      },
    })

    res.status(201).json({ order: serializePo(order) })
  },
)

purchasingRouter.post(
  '/orders/:id/submit',
  requirePermission('inventory'),
  async (req: AuthedRequest, res) => {
    const businessId = req.businessId!
    const existing = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, businessId },
      include: poInclude,
    })
    if (!existing) return res.status(404).json({ error: 'Purchase order not found' })
    if (existing.status !== 'DRAFT') {
      return res.status(400).json({ error: 'Only draft orders can be submitted' })
    }
    const order = await prisma.purchaseOrder.update({
      where: { id: existing.id },
      data: { status: 'ORDERED', orderedAt: new Date() },
      include: poInclude,
    })
    await writeAudit('purchase_order.submit', {
      businessId,
      userId: req.auth!.sub,
      entity: 'PurchaseOrder',
      entityId: order.id,
      after: { status: 'ORDERED' },
    })
    res.json({ order: serializePo(order) })
  },
)

purchasingRouter.post(
  '/orders/:id/cancel',
  requirePermission('inventory'),
  async (req: AuthedRequest, res) => {
    const businessId = req.businessId!
    const existing = await prisma.purchaseOrder.findFirst({
      where: { id: req.params.id, businessId },
      include: { items: true },
    })
    if (!existing) return res.status(404).json({ error: 'Purchase order not found' })
    if (existing.status === 'RECEIVED') {
      return res.status(400).json({ error: 'Fully received orders cannot be cancelled' })
    }
    if (existing.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Already cancelled' })
    }
    const anyReceived = existing.items.some((i) => i.receivedQty > 0)
    if (anyReceived) {
      return res.status(400).json({
        error: 'Partially received — finish receiving or leave as PARTIAL',
      })
    }
    const order = await prisma.purchaseOrder.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED' },
      include: poInclude,
    })
    await writeAudit('purchase_order.cancel', {
      businessId,
      userId: req.auth!.sub,
      entity: 'PurchaseOrder',
      entityId: order.id,
      before: { status: existing.status },
      after: { status: 'CANCELLED' },
    })
    res.json({ order: serializePo(order) })
  },
)

/** Receive PO into a branch — creates PURCHASE stock movements + updates cost. */
purchasingRouter.post(
  '/orders/:id/receive',
  requirePermission('receive_stock'),
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        branchId: z.string().min(1).optional(),
        items: z
          .array(
            z.object({
              productId: z.string().min(1),
              receivedQty: z.number().int().positive().max(100_000),
            }),
          )
          .optional(),
        updateCosts: z.boolean().optional(),
      })
      .safeParse(req.body || {})
    if (!body.success) {
      return res.status(400).json({ error: 'Invalid receive payload' })
    }

    const businessId = req.businessId!
    await ensureBranchStockSeeded(businessId)
    const updateCosts = body.data.updateCosts !== false

    try {
      const result = await prisma.$transaction(async (tx) => {
        const order = await tx.purchaseOrder.findFirst({
          where: { id: req.params.id, businessId },
          include: { items: true, supplier: true },
        })
        if (!order) throw new Error('Purchase order not found')
        if (order.status === 'RECEIVED') {
          throw new Error('Already fully received')
        }
        if (order.status === 'CANCELLED') {
          throw new Error('Order is cancelled')
        }
        if (order.status === 'DRAFT') {
          throw new Error('Submit the draft order before receiving')
        }

        const branchId = await resolveStockBranchId(
          businessId,
          body.data.branchId || order.receiveBranchId || req.branchId,
          tx,
        )
        if (!branchId) throw new Error('No branch to receive into')

        const recvMap = body.data.items
          ? new Map(body.data.items.map((i) => [i.productId, i.receivedQty]))
          : null

        const costUpdates: Array<{
          productId: string
          unitCost: number
          qty: number
        }> = []

        for (const item of order.items) {
          const remaining = item.quantity - item.receivedQty
          if (remaining <= 0) continue
          const qty = recvMap ? (recvMap.get(item.productId) ?? 0) : remaining
          if (qty <= 0) continue
          if (qty > remaining) {
            throw new Error(`Over-receive on product line (max ${remaining})`)
          }

          await applyBranchStockDelta(tx, {
            businessId,
            branchId,
            productId: item.productId,
            delta: qty,
            movementType: 'PURCHASE',
            note: `PO ${order.id} · ${order.supplier.name}`,
            referenceId: order.id,
          })

          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: { receivedQty: item.receivedQty + qty },
          })

          costUpdates.push({
            productId: item.productId,
            unitCost: item.unitCost,
            qty,
          })
        }

        if (updateCosts) {
          for (const cu of costUpdates) {
            const product = await tx.product.findFirst({
              where: { id: cu.productId, businessId },
            })
            if (!product) continue
            const priorQty = Math.max(0, product.stockQuantity - cu.qty)
            const newCost =
              priorQty + cu.qty > 0
                ? (priorQty * product.costPrice + cu.qty * cu.unitCost) /
                  (priorQty + cu.qty)
                : cu.unitCost
            await tx.product.update({
              where: { id: product.id },
              data: {
                costPrice: Number(newCost.toFixed(4)),
                preferredSupplierId:
                  product.preferredSupplierId || order.supplierId,
              },
            })
          }
        }

        const fresh = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: order.id },
        })
        const allIn = fresh.every((i) => i.receivedQty >= i.quantity)

        return tx.purchaseOrder.update({
          where: { id: order.id },
          data: {
            status: allIn ? 'RECEIVED' : 'PARTIAL',
            receiveBranchId: branchId,
            receivedAt: allIn ? new Date() : order.receivedAt,
          },
          include: poInclude,
        })
      })

      await writeAudit('purchase_order.receive', {
        businessId,
        userId: req.auth!.sub,
        entity: 'PurchaseOrder',
        entityId: result.id,
        after: {
          status: result.status,
          receiveBranchId: result.receiveBranchId,
          updateCosts,
        },
      })

      res.json({ order: serializePo(result) })
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Receive failed',
      })
    }
  },
)
