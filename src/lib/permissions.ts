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

export const PERMISSION_LABELS: Record<Permission, string> = {
  sell: 'Sell at counter',
  inventory: 'Manage inventory',
  ledger: 'View sales ledger',
  customers: 'Manage customers',
  pulse: 'Use Pulse intelligence',
  labels: 'Print barcode labels',
  team: 'Manage team & access',
  void_sales: 'Void completed sales',
  receive_stock: 'Receive stock',
  discounts: 'Apply discounts',
  transfer_request: 'Request branch transfers',
  transfer_approve: 'Approve branch transfers',
  transfer_receive: 'Receive branch transfers',
  credit_sales: 'Sell on customer credit',
  expenses: 'Record and manage expenses',
}

export const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  BRANCH_MANAGER: 'Branch manager',
  ACCOUNTANT: 'Accountant',
  INVENTORY_MANAGER: 'Inventory manager',
  CASHIER: 'Cashier',
  SALES: 'Salesperson',
  CUSTOM: 'Custom',
}

export const NAV_PERMISSION: Record<string, Permission | null> = {
  '/app/dashboard': null,
  '/app/checkout': 'sell',
  '/app/products': 'inventory',
  '/app/transfers': 'transfer_request',
  '/app/purchasing': 'inventory',
  '/app/suppliers': 'inventory',
  '/app/expenses': 'expenses',
  '/app/sales': 'ledger',
  '/app/customers': 'customers',
  '/app/insights': 'pulse',
  '/app/barcodes': 'labels',
  '/app/team': 'team',
  '/app/onboarding': 'team',
}

export function hasPermission(
  permissions: string[] | undefined,
  role: string | undefined,
  needed: Permission | null,
) {
  if (!needed) return true
  if (role === 'OWNER' || role === 'ADMIN') return true
  return (permissions || []).includes(needed)
}

/** Where staff should land after sign-in. */
export function businessHomePath(
  permissions: string[] | undefined,
  role: string | undefined,
) {
  if (
    role === 'OWNER' ||
    role === 'ADMIN' ||
    role === 'BRANCH_MANAGER' ||
    role === 'ACCOUNTANT' ||
    hasPermission(permissions, role, 'pulse')
  ) {
    return '/app/dashboard'
  }
  if (hasPermission(permissions, role, 'sell')) return '/app/checkout'
  if (hasPermission(permissions, role, 'inventory')) return '/app/products'
  if (hasPermission(permissions, role, 'ledger')) return '/app/sales'
  if (hasPermission(permissions, role, 'customers')) return '/app/customers'
  return '/app/settings'
}

export function canSeeCommand(role: string | undefined) {
  return !['CASHIER', 'SALES'].includes(role || '')
}
