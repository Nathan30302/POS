import { useMemo, useState } from 'react'
import { Download, Eye, Search, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SaleReceiptPanel } from '@/components/SaleReceiptPanel'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useRole } from '@/hooks/useRole'
import { downloadCsv, salesToCsv } from '@/lib/csv'
import { formatZMW } from '@/lib/money'
import { localDb } from '@/lib/localDb'
import type { PaymentMethod, SaleWithItems } from '@/types/database'
import { PAYMENT_METHODS } from '@/types/database'

function toLocalDateInput(iso: string) {
  const d = new Date(iso)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function SalesPage() {
  const { push } = useToast()
  const { isOwner } = useRole()
  const [sales, setSales] = useState(() => localDb.listSales())
  const [selected, setSelected] = useState<SaleWithItems | null>(null)
  const [query, setQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<'today' | 'all' | 'custom'>(
    'all',
  )
  const [customDate, setCustomDate] = useState(() =>
    toLocalDateInput(new Date().toISOString()),
  )
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentMethod>(
    'all',
  )

  const summary = useMemo(() => localDb.todaySummary(), [sales])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sales.filter((sale) => {
      const day = toLocalDateInput(sale.created_at)
      const today = toLocalDateInput(new Date().toISOString())
      const matchesDate =
        dateFilter === 'all'
          ? true
          : dateFilter === 'today'
            ? day === today
            : day === customDate
      const matchesPayment =
        paymentFilter === 'all' || sale.payment_method === paymentFilter
      const matchesQuery =
        !q ||
        sale.id.toLowerCase().includes(q) ||
        sale.payment_method.includes(q) ||
        sale.items.some((item) => item.product_name.toLowerCase().includes(q))
      return matchesDate && matchesPayment && matchesQuery
    })
  }, [sales, query, dateFilter, customDate, paymentFilter])

  if (!isOwner) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-line bg-card p-8 text-center shadow-sm">
        <h2 className="text-xl font-bold text-ink">Reports are owner-only</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Staff can use Checkout and Products. Switch role to Owner to see sales
          history.
        </p>
        <Link to="/checkout" className="mt-5 inline-block">
          <Button type="button">Go to Checkout</Button>
        </Link>
      </div>
    )
  }

  function refresh() {
    setSales(localDb.listSales())
  }

  function exportCsv() {
    const csv = salesToCsv(filtered)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`stationery-sales-${stamp}.csv`, csv)
    push('CSV downloaded', 'ok')
  }

  function voidSelected() {
    if (!selected) return
    try {
      localDb.voidSale(selected.id)
      setSelected(null)
      refresh()
      push('Sale voided · stock restored', 'ok')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not void sale', 'error')
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Reports
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-ink">
            Sales history
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Today: {formatZMW(summary.total)} · {summary.transactionCount}{' '}
            transactions
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={refresh}>
            Refresh
          </Button>
          <Button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search receipt, product, payment…"
            className="w-full rounded-xl border border-line bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </div>
        <select
          value={dateFilter}
          onChange={(e) =>
            setDateFilter(e.target.value as 'today' | 'all' | 'custom')
          }
          className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
        >
          <option value="all">All dates</option>
          <option value="today">Today</option>
          <option value="custom">Pick date</option>
        </select>
        {dateFilter === 'custom' ? (
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        ) : (
          <div className="hidden sm:block" />
        )}
        <select
          value={paymentFilter}
          onChange={(e) =>
            setPaymentFilter(e.target.value as 'all' | PaymentMethod)
          }
          className="rounded-xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
        >
          <option value="all">All payments</option>
          {PAYMENT_METHODS.map((method) => (
            <option key={method.value} value={method.value}>
              {method.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="font-medium text-ink">No sales match</p>
            <p className="mt-1 text-sm text-ink-soft">
              Try clearing filters, or complete a sale on Checkout.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Receipt</th>
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((sale) => (
                  <tr key={sale.id} className="border-t border-line">
                    <td className="px-4 py-3 text-ink-soft">
                      {new Date(sale.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {sale.id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 capitalize">
                      {sale.payment_method}
                    </td>
                    <td className="px-4 py-3">{sale.items.length}</td>
                    <td className="px-4 py-3 font-semibold">
                      {formatZMW(sale.total)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-brand hover:bg-brand-soft/50"
                        onClick={() => setSelected(sale)}
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-ink-soft">
        Showing {filtered.length} of {sales.length} sales. Void puts stock back.
      </p>

      {selected ? (
        <Modal title="Sale details" onClose={() => setSelected(null)}>
          <SaleReceiptPanel
            sale={selected}
            doneLabel="Close"
            onDone={() => setSelected(null)}
            onVoid={voidSelected}
          />
          <p className="mt-3 flex items-center gap-2 text-xs text-ink-soft">
            <Trash2 className="h-3.5 w-3.5" />
            Void only if the sale was a mistake.
          </p>
        </Modal>
      ) : null}
    </div>
  )
}
