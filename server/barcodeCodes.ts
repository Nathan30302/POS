import { randomInt } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'

/** GS1 restricted-circulation prefix for in-store / internal barcodes. */
const STORE_PREFIX = '20'

export function ean13CheckDigit(digits12: string): string {
  if (!/^\d{12}$/.test(digits12)) {
    throw new Error('EAN-13 body must be 12 digits')
  }
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const n = Number(digits12[i])
    sum += i % 2 === 0 ? n : n * 3
  }
  return String((10 - (sum % 10)) % 10)
}

export function makeEan13(body12: string): string {
  return `${body12}${ean13CheckDigit(body12)}`
}

/** Random unique-looking EAN-13 under the store prefix (not a manufacturer GTIN). */
export function randomStoreEan13(): string {
  const mid = String(randomInt(0, 10_000_000_000)).padStart(10, '0')
  return makeEan13(`${STORE_PREFIX}${mid}`)
}

type Db = PrismaClient | Prisma.TransactionClient

/** Collect codes already used by products or previous label batches. */
export async function usedBarcodeSet(
  db: Db,
  businessId: string,
): Promise<Set<string>> {
  const [products, pool] = await Promise.all([
    db.product.findMany({
      where: { businessId, barcode: { not: null } },
      select: { barcode: true },
    }),
    db.barcodeCode.findMany({
      where: { businessId },
      select: { code: true },
    }),
  ])
  const used = new Set<string>()
  for (const p of products) {
    if (p.barcode) used.add(p.barcode)
  }
  for (const c of pool) used.add(c.code)
  return used
}

export async function generateUniqueEan13Batch(
  db: Db,
  businessId: string,
  count: number,
): Promise<string[]> {
  if (count < 1 || count > 500) {
    throw new Error('Count must be between 1 and 500')
  }
  const used = await usedBarcodeSet(db, businessId)
  const codes: string[] = []
  let attempts = 0
  const maxAttempts = count * 40 + 200

  while (codes.length < count && attempts < maxAttempts) {
    attempts += 1
    const code = randomStoreEan13()
    if (used.has(code)) continue
    used.add(code)
    codes.push(code)
  }

  if (codes.length < count) {
    throw new Error('Could not generate enough unique barcodes — try again')
  }
  return codes
}

/**
 * When a product barcode is set/changed, claim matching pool codes
 * and release previously claimed codes that no longer match.
 */
export async function syncBarcodePoolClaim(
  db: Db,
  businessId: string,
  productId: string,
  barcode: string | null | undefined,
): Promise<void> {
  const trimmed = (barcode || '').trim() || null

  await db.barcodeCode.updateMany({
    where: {
      businessId,
      productId,
      ...(trimmed ? { code: { not: trimmed } } : {}),
    },
    data: {
      status: 'AVAILABLE',
      productId: null,
      claimedAt: null,
    },
  })

  if (!trimmed) return

  await db.barcodeCode.updateMany({
    where: {
      businessId,
      code: trimmed,
      status: 'AVAILABLE',
    },
    data: {
      status: 'CLAIMED',
      productId,
      claimedAt: new Date(),
    },
  })
}

/** Mark batch EXHAUSTED when every code is claimed. */
export async function refreshBatchExhaustion(
  db: Db,
  batchId: string,
): Promise<void> {
  const remaining = await db.barcodeCode.count({
    where: { batchId, status: 'AVAILABLE' },
  })
  if (remaining > 0) return
  await db.barcodeBatch.updateMany({
    where: {
      id: batchId,
      status: { not: 'EXHAUSTED' },
    },
    data: {
      status: 'EXHAUSTED',
      exhaustedAt: new Date(),
    },
  })
}
