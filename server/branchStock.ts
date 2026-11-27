import type { Prisma, StockMovementType } from '@prisma/client'
import { prisma } from './prisma.js'

type Tx = Prisma.TransactionClient

/** Sentinel for Head Office / all-branches scope (client header). */
export const ORG_BRANCH_SENTINEL = '__all__'

export async function resolveMainBranchId(
  businessId: string,
  tx: Tx | typeof prisma = prisma,
): Promise<string | null> {
  const main = await tx.branch.findFirst({
    where: { businessId, isMain: true },
    select: { id: true },
  })
  if (main) return main.id
  const any = await tx.branch.findFirst({
    where: { businessId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  return any?.id ?? null
}

/**
 * Soft recovery: if a shop has zero branches, create Main Branch and attach
 * owner memberships that still have a null branchId.
 * Returns the main (or oldest) branch id, or null if business is missing.
 * Does not overwrite intentional null branchId when branches already exist
 * (Head Office / org view).
 */
export async function ensureMainBranch(
  businessId: string,
  tx: Tx | typeof prisma = prisma,
): Promise<string | null> {
  const existingId = await resolveMainBranchId(businessId, tx)
  if (existingId) return existingId

  const business = await tx.business.findUnique({
    where: { id: businessId },
    select: { id: true },
  })
  if (!business) return null

  const branch = await tx.branch.create({
    data: {
      businessId,
      name: 'Main Branch',
      isMain: true,
    },
  })

  await tx.membership.updateMany({
    where: {
      businessId,
      branchId: null,
      role: { in: ['OWNER', 'ADMIN'] },
      active: true,
    },
    data: { branchId: branch.id },
  })

  return branch.id
}

/**
 * Ensure legacy Product.stockQuantity is mirrored onto the main branch once
 * so transfers / HO stock have a source of truth without a full rebuild.
 */
export async function ensureBranchStockSeeded(
  businessId: string,
  tx: Tx | typeof prisma = prisma,
): Promise<string | null> {
  const existing = await tx.branchStock.count({ where: { businessId } })
  if (existing > 0) {
    return resolveMainBranchId(businessId, tx)
  }
  const mainId = await resolveMainBranchId(businessId, tx)
  if (!mainId) return null
  const products = await tx.product.findMany({
    where: { businessId, active: true },
    select: { id: true, stockQuantity: true },
  })
  for (const p of products) {
    if (p.stockQuantity <= 0) continue
    await tx.branchStock.create({
      data: {
        businessId,
        branchId: mainId,
        productId: p.id,
        quantity: p.stockQuantity,
      },
    })
  }
  return mainId
}

async function syncProductStockFromBranches(
  tx: Tx,
  businessId: string,
  productId: string,
) {
  const ag = await tx.branchStock.aggregate({
    where: { businessId, productId },
    _sum: { quantity: true },
  })
  const total = ag._sum.quantity ?? 0
  await tx.product.update({
    where: { id: productId },
    data: { stockQuantity: total },
  })
  return total
}

/**
 * Apply a stock delta to a branch and keep Product.stockQuantity as the sum.
 * Creates the BranchStock row if missing. Optionally writes a StockMovement.
 */
export async function applyBranchStockDelta(
  tx: Tx,
  opts: {
    businessId: string
    branchId: string
    productId: string
    delta: number
    movementType?: StockMovementType
    note?: string
    referenceId?: string
    allowNegative?: boolean
  },
) {
  const {
    businessId,
    branchId,
    productId,
    delta,
    movementType,
    note,
    referenceId,
    allowNegative = false,
  } = opts

  if (delta === 0) {
    const row = await tx.branchStock.findUnique({
      where: { branchId_productId: { branchId, productId } },
    })
    return row?.quantity ?? 0
  }

  let row = await tx.branchStock.findUnique({
    where: { branchId_productId: { branchId, productId } },
  })
  if (!row) {
    row = await tx.branchStock.create({
      data: { businessId, branchId, productId, quantity: 0 },
    })
  }

  const next = row.quantity + delta
  if (!allowNegative && next < 0) {
    throw new Error(
      `Insufficient branch stock (have ${row.quantity}, need ${Math.abs(delta)})`,
    )
  }

  await tx.branchStock.update({
    where: { id: row.id },
    data: { quantity: next },
  })

  await syncProductStockFromBranches(tx, businessId, productId)

  if (movementType) {
    await tx.stockMovement.create({
      data: {
        businessId,
        productId,
        branchId,
        type: movementType,
        quantity: delta,
        note: note || null,
        referenceId: referenceId || null,
      },
    })
  }

  return next
}

/** Resolve which branch to debit/credit when sale/receive has no explicit branch. */
export async function resolveStockBranchId(
  businessId: string,
  preferred: string | null | undefined,
  tx: Tx | typeof prisma = prisma,
): Promise<string | null> {
  if (preferred) return preferred
  await ensureBranchStockSeeded(businessId, tx)
  return resolveMainBranchId(businessId, tx)
}
