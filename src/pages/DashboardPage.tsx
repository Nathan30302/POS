import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  PackagePlus,
  ShoppingCart,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useProducts } from '@/hooks/useProducts'
import { useRole } from '@/hooks/useRole'
import { formatZMW } from '@/lib/money'
import { localDb } from '@/lib/localDb'
import { PAYMENT_METHODS } from '@/types/database'

export function DashboardPage() {
  const { isOwner } = useRole()
  const { products, refresh } = useProducts()
  const summary = localDb.todaySummary()
  const lowStock = localDb.lowStockProducts()
  const recent = localDb.listSales().slice(0, 6)
  const avgTicket =
    summary.transactionCount > 0
      ? summary.total / summary.transactionCount
      : 0

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-card p-8 text-center shadow-sm">
        <h2 className="text-xl font-bold text-ink">Owner reports only</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Switch to Owner in the sidebar to view sales totals and stock alerts.
        </p>
        <Link to="/checkout" className="mt-5 inline-block">
          <Button type="button">Go to Checkout</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Overview
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-ink">
            Today
          </h2>
          <p className="mt-1 text-sm text-ink-soft">{summary.date}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/checkout">
            <Button type="button">
              <ShoppingCart className="h-4 w-4" />
              Open Sell
            </Button>
          </Link>
          <Link to="/products">
            <Button type="button" variant="secondary">
              <PackagePlus className="h-4 w-4" />
              Manage stock
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <p className="text-sm text-ink-soft">Sales today</p>
          <p className="mt-2 text-3xl font-bold text-ink">
            {formatZMW(summary.total)}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <p className="text-sm text-ink-soft">Transactions</p>
          <p className="mt-2 text-3xl font-bold text-ink">
            {summary.transactionCount}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <p className="text-sm text-ink-soft">Avg ticket</p>
          <p className="mt-2 text-3xl font-bold text-ink">
            {formatZMW(avgTicket)}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <p className="text-sm text-ink-soft">Low stock items</p>
          <p className="mt-2 text-3xl font-bold text-ink">{lowStock.length}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {products.length} products in catalogue
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Banknote className="h-4 w-4 text-brand" />
            <h3 className="font-semibold text-ink">Payment breakdown</h3>
          </div>
          {summary.transactionCount === 0 ? (
            <p className="text-sm text-ink-soft">No sales yet today.</p>
          ) : (
            <ul className="space-y-3">
              {PAYMENT_METHODS.map((method) => {
                const amount = summary.paymentBreakdown[method.value]
                const pct =
                  summary.total > 0 ? Math.round((amount / summary.total) * 100) : 0
                return (
                  <li key={method.value} className="space-y-1.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-ink-soft">{method.label}</span>
                      <span className="font-semibold">{formatZMW(amount)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <Link
            to="/sales"
            className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-deep"
          >
            View all sales <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warn" />
              <h3 className="font-semibold text-ink">Low stock</h3>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-ink-soft hover:text-ink"
              onClick={() => void refresh()}
            >
              Refresh
            </button>
          </div>
          {lowStock.length === 0 ? (
            <p className="text-sm text-ink-soft">All stock levels look healthy.</p>
          ) : (
            <ul className="space-y-2">
              {lowStock.slice(0, 8).map((product) => (
                <li
                  key={product.id}
                  className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-ink">{product.name}</span>
                  <span className="font-semibold text-amber-900">
                    {product.stock_quantity} left
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-ink">Recent sales</h3>
          <Link
            to="/sales"
            className="text-sm font-semibold text-brand hover:text-brand-deep"
          >
            See all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-soft">
            No sales yet. Open Sell and ring one up.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((sale) => (
              <li
                key={sale.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-ink">
                    #{sale.id.slice(0, 8).toUpperCase()} ·{' '}
                    <span className="capitalize">{sale.payment_method}</span>
                  </p>
                  <p className="text-xs text-ink-soft">
                    {new Date(sale.created_at).toLocaleString()} ·{' '}
                    {sale.items.length} item{sale.items.length === 1 ? '' : 's'}
                  </p>
                </div>
                <p className="font-semibold">{formatZMW(sale.total)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
