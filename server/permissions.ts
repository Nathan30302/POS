import type { MembershipRole } from '@prisma/client'

export const ALL_PERMISSIONS = [
  'sell',
  'inventory',
  'ledger',
  'customers',
  'pulse',
  'labels',
  'team',
  'void_sales',
  'receive_stock',
  'discounts',
  'transfer_request',
  'transfer_approve',
  'transfer_receive',
  'credit_sales',
  'expenses',
] as const

export type Permission = (typeof ALL_PERMISSIONS)[number]

/** Expenses above this (ZMW) need owner/admin approval when status flow is used. */
export const LARGE_EXPENSE_THRESHOLD = 5000

export const ROLE_DEFAULTS: Record<MembershipRole, Permission[]> = {
  OWNER: [...ALL_PERMISSIONS],
  ADMIN: [...ALL_PERMISSIONS],
  BRANCH_MANAGER: [
    'sell',
    'inventory',
    'ledger',
    'customers',
    'labels',
    'void_sales',
    'receive_stock',
    'discounts',
    'transfer_request',
    'transfer_approve',
    'transfer_receive',
    'credit_sales',
    'expenses',
  ],
  ACCOUNTANT: ['ledger', 'pulse', 'customers', 'expenses'],
  INVENTORY_MANAGER: [
    'inventory',
    'labels',
    'receive_stock',
    'transfer_request',
    'transfer_receive',
  ],
  CASHIER: ['sell', 'labels'],
  SALES: ['sell', 'customers', 'labels', 'discounts', 'credit_sales'],
  CUSTOM: ['sell'],
}

export const MANAGER_ROLES: MembershipRole[] = ['OWNER', 'ADMIN']

export function defaultsForRole(role: MembershipRole): Permission[] {
  return ROLE_DEFAULTS[role] || ['sell']
}

export function parsePermissions(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : []
  } catch {
    return []
  }
}

export function effectivePermissions(
  role: MembershipRole | string | undefined,
  raw: string | null | undefined,
): string[] {
  const custom = parsePermissions(raw)
  if (custom.length) return custom
  if (role && role in ROLE_DEFAULTS) {
    return ROLE_DEFAULTS[role as MembershipRole]
  }
  return ['sell']
}
