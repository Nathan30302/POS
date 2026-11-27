import { verifyPassword } from './auth.js'
import { prisma } from './prisma.js'

export const LARGE_VOID_ZMW = 50
export const LARGE_DISCOUNT_PCT = 0.2
export const LARGE_DISCOUNT_ZMW = 50

const PIN_ROLES = ['OWNER', 'ADMIN', 'BRANCH_MANAGER'] as const

export function isLargeDiscount(discount: number, subtotal: number): boolean {
  if (discount <= 0) return false
  const share = subtotal > 0 ? discount / subtotal : 0
  return share >= LARGE_DISCOUNT_PCT || discount >= LARGE_DISCOUNT_ZMW
}

export function isLargeVoid(total: number): boolean {
  return total >= LARGE_VOID_ZMW
}

export async function businessHasManagerPin(
  businessId: string,
): Promise<boolean> {
  const row = await prisma.membership.findFirst({
    where: {
      businessId,
      active: true,
      managerPinHash: { not: null },
      role: { in: [...PIN_ROLES] },
    },
    select: { id: true },
  })
  return Boolean(row)
}

/**
 * Accepts a PIN if it matches any active manager membership for the shop.
 */
export async function verifyManagerPin(
  businessId: string,
  pin: string | undefined | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = String(pin || '').trim()
  if (!/^\d{4,6}$/.test(trimmed)) {
    return { ok: false, error: 'Manager PIN must be 4–6 digits' }
  }

  const managers = await prisma.membership.findMany({
    where: {
      businessId,
      active: true,
      managerPinHash: { not: null },
      role: { in: [...PIN_ROLES] },
    },
    select: { managerPinHash: true },
  })

  if (managers.length === 0) {
    return { ok: false, error: 'No manager PIN configured for this shop' }
  }

  for (const m of managers) {
    if (!m.managerPinHash) continue
    if (await verifyPassword(trimmed, m.managerPinHash)) {
      return { ok: true }
    }
  }
  return { ok: false, error: 'Invalid manager PIN' }
}
