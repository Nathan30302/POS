import { useEffect, useMemo, useState } from 'react'
import { Download, Eye, Search } from 'lucide-react'
import { SaleReceiptPanel } from '@/components/SaleReceiptPanel'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { downloadCsv, salesToCsv } from '@/lib/csv'
import { formatZMW } from '@/lib/money'
import type { PaymentMethod, SaleWithItems } from '@/types/database'
import { PAYMENT_METHODS } from '@/types/database'

type ApiSale = {
  id: string
  total: number
  discount: number
  paymentMethod: string
  status: string
  notes: string | null
  createdAt: string
  items: Array<{
    id: string
    saleId: string
    productId: string
    productName: string
    quantity: number
    unitPrice: number
    lineTotal: number
  }>
}

function mapPayment(method: string): PaymentMethod {
  if (method === 'CARD') return 'card'
  if (method === 'OTHER') return 'other'
  if (method === 'CASH') return 'cash'
  return 'eft'
}

function mapSale(sale: ApiSale): SaleWithItems {
  return {
    id: sale.id,
    total: sale.total,
    discount: sale.discount,
    payment_method: mapPayment(sale.paymentMethod),
    notes: sale.notes,
    created_at: sale.createdAt,
    items: sale.items.map((item) => ({
      id: item.id,
      sale_id: item.saleId,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: item.lineTotal,
    })),
  }
}

export function SalesPage() {
  const { push } = useToast()
  const { isOwnerLike } = useAuth()
  const [sales, setSales] = useState<SaleWithItems[]>([])
  const [selected, setSelected] = useState<SaleWithItems | null>(null)
  const [query, setQuery] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentMethod>('all')
  const [error, setError] = useState('')

  async function refresh() {
    const data = await api<{ sales: ApiSale[] }>('/sales')
    setSales(data.sales.filter((s) => s.status !== 'PARKED').map(mapSale))
  }

  useEffect(() => {
    void refresh().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load sales'),
    )
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sales.filter((sale) => {
      const matchesPayment =
        paymentFilter === 'all' || sale.payment_method === paymentFilter
      const matchesQuery =
        !q ||
        sale.id.toLowerCase().includes(q) ||
        sale.items.some((item) => item.product_name.toLowerCase().includes(q))
      return matchesPayment && matchesQuery
    })
  }, [sales, query, paymentFilter])

  async function voidSelected() {
    if (!selected) return
    try {
      await api(`/sales/${selected.id}/void`, { method: 'POST' })
      setSelected(null)
      await refresh()
      push('Sale voided · stock restored', 'ok')
    } catch (err) {
      push(err instanceof Error ? err.message : 'Could not void sale', 'error')
    }
  }

  function exportCsv() {
    downloadCsv(
      `nexora-sales-${new Date().toISOString().slice(0, 10)}.csv`,
      salesToCsv(filtered),
    )
    push('CSV downloaded', 'ok')
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-royal">
            Ledger
          </p>
          <h2 className="nx-page-title mt-1">Sales history</h2>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => void refresh()}>
            Refresh
          </Button>
          <Button type="button" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search receipt or product…"
            className="w-full rounded-xl border border-line bg-card py-2.5 pl-10 pr-3 text-sm outline-none focus:border-royal focus:ring-4 focus:ring-royal/15"
          />
        </div>
        <select
          value={paymentFilter}
          onChange={(e) =>
            setPaymentFilter(e.target.value as 'all' | PaymentMethod)
          }
          className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm"
        >
          <option value="all">All payments</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-ink-soft dark:bg-slate-900/40">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Receipt</th>
              <th className="px-4 py-3 font-medium">Payment</th>
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
                <td className="px-4 py-3 capitalize">{sale.payment_method}</td>
                <td className="px-4 py-3 font-semibold">
                  {formatZMW(sale.total)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-sm font-medium text-royal"
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

      {selected ? (
        <Modal title="Sale details" onClose={() => setSelected(null)}>
          <SaleReceiptPanel
            sale={selected}
            doneLabel="Close"
            onDone={() => setSelected(null)}
            onVoid={isOwnerLike ? voidSelected : undefined}
          />
        </Modal>
      ) : null}
    </div>
  )
}
