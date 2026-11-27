import { useEffect, useMemo, useState } from 'react'
import { Download, Eye, Receipt, Store } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, LoadingBlock } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { SaleReceiptPanel } from '@/components/SaleReceiptPanel'
import {
  ToolbarCard,
  ToolbarSearch,
  ToolbarSelect,
} from '@/components/ToolbarSearch'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { downloadCsv, salesToCsv } from '@/lib/csv'
import { formatZMW } from '@/lib/money'
import type { PaymentMethod, SaleWithItems } from '@/types/database'
import {
  mapApiPayment,
  paymentLabel,
  PAYMENT_METHODS,
} from '@/types/database'
import {
  fetchShopProfile,
  type ShopReceiptProfile,
} from '@/lib/shopProfile'

type RangeKey = 'today' | '7d' | '30d' | 'all'

type ApiSale = {
  id: string
  total: number
  discount: number
  paymentMethod: string
  status: string
  notes: string | null
  createdAt: string
  soldBy?: { id: string; fullName: string } | null
  branch?: { id: string; name: string } | null
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

type LedgerSale = SaleWithItems & {
  cashierName?: string | null
  branchName?: string | null
  status?: string
}

function mapSale(sale: ApiSale): LedgerSale {
  return {
    id: sale.id,
    total: sale.total,
    discount: sale.discount,
    payment_method: mapApiPayment(sale.paymentMethod),
    notes: sale.notes,
    created_at: sale.createdAt,
    cashierName: sale.soldBy?.fullName || null,
    branchName: sale.branch?.name || null,
    status: sale.status,
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

function rangeFrom(key: RangeKey): string | null {
  if (key === 'all') return null
  const d = new Date()
  if (key === 'today') {
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }
  d.setDate(d.getDate() - (key === '7d' ? 7 : 30))
  return d.toISOString()
}

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All' },
]

export function SalesPage() {
  const { push } = useToast()
  const { user, can } = useAuth()
  const canVoid = can('void_sales')
  const [managerPinConfigured, setManagerPinConfigured] = useState(false)
  const [searchParams] = useSearchParams()
  const soldByFilter = searchParams.get('soldById') || ''
  const [sales, setSales] = useState<LedgerSale[]>([])
  const [selected, setSelected] = useState<LedgerSale | null>(null)
  const [query, setQuery] = useState('')
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentMethod>('all')
  const [range, setRange] = useState<RangeKey>('30d')
  const [error, setError] = useState('')
  const [shop, setShop] = useState<ShopReceiptProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)

  async function refresh(nextRange = range) {
    const from = rangeFrom(nextRange)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (soldByFilter) params.set('soldById', soldByFilter)
    const qs = params.toString() ? `?${params.toString()}` : ''
    const data = await api<{ sales: ApiSale[] }>(`/sales${qs}`)
    setSales(data.sales.filter((s) => s.status !== 'PARKED').map(mapSale))
  }

  useEffect(() => {
    setLoading(true)
    void refresh(range)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load sales'),
      )
      .finally(() => setLoading(false))
  }, [range, soldByFilter])

  useEffect(() => {
    void fetchShopProfile()
      .then((profile) =>
        setShop({
          ...profile,
          name: user?.businessName?.trim() || profile.name,
        }),
      )
      .catch(() => {
        if (user?.businessName) {
          setShop({ name: user.businessName, currency: 'ZMW' })
        }
      })
    void api<{ configured: boolean }>('/team/manager-pin/status')
      .then((d) => setManagerPinConfigured(d.configured))
      .catch(() => setManagerPinConfigured(false))
  }, [user?.businessName])

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

  const ledgerTotal = useMemo(
    () => filtered.reduce((sum, sale) => sum + sale.total, 0),
    [filtered],
  )

  async function openSale(sale: LedgerSale) {
    setSelected(sale)
    setDetailLoading(true)
    try {
      const data = await api<{ sale: ApiSale }>(`/sales/${sale.id}`)
      setSelected(mapSale(data.sale))
    } catch {
      // Keep list payload if detail fetch fails
    } finally {
      setDetailLoading(false)
    }
  }

  async function voidSelected(reason: string, managerPin?: string) {
    if (!selected) return
    await api(`/sales/${selected.id}/void`, {
      method: 'POST',
      body: JSON.stringify({
        reason,
        ...(managerPin ? { managerPin } : {}),
      }),
    })
    setSelected(null)
    await refresh()
    push('Sale voided · stock restored', 'ok')
  }

  function exportCsv() {
    downloadCsv(
      `nexora-sales-${new Date().toISOString().slice(0, 10)}.csv`,
      salesToCsv(filtered),
    )
    push('CSV downloaded', 'ok')
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-5">
      <PageHero
        eyebrow="Ledger"
        title="Sales ledger"
        subtitle="Every completed sale — search the list, filter payments, or jump back to Sell."
        actions={
          <>
            <Link to="/app/checkout">
              <Button type="button" variant="secondary">
                <Store className="h-4 w-4" />
                Open Sell
              </Button>
            </Link>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setLoading(true)
                void refresh()
                  .catch((err) =>
                    setError(
                      err instanceof Error ? err.message : 'Failed to load sales',
                    ),
                  )
                  .finally(() => setLoading(false))
              }}
            >
              Refresh
            </Button>
            <Button
              type="button"
              onClick={exportCsv}
              disabled={!filtered.length}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </>
        }
      />

      {error ? <FormBanner tone="error">{error}</FormBanner> : null}
      {soldByFilter ? (
        <FormBanner tone="info">
          Filtered to one cashier from Trust.{' '}
          <Link to="/app/sales" className="font-semibold underline">
            Clear filter
          </Link>
        </FormBanner>
      ) : null}

      <ToolbarCard>
        <div className="flex flex-wrap items-center gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={`nx-chip min-h-9 ${range === r.key ? 'is-active' : ''}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(11rem,0.7fr)_auto] lg:items-stretch">
          <ToolbarSearch
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Receipt, cashier, note…"
            aria-label="Search sales"
          />
          <ToolbarSelect
            value={paymentFilter}
            onChange={(e) =>
              setPaymentFilter(e.target.value as 'all' | PaymentMethod)
            }
            aria-label="Filter by payment"
          >
            <option value="all">All payments</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </ToolbarSelect>

          <div className="flex min-h-11 items-center justify-between gap-6 rounded-xl border border-line bg-surface/70 px-3.5 sm:px-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
                Showing
              </p>
              <p className="text-sm font-bold tabular-nums text-ink">
                {filtered.length} sale{filtered.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
                Total
              </p>
              <p className="text-sm font-bold tabular-nums text-brand">
                {formatZMW(ledgerTotal)}
              </p>
            </div>
          </div>
        </div>
      </ToolbarCard>

      <div className="nx-card overflow-hidden">
        {loading ? (
          <LoadingBlock label="Loading…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={sales.length === 0 ? 'No sales yet' : 'No matches'}
            body={
              sales.length === 0
                ? 'Complete a sale on Sell — it will appear here with payment, cashier, and receipt detail.'
                : 'Try another search or payment filter.'
            }
            action={
              sales.length === 0 ? (
                <Link to="/app/checkout">
                  <Button type="button">
                    <Store className="h-4 w-4" />
                    Go to Sell
                  </Button>
                </Link>
              ) : null
            }
          />
        ) : (
          <>
            <div className="divide-y divide-line sm:hidden">
              {filtered.map((sale) => {
                const qty = sale.items.reduce((n, i) => n + i.quantity, 0)
                return (
                  <button
                    key={sale.id}
                    type="button"
                    onClick={() => void openSale(sale)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-surface/80 active:bg-surface [content-visibility:auto]"
                  >
                    <div className="min-w-0">
                      <p className="text-[0.95rem] font-semibold tabular-nums text-ink">
                        {formatZMW(sale.total)}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-soft">
                        {paymentLabel(sale.payment_method)} · {qty} item
                        {qty === 1 ? '' : 's'}
                        {sale.cashierName ? ` · ${sale.cashierName}` : ''}
                        {sale.branchName ? ` · ${sale.branchName}` : ''}
                        {sale.status === 'VOIDED' ? ' · VOID' : ''} ·{' '}
                        {new Date(sale.created_at).toLocaleString()}
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-ink-soft">
                        {sale.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <span className="inline-flex min-h-10 shrink-0 items-center gap-1 text-sm font-semibold text-brand">
                      <Eye className="h-4 w-4" />
                      View
                    </span>
                  </button>
                )
              })}
            </div>

            <table className="hidden min-w-full text-left text-sm sm:table">
              <thead className="bg-surface/80 text-ink-soft">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Receipt</th>
                  <th className="px-4 py-2.5 font-medium">Cashier</th>
                  <th className="px-4 py-2.5 font-medium">Payment</th>
                  <th className="px-4 py-2.5 font-medium">Items</th>
                  <th className="px-4 py-2.5 font-medium">Total</th>
                  <th className="px-4 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((sale) => {
                  const qty = sale.items.reduce((n, i) => n + i.quantity, 0)
                  return (
                    <tr
                      key={sale.id}
                      className="border-t border-line transition hover:bg-surface/70 [content-visibility:auto]"
                    >
                      <td className="px-4 py-2.5 text-ink-soft">
                        {new Date(sale.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink">
                        {sale.id.slice(0, 8).toUpperCase()}
                        {sale.status === 'VOIDED' ? (
                          <span className="ml-1 text-[10px] font-bold text-danger">
                            VOID
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-ink">
                        <span className="block">{sale.cashierName || '—'}</span>
                        {sale.branchName ? (
                          <span className="text-xs text-ink-soft">
                            {sale.branchName}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2.5 text-ink">
                        {paymentLabel(sale.payment_method)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-ink-soft">
                        {qty}
                      </td>
                      <td className="px-4 py-2.5 font-semibold tabular-nums text-ink">
                        {formatZMW(sale.total)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-brand"
                          onClick={() => void openSale(sale)}
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {selected ? (
        <Modal title="Sale details" onClose={() => setSelected(null)}>
          {detailLoading ? (
            <LoadingBlock label="Loading…" />
          ) : (
            <SaleReceiptPanel
              sale={selected}
              shop={shop ?? undefined}
              doneLabel="Close"
              onDone={() => setSelected(null)}
              cashierName={selected.cashierName}
              branchName={selected.branchName}
              onVoid={
                canVoid && selected.status !== 'VOIDED'
                  ? voidSelected
                  : undefined
              }
              requireManagerPin={managerPinConfigured}
            />
          )}
        </Modal>
      ) : null}
    </div>
  )
}
