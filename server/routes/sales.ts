import { Router } from 'express'
import { z } from 'zod'
import { createOwnerAlert } from '../alerts.js'
import {
  applyBranchStockDelta,
  ensureBranchStockSeeded,
  resolveStockBranchId,
} from '../branchStock.js'
import {
  businessHasManagerPin,
  isLargeDiscount,
  isLargeVoid,
  verifyManagerPin,
} from '../managerPin.js'
import {
  requireAuth,
  requireBusinessMember,
  requireManager,
  requirePermission,
  writeAudit,
  type AuthedRequest,
} from '../middleware.js'
import {
  computeEarnPoints,
  computeRedeem,
  parseLoyaltySettings,
} from '../loyalty.js'
import {
  deductBatchesFefo,
  parseBatchAlloc,
  restoreBatchesFromAlloc,
  type BatchAlloc,
} from '../pharmacy.js'
import { prisma } from '../prisma.js'
import { rateLimit } from '../rateLimit.js'
import { isQuickVoid, QUICK_VOID_MS } from '../trust.js'

const pinLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  key: (req) =>
    `mgr-pin:${(req as AuthedRequest).businessId || 'x'}:${(req as AuthedRequest).auth?.sub || req.ip}`,
})

/** Rate-limit only when a manager PIN is present in the body. */
function pinAttemptLimit(
  req: AuthedRequest,
  res: import('express').Response,
  next: import('express').NextFunction,
) {
  const pin = (req.body as { managerPin?: string } | undefined)?.managerPin
  if (!pin) return next()
  return pinLimiter(req, res, next)
}

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
  'CREDIT',
  'OTHER',
] as const

salesRouter.get('/', requirePermission('ledger'), async (req: AuthedRequest, res) => {
  const fromRaw = typeof req.query.from === 'string' ? req.query.from : ''
  const from = fromRaw ? new Date(fromRaw) : null
  const takeRaw = Number(req.query.take)
  const take = Number.isFinite(takeRaw)
    ? Math.min(Math.max(Math.floor(takeRaw), 1), 500)
    : 200
  const soldById =
    typeof req.query.soldById === 'string' ? req.query.soldById.trim() : ''

  const sales = await prisma.sale.findMany({
    where: {
      businessId: req.businessId!,
      ...(from && !Number.isNaN(from.getTime())
        ? { createdAt: { gte: from } }
        : {}),
      ...(soldById ? { soldById } : {}),
    },
    include: {
      items: {
        select: {
          id: true,
          saleId: true,
          productId: true,
          productName: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
      soldBy: { select: { id: true, fullName: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take,
  })
  res.json({ sales })
})

salesRouter.get('/:id', requirePermission('ledger'), async (req: AuthedRequest, res) => {
  const sale = await prisma.sale.findFirst({
    where: { id: req.params.id, businessId: req.businessId! },
    include: {
      items: true,
      soldBy: { select: { id: true, fullName: true } },
      branch: { select: { id: true, name: true } },
    },
  })
  if (!sale) return res.status(404).json({ error: 'Sale not found' })
  res.json({ sale })
})

salesRouter.post(
  '/',
  requirePermission('sell'),
  pinAttemptLimit,
  async (req: AuthedRequest, res) => {
  const body = z
    .object({
      discount: z.number().nonnegative().default(0),
      discountReason: z.string().max(200).optional(),
      managerPin: z.string().max(12).optional(),
      paymentMethod: z.enum(paymentMethods),
      notes: z.string().max(2000).optional(),
      customerId: z.string().optional(),
      /** Redeem loyalty points (server caps against balance + subtotal). */
      loyaltyPtsRedeemed: z.number().int().nonnegative().max(1_000_000).optional(),
      /** Required when cart includes Rx items (pharmacy). */
      prescriptionNote: z.string().max(200).optional(),
      clientSaleId: z.string().min(8).max(80).optional(),
      allowStockConflict: z.boolean().optional(),
      /** Original device timestamp for offline sales */
      occurredAt: z.string().max(40).optional(),
      deviceId: z.string().max(80).optional(),
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

  if (
    body.data.paymentMethod === 'CREDIT' &&
    !req.permissions?.includes('credit_sales')
  ) {
    return res.status(403).json({ error: 'Missing permission: credit_sales' })
  }

  if (body.data.paymentMethod === 'CREDIT' && !body.data.customerId) {
    return res.status(400).json({ error: 'Credit sale requires a customer' })
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
    const saleTx = await prisma.$transaction(async (tx) => {
      let subtotal = 0
      const prepared: {
        productId: string
        productName: string
        quantity: number
        unitPrice: number
        lineTotal: number
        costPrice: number
      }[] = []

      let needsRx = false
      for (const line of body.data.lines) {
        const product = await tx.product.findFirst({
          where: { id: line.productId, businessId, active: true },
        })
        if (!product) throw new Error('Product missing from catalogue')
        if (product.requiresPrescription) needsRx = true
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
          if (!body.data.allowStockConflict) {
            void createOwnerAlert({
              businessId,
              type: 'LOW_STOCK',
              title: 'Stock conflict on sync',
              body: `${product.name}: needed ${line.quantity}, had ${product.stockQuantity}. Open Conflicts.`,
              meta: {
                productId: product.id,
                clientSaleId: body.data.clientSaleId,
              },
            })
            throw new Error(
              `Stock conflict: ${product.name} needs ${line.quantity}, only ${product.stockQuantity} left`,
            )
          }
          // Offline recovery: complete sale, allow shortfall — conflict stays OPEN for manager
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

      const bizEarly = await tx.business.findUnique({
        where: { id: businessId },
        select: { settingsJson: true, modulesJson: true, industry: true },
      })
      const { parseModulesJson } = await import('../industries.js')
      const shopModules = parseModulesJson(
        bizEarly?.modulesJson,
        bizEarly?.industry,
      )
      const rxNote = (body.data.prescriptionNote || '').trim()
      if (needsRx && shopModules.pharmacy && rxNote.length < 3) {
        throw new Error(
          'Prescription / Rx note required for prescription items (pharmacy)',
        )
      }

      const discount = Math.min(discountRequested, subtotal)
      const total = Number((subtotal - discount).toFixed(2))
      const receiptNo = `NX-${Date.now().toString().slice(-8)}`
      const largeDiscount = isLargeDiscount(discount, subtotal)
      const discountReason = (body.data.discountReason || '').trim()
      if (largeDiscount && discountReason.length < 3) {
        throw new Error(
          'Large discount needs a short reason (owner Trust / Audit)',
        )
      }
      const offlineReplay = Boolean(body.data.clientSaleId)
      if (largeDiscount && (await businessHasManagerPin(businessId))) {
        if (offlineReplay && discountReason.length >= 3 && !body.data.managerPin) {
          // Offline queue cannot safely store PIN — reason required; flag in notes/audit
        } else {
          const pinCheck = await verifyManagerPin(
            businessId,
            body.data.managerPin,
          )
          if (!pinCheck.ok) throw new Error(pinCheck.error)
        }
      }

      const noteParts: string[] = []
      if (body.data.notes?.trim()) noteParts.push(body.data.notes.trim())
      if (discountReason) noteParts.push(`Discount reason: ${discountReason}`)
      if (rxNote) noteParts.push(`Rx: ${rxNote}`)
      if (
        offlineReplay &&
        largeDiscount &&
        discountReason &&
        !body.data.managerPin
      ) {
        noteParts.push('Offline sync · large discount without live PIN')
      }
      if (body.data.deviceId) {
        noteParts.push(`Device ${body.data.deviceId.slice(0, 8)}`)
      }

      let creditCustomerName: string | undefined
      let loyaltyEarned = 0
      let loyaltyRedeemed = 0
      let loyaltyCampaign: string | null = null

      const loyaltySettings = parseLoyaltySettings(bizEarly?.settingsJson)

      if (body.data.paymentMethod === 'CREDIT' && body.data.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: body.data.customerId, businessId },
        })
        if (!customer) throw new Error('Customer not found for credit sale')
        if (customer.creditLimit <= 0) {
          throw new Error('Customer has no credit limit — set one first')
        }
        const nextBalance = Number((customer.balance + total).toFixed(2))
        if (nextBalance > customer.creditLimit + 0.001) {
          throw new Error(
            `Credit limit exceeded: balance ${customer.balance.toFixed(2)} + ${total.toFixed(2)} > limit ${customer.creditLimit.toFixed(2)}`,
          )
        }
        await tx.customer.update({
          where: { id: customer.id },
          data: { balance: nextBalance },
        })
        creditCustomerName = customer.fullName
        noteParts.push(`Credit to ${customer.fullName}`)
      }

      if (body.data.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: body.data.customerId, businessId },
        })
        if (!customer) throw new Error('Customer not found')

        const redeemReq = body.data.loyaltyPtsRedeemed || 0
        if (redeemReq > 0) {
          const redeemed = computeRedeem(
            redeemReq,
            customer.loyaltyPts,
            subtotal,
            loyaltySettings,
          )
          if (redeemed.pts > 0) {
            if (discount + 0.001 < redeemed.kwacha) {
              throw new Error(
                `Loyalty redeem needs at least ZMW ${redeemed.kwacha} discount`,
              )
            }
            loyaltyRedeemed = redeemed.pts
            await tx.customer.update({
              where: { id: customer.id },
              data: { loyaltyPts: { decrement: redeemed.pts } },
            })
            noteParts.push(`Loyalty −${redeemed.pts} pts (−ZMW ${redeemed.kwacha})`)
          }
        }

        const earn = computeEarnPoints(total, loyaltySettings)
        if (earn.points > 0) {
          loyaltyEarned = earn.points
          loyaltyCampaign = earn.campaignName
          await tx.customer.update({
            where: { id: customer.id },
            data: { loyaltyPts: { increment: earn.points } },
          })
          noteParts.push(
            earn.campaignName
              ? `Loyalty +${earn.points} pts (${earn.campaignName})`
              : `Loyalty +${earn.points} pts`,
          )
        }
      }

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
          notes: noteParts.length ? noteParts.join(' · ') : undefined,
          receiptNo,
        },
      })

      void creditCustomerName

      await ensureBranchStockSeeded(businessId, tx)
      const stockBranchId = await resolveStockBranchId(
        businessId,
        req.branchId,
        tx,
      )

      const itemRows: Array<{
        productId: string
        productName: string
        quantity: number
        unitPrice: number
        lineTotal: number
        costPrice: number
        batchAllocJson: string
      }> = []

      for (const p of prepared) {
        let alloc: BatchAlloc[] = []
        try {
          alloc = await deductBatchesFefo(tx, {
            businessId,
            productId: p.productId,
            quantity: p.quantity,
            productName: p.productName,
          })
        } catch (err) {
          if (!body.data.allowStockConflict) throw err
          // Offline shortfall: skip FEFO if lots insufficient
          alloc = []
        }

        itemRows.push({
          productId: p.productId,
          productName: p.productName,
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          lineTotal: p.lineTotal,
          costPrice: p.costPrice,
          batchAllocJson: JSON.stringify(alloc),
        })

        if (stockBranchId) {
          await applyBranchStockDelta(tx, {
            businessId,
            branchId: stockBranchId,
            productId: p.productId,
            delta: -p.quantity,
            movementType: 'SALE',
            referenceId: created.id,
            note: `Sale ${receiptNo}`,
            allowNegative: true,
          })
        } else {
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
      }

      await tx.saleItem.createMany({
        data: itemRows.map((row) => ({
          saleId: created.id,
          ...row,
        })),
      })

      const sale = await tx.sale.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          items: true,
          soldBy: { select: { id: true, fullName: true } },
          branch: { select: { id: true, name: true } },
          customer: { select: { id: true, fullName: true } },
        },
      })

      return {
        sale,
        loyaltyEarned,
        loyaltyRedeemed,
        loyaltyCampaign,
      }
    })

    const { sale, loyaltyEarned, loyaltyRedeemed, loyaltyCampaign } = saleTx
    const discountReason = (body.data.discountReason || '').trim()
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
        cashier: sale.soldBy?.fullName,
        branchName: sale.branch?.name,
        customerId: sale.customerId || undefined,
        customerName: sale.customer?.fullName || undefined,
        creditIssuance: sale.paymentMethod === 'CREDIT' || undefined,
        loyaltyEarned: loyaltyEarned || undefined,
        loyaltyRedeemed: loyaltyRedeemed || undefined,
        loyaltyCampaign: loyaltyCampaign || undefined,
        discountReason: discountReason || undefined,
        largeDiscount: sale.discount > 0 && discountReason ? true : undefined,
        offlineSync: body.data.clientSaleId ? true : undefined,
        occurredAt: body.data.occurredAt || undefined,
        deviceId: body.data.deviceId || undefined,
        allowStockConflict: body.data.allowStockConflict || undefined,
        name: sale.items[0]?.productName
          ? sale.items.length > 1
            ? `${sale.items[0].productName} +${sale.items.length - 1}`
            : sale.items[0].productName
          : undefined,
      },
    })

    if (body.data.allowStockConflict && body.data.clientSaleId) {
      void createOwnerAlert({
        businessId,
        type: 'LOW_STOCK',
        title: 'Offline sale accepted with stock shortfall',
        body: `Sale ${sale.receiptNo} synced with allow-shortfall. Review Conflicts.`,
        meta: { saleId: sale.id, clientSaleId: body.data.clientSaleId },
      })
    }

    res.status(201).json({ sale })
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Sale failed',
    })
  }
},
)

salesRouter.post(
  '/:id/void',
  requirePermission('void_sales'),
  pinAttemptLimit,
  async (req: AuthedRequest, res) => {
    const businessId = req.businessId!
    const reasonBody = z
      .object({
        reason: z.string().min(3).max(300),
        managerPin: z.string().max(12).optional(),
      })
      .safeParse(req.body)
    if (!reasonBody.success) {
      return res.status(400).json({
        error: 'Void requires a short reason (visible on Audit / Trust)',
      })
    }
    const voidReason = reasonBody.data.reason.trim()

    try {
      const existingPre = await prisma.sale.findFirst({
        where: { id: req.params.id, businessId },
        select: { total: true, status: true, createdAt: true },
      })
      if (!existingPre) throw new Error('Sale not found')
      if (existingPre.status !== 'COMPLETED') {
        throw new Error('Only completed sales can be voided')
      }
      if (
        isLargeVoid(existingPre.total) &&
        (await businessHasManagerPin(businessId))
      ) {
        const pinCheck = await verifyManagerPin(
          businessId,
          reasonBody.data.managerPin,
        )
        if (!pinCheck.ok) throw new Error(pinCheck.error)
      }

      const sale = await prisma.$transaction(async (tx) => {
        const existing = await tx.sale.findFirst({
          where: { id: req.params.id, businessId },
          include: {
            items: true,
            soldBy: { select: { id: true, fullName: true } },
            branch: { select: { id: true, name: true } },
          },
        })
        if (!existing) throw new Error('Sale not found')
        if (existing.status !== 'COMPLETED') {
          throw new Error('Only completed sales can be voided')
        }

        await ensureBranchStockSeeded(businessId, tx)
        const stockBranchId = await resolveStockBranchId(
          businessId,
          existing.branchId,
          tx,
        )

        for (const item of existing.items) {
          const alloc = parseBatchAlloc(item.batchAllocJson)
          if (alloc.length) {
            await restoreBatchesFromAlloc(tx, {
              businessId,
              productId: item.productId,
              alloc,
            })
          }
          if (stockBranchId) {
            await applyBranchStockDelta(tx, {
              businessId,
              branchId: stockBranchId,
              productId: item.productId,
              delta: item.quantity,
              movementType: 'RETURN',
              referenceId: existing.id,
              note: `Sale voided: ${voidReason}`,
            })
          } else {
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
                note: `Sale voided: ${voidReason}`,
              },
            })
          }
        }

        if (existing.paymentMethod === 'CREDIT' && existing.customerId) {
          const customer = await tx.customer.findFirst({
            where: { id: existing.customerId, businessId },
          })
          if (customer) {
            await tx.customer.update({
              where: { id: customer.id },
              data: {
                balance: Number(
                  Math.max(0, customer.balance - existing.total).toFixed(2),
                ),
              },
            })
          }
        }

        const priorNotes = existing.notes?.trim() || ''
        const voidNote = `Void reason: ${voidReason}`
        return tx.sale.update({
          where: { id: existing.id },
          data: {
            status: 'VOIDED',
            notes: priorNotes ? `${priorNotes} · ${voidNote}` : voidNote,
          },
          include: {
            items: true,
            soldBy: { select: { id: true, fullName: true } },
            branch: { select: { id: true, name: true } },
          },
        })
      })

      const quick = isQuickVoid({
        status: 'VOIDED',
        createdAt: existingPre.createdAt,
        updatedAt: sale.updatedAt,
      })

      await writeAudit('sale.void', {
        businessId,
        userId: req.auth!.sub,
        entity: 'Sale',
        entityId: sale.id,
        before: {
          status: 'COMPLETED',
          total: sale.total,
          cashier: sale.soldBy?.fullName,
          branchName: sale.branch?.name,
        },
        after: {
          status: 'VOIDED',
          reason: voidReason,
          cashier: sale.soldBy?.fullName,
          branchName: sale.branch?.name,
          receiptNo: sale.receiptNo,
          total: sale.total,
          quickVoid: quick || undefined,
          minutesAfterSale: Math.round(
            (sale.updatedAt.getTime() - existingPre.createdAt.getTime()) /
              60000,
          ),
        },
        meta: { reason: voidReason, quickVoid: quick },
      })

      if (quick) {
        await createOwnerAlert({
          businessId,
          type: 'RISK',
          title: 'Void soon after sale',
          body: `${sale.soldBy?.fullName || 'Cashier'} voided ${sale.receiptNo || 'a sale'} (${sale.total.toFixed(2)}) within ${Math.ceil(QUICK_VOID_MS / 60000)} minutes — ${voidReason}.`,
          meta: { saleId: sale.id, quickVoid: true },
        })
      }

      // High void rate signal: ≥3 voids in last 24h for this cashier
      if (sale.soldById) {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        const voidCount = await prisma.sale.count({
          where: {
            businessId,
            soldById: sale.soldById,
            status: 'VOIDED',
            updatedAt: { gte: dayAgo },
          },
        })
        if (voidCount >= 3) {
          await createOwnerAlert({
            businessId,
            type: 'RISK',
            title: 'High void rate today',
            body: `${sale.soldBy?.fullName || 'Cashier'} has ${voidCount} voids in 24 hours.`,
            meta: { soldById: sale.soldById, voidCount },
          })
        }
      }

      res.json({ sale })
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Void failed',
      })
    }
  },
)
