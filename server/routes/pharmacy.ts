import { Router, type NextFunction, type Response } from 'express'
import { z } from 'zod'
import {
  requireAuth,
  requireBusinessMember,
  requirePermission,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import {
  hasLotModule,
  parseModulesJson,
  PHARMACY_CATEGORIES,
} from '../industries.js'
import {
  daysFromNow,
  EXPIRY_WARN_DAYS,
  receiveIntoBatch,
  scanExpiringAndAlert,
  startOfToday,
} from '../pharmacy.js'
import { prisma } from '../prisma.js'
import {
  applyBranchStockDelta,
  ensureBranchStockSeeded,
  resolveStockBranchId,
} from '../branchStock.js'

export const pharmacyRouter = Router()
pharmacyRouter.use(requireAuth, requireBusinessMember)

async function loadBizModules(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { industry: true, modulesJson: true, settingsJson: true },
  })
  const modules = parseModulesJson(business?.modulesJson, business?.industry)
  return { business, modules }
}

async function requireLots(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
) {
  const { modules } = await loadBizModules(req.businessId!)
  if (!hasLotModule(modules)) {
    return res.status(403).json({
      error:
        'Lot / expiry module is not enabled for this shop type. Set industry to Pharmacy or Grocery in Settings.',
    })
  }
  next()
}

pharmacyRouter.get('/meta', async (req: AuthedRequest, res) => {
  const { business, modules } = await loadBizModules(req.businessId!)
  const settings = JSON.parse(business?.settingsJson || '{}') as {
    pharmacy?: { enabled?: boolean; warnDays?: number }
    perishables?: { enabled?: boolean; warnDays?: number }
  }
  const enabled = hasLotModule(modules)
  res.json({
    enabled,
    pharmacy: modules.pharmacy,
    perishables: modules.perishables,
    industry: business?.industry || 'retail',
    warnDays:
      settings.pharmacy?.warnDays ||
      settings.perishables?.warnDays ||
      EXPIRY_WARN_DAYS,
    categories: PHARMACY_CATEGORIES,
    label: modules.pharmacy
      ? 'Pharmacy'
      : modules.perishables
        ? 'Perishables'
        : 'Lots',
  })
})

pharmacyRouter.get(
  '/expiring',
  requirePermission('inventory'),
  requireLots,
  async (req: AuthedRequest, res) => {
    const days = Math.min(
      365,
      Math.max(1, Number(req.query.days) || EXPIRY_WARN_DAYS),
    )
    const includeExpired = req.query.expired === '1'
    const until = daysFromNow(days)
    const today = startOfToday()

    const batches = await prisma.productBatch.findMany({
      where: {
        businessId: req.businessId!,
        quantity: { gt: 0 },
        expiryDate: includeExpired
          ? { lte: until }
          : { gte: today, lte: until },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            barcode: true,
            requiresPrescription: true,
            stockQuantity: true,
          },
        },
      },
      orderBy: { expiryDate: 'asc' },
      take: 200,
    })

    res.json({
      days,
      batches: batches.map((b) => ({
        id: b.id,
        productId: b.productId,
        productName: b.product.name,
        barcode: b.product.barcode,
        requiresPrescription: b.product.requiresPrescription,
        lotNumber: b.lotNumber,
        expiryDate: b.expiryDate,
        quantity: b.quantity,
        costPrice: b.costPrice,
        daysLeft: Math.ceil(
          (b.expiryDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
        ),
        expired: b.expiryDate < today,
      })),
    })
  },
)

pharmacyRouter.post(
  '/scan-alerts',
  requirePermission('inventory'),
  requireLots,
  async (req: AuthedRequest, res) => {
    const rows = await scanExpiringAndAlert(req.businessId!)
    res.json({ alerted: rows.length })
  },
)

/** Receive stock into a dated lot (pharmacy / perishables). */
pharmacyRouter.post(
  '/receive',
  requirePermission('receive_stock'),
  requireLots,
  async (req: AuthedRequest, res) => {
    const body = z
      .object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(1_000_000),
        lotNumber: z.string().min(1).max(64),
        expiryDate: z.string().min(8),
        costPrice: z.number().nonnegative().optional(),
        note: z.string().max(200).optional(),
      })
      .safeParse(req.body)
    if (!body.success) {
      return res.status(400).json({
        error: 'productId, quantity, lotNumber, and expiryDate required',
      })
    }

    const businessId = req.businessId!
    const expiryDate = new Date(body.data.expiryDate)
    if (Number.isNaN(expiryDate.getTime())) {
      return res.status(400).json({ error: 'Invalid expiryDate' })
    }

    const product = await prisma.product.findFirst({
      where: { id: body.data.productId, businessId, active: true },
    })
    if (!product) return res.status(404).json({ error: 'Product not found' })

    try {
      const result = await prisma.$transaction(async (tx) => {
        const batch = await receiveIntoBatch(tx, {
          businessId,
          productId: product.id,
          lotNumber: body.data.lotNumber,
          expiryDate,
          quantity: body.data.quantity,
          costPrice: body.data.costPrice,
          note: body.data.note,
        })

        await ensureBranchStockSeeded(businessId, tx)
        const branchId = await resolveStockBranchId(
          businessId,
          req.branchId,
          tx,
        )
        if (branchId) {
          await applyBranchStockDelta(tx, {
            businessId,
            branchId,
            productId: product.id,
            delta: body.data.quantity,
            movementType: 'PURCHASE',
            note:
              body.data.note ||
              `Lot ${body.data.lotNumber} exp ${expiryDate.toISOString().slice(0, 10)}`,
          })
        } else {
          await tx.product.update({
            where: { id: product.id },
            data: { stockQuantity: { increment: body.data.quantity } },
          })
          await tx.stockMovement.create({
            data: {
              businessId,
              productId: product.id,
              type: 'PURCHASE',
              quantity: body.data.quantity,
              note:
                body.data.note ||
                `Lot ${body.data.lotNumber} exp ${expiryDate.toISOString().slice(0, 10)}`,
            },
          })
        }

        const updated = await tx.product.findUniqueOrThrow({
          where: { id: product.id },
        })
        return { batch, product: updated }
      })

      await writeAudit('pharmacy.receive_lot', {
        businessId,
        userId: req.auth!.sub,
        entity: 'ProductBatch',
        entityId: result.batch.id,
        after: {
          productId: product.id,
          name: product.name,
          lotNumber: result.batch.lotNumber,
          expiryDate: result.batch.expiryDate,
          quantity: body.data.quantity,
          stockQuantity: result.product.stockQuantity,
        },
      })

      res.status(201).json(result)
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Receive failed',
      })
    }
  },
)
