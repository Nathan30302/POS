/**
 * Warm lazy route chunks on hover / idle so Sell, Ledger, and Inventory feel instant.
 */
const loaders: Record<string, () => Promise<unknown>> = {
  '/app/checkout': () => import('@/pages/checkout/CheckoutPage'),
  '/app/products': () => import('@/pages/products/ProductsPage'),
  '/app/sales': () => import('@/pages/sales/SalesPage'),
  '/app/insights': () => import('@/pages/InsightsPage'),
  '/app/customers': () => import('@/pages/CustomersPage'),
  '/app/settings': () => import('@/pages/SettingsPage'),
  '/app/dashboard': () => import('@/pages/OwnerDashboardPage'),
  '/app/expenses': () => import('@/pages/ExpensesPage'),
  '/app/team': () => import('@/pages/TeamPage'),
  '/app/purchasing': () => import('@/pages/PurchasingPage'),
  '/app/suppliers': () => import('@/pages/SuppliersPage'),
  '/app/transfers': () => import('@/pages/TransfersPage'),
  '/app/barcodes': () => import('@/pages/BarcodesPage'),
  '/app/audit': () => import('@/pages/AuditLogPage'),
  '/app/conflicts': () => import('@/pages/StockConflictsPage'),
  '/app/pharmacy': () => import('@/pages/PharmacyPage'),
}

const warmed = new Set<string>()

export function prefetchRoute(to: string) {
  const path = to.split('?')[0]
  if (warmed.has(path)) return
  const load = loaders[path]
  if (!load) return
  warmed.add(path)
  void load().catch(() => {
    warmed.delete(path)
  })
}

/** After login, quietly warm the floor routes. */
export function prefetchFloorRoutes() {
  const run = () => {
    prefetchRoute('/app/checkout')
    prefetchRoute('/app/products')
    prefetchRoute('/app/sales')
    prefetchRoute('/app/dashboard')
    prefetchRoute('/app/settings')
  }
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
  }
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(run, { timeout: 2500 })
  } else {
    setTimeout(run, 400)
  }
}
