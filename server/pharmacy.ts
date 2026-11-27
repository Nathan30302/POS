import type { Prisma } from '@prisma/client'
import { createOwnerAlert } from './alerts.js'

type Tx = Prisma.TransactionClient

export type BatchAlloc = {
  batchId: string
  lotNumber: string
  qty: number
  expiryDate: string
}

export function isPharmacyIndustry(industry: string | null | undefined) {
  const s = (industry || '').toLowerCase()
  return (
    s.includes('pharm') ||
    s.includes('chemist') ||
    s.includes('drugstore') ||
    s === 'clinic' ||
    s === 'dispensary'
  )
}

export const PHARMACY_CATEGORIES = [
  'Analgesics',
  'Antibiotics',
  'Antimalarials',
  'Cough & cold',
  'Vitamins',
  'Dermatology',
  'Diabetes',
  'Hypertension',
  'First aid',
  'OTC',
  'Prescription',
  'General',
] as const

/** Days until expiry considered "soon" for alerts / Pulse. */
export const EXPIRY_WARN_DAYS = 90

export function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function daysFromNow(days: number) {
  const d = startOfToday()
  d.setDate(d.getDate() + days)
  return d
}

/**
 * FEFO: deduct from soonest-expiring non-expired lots first.
 * Throws if sellable batch qty is insufficient when batches exist.
 */
export async function deductBatchesFefo(
  tx: Tx,
  opts: {
    businessId: string
    productId: string
    quantity: number
    productName?: string
  },
): Promise<BatchAlloc[]> {
  const need = Math.floor(opts.quantity)
  if (need <= 0) return []

  const today = startOfToday()
  const batches = await tx.productBatch.findMany({
    where: {
      businessId: opts.businessId,
      productId: opts.productId,
      quantity: { gt: 0 },
      expiryDate: { gte: today },
    },
    orderBy: [{ expiryDate: 'asc' }, { receivedAt: 'asc' }],
  })

  if (batches.length === 0) {
    // No live lots — allow product-level stock (non-batch / legacy)
    return []
  }

  const available = batches.reduce((s, b) => s + b.quantity, 0)
  if (available < need) {
    throw new Error(
      `Insufficient non-expired stock for ${opts.productName || 'product'}: need ${need}, sellable lots have ${available}`,
    )
  }

  let remaining = need
  const alloc: BatchAlloc[] = []
  for (const batch of batches) {
    if (remaining <= 0) break
    const take = Math.min(batch.quantity, remaining)
    await tx.productBatch.update({
      where: { id: batch.id },
      data: { quantity: { decrement: take } },
    })
    alloc.push({
      batchId: batch.id,
      lotNumber: batch.lotNumber,
      qty: take,
      expiryDate: batch.expiryDate.toISOString(),
    })
    remaining -= take
  }

  await syncProductExpiryFromBatches(tx, opts.productId)
  return alloc
}

/** Restore lots after void using recorded allocations when present. */
export async function restoreBatchesFromAlloc(
  tx: Tx,
  opts: {
    businessId: string
    productId: string
    alloc: BatchAlloc[]
  },
): Promise<void> {
  for (const row of opts.alloc) {
    if (row.qty <= 0) continue
    const existing = await tx.productBatch.findFirst({
      where: { id: row.batchId, businessId: opts.businessId },
    })
    if (existing) {
      await tx.productBatch.update({
        where: { id: existing.id },
        data: { quantity: { increment: row.qty } },
      })
    } else {
      await tx.productBatch.create({
        data: {
          businessId: opts.businessId,
          productId: opts.productId,
          lotNumber: row.lotNumber || `VOID-${row.batchId.slice(0, 6)}`,
          expiryDate: new Date(row.expiryDate),
          quantity: row.qty,
          note: 'Restored from voided sale',
        },
      })
    }
  }
  await syncProductExpiryFromBatches(tx, opts.productId)
}

export async function syncProductExpiryFromBatches(
  tx: Tx,
  productId: string,
): Promise<void> {
  const today = startOfToday()
  const next = await tx.productBatch.findFirst({
    where: {
      productId,
      quantity: { gt: 0 },
      expiryDate: { gte: today },
    },
    orderBy: { expiryDate: 'asc' },
    select: { expiryDate: true },
  })
  await tx.product.update({
    where: { id: productId },
    data: {
      expiryDate: next?.expiryDate ?? null,
      trackExpiry: true,
    },
  })
}

export function parseBatchAlloc(json: string | null | undefined): BatchAlloc[] {
  try {
    const raw = JSON.parse(json || '[]') as BatchAlloc[]
    if (!Array.isArray(raw)) return []
    return raw.filter((r) => r && r.batchId && r.qty > 0)
  } catch {
    return []
  }
}

/** Create or merge a received lot; bumps product trackExpiry. */
export async function receiveIntoBatch(
  tx: Tx,
  opts: {
    businessId: string
    productId: string
    lotNumber: string
    expiryDate: Date
    quantity: number
    costPrice?: number | null
    note?: string
  },
) {
  const lotNumber = opts.lotNumber.trim().slice(0, 64)
  if (!lotNumber) throw new Error('Lot / batch number required')
  if (!(opts.expiryDate instanceof Date) || Number.isNaN(opts.expiryDate.getTime())) {
    throw new Error('Valid expiry date required')
  }
  if (opts.expiryDate < startOfToday()) {
    throw new Error('Cannot receive stock that is already expired')
  }
  const qty = Math.floor(opts.quantity)
  if (qty <= 0) throw new Error('Quantity must be > 0')

  const same = await tx.productBatch.findFirst({
    where: {
      businessId: opts.businessId,
      productId: opts.productId,
      lotNumber,
      expiryDate: opts.expiryDate,
    },
  })

  let batch
  if (same) {
    batch = await tx.productBatch.update({
      where: { id: same.id },
      data: {
        quantity: { increment: qty },
        costPrice:
          opts.costPrice !== undefined ? opts.costPrice : same.costPrice,
        note: opts.note || same.note,
      },
    })
  } else {
    batch = await tx.productBatch.create({
      data: {
        businessId: opts.businessId,
        productId: opts.productId,
        lotNumber,
        expiryDate: opts.expiryDate,
        quantity: qty,
        costPrice: opts.costPrice ?? null,
        note: opts.note || null,
      },
    })
  }

  await tx.product.update({
    where: { id: opts.productId },
    data: { trackExpiry: true },
  })
  await syncProductExpiryFromBatches(tx, opts.productId)
  return batch
}

export async function scanExpiringAndAlert(businessId: string) {
  const { prisma } = await import('./prisma.js')
  const until = daysFromNow(EXPIRY_WARN_DAYS)
  const rows = await prisma.productBatch.findMany({
    where: {
      businessId,
      quantity: { gt: 0 },
      expiryDate: { lte: until, gte: startOfToday() },
    },
    select: {
      id: true,
      lotNumber: true,
      quantity: true,
      expiryDate: true,
      product: { select: { name: true } },
    },
    orderBy: { expiryDate: 'asc' },
    take: 20,
  })
  if (rows.length === 0) return rows

  const top = rows[0]
  await createOwnerAlert({
    businessId,
    type: 'EXPIRY',
    title: `${rows.length} lot${rows.length === 1 ? '' : 's'} expiring within ${EXPIRY_WARN_DAYS}d`,
    body: `Soonest: ${top.product.name} lot ${top.lotNumber} · ${top.quantity} units · ${top.expiryDate.toISOString().slice(0, 10)}`,
    meta: { count: rows.length, until: until.toISOString() },
  })
  return rows
}
