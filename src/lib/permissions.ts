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
