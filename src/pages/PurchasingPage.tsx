import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, PackagePlus } from 'lucide-react'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { formatZMW } from '@/lib/money'

type Branch = { id: string; name: string }
type Supplier = { id: string; name: string }
type ProductLite = { id: string; name: string; costPrice?: number }

type PoItem = {
  id: string
  productId: string
  productName: string
  quantity: number
  unitCost: number
  lineTotal: number
  receivedQty: number
}

type Order = {
  id: string
  status: string
  total: number
  notes: string | null
  createdAt: string
  supplier: Supplier
  receiveBranch: { id: string; name: string } | null
  items: PoItem[]
}

export function PurchasingPage() {
  const { can } = useAuth()
  const canCreate = can('inventory')
  const canReceive = can('receive_stock')

  const [orders, setOrders] = useState<Order[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<ProductLite[]>([])
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const [supplierId, setSupplierId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [branchId, setBranchId] = useState('')
  const [notes, setNotes] = useState('')
  const [asDraft, setAsDraft] = useState(false)
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState(10)
  const [unitCost, setUnitCost] = useState(0)
  const [lines, setLines] = useState<
    Array<{ productId: string; name: string; quantity: number; unitCost: number }>
  >([])
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ''
      const [o, s, b, p] = await Promise.all([
        api<{ orders: Order[] }>(`/purchasing/orders${qs}`),
        api<{ suppliers: Supplier[] }>('/purchasing/suppliers'),
        api<{ branches: Branch[] }>('/branches'),
        api<{ products: ProductLite[] }>('/products'),
      ])
      setOrders(o.orders)
      setSuppliers(s.suppliers)
      setBranches(b.branches)
      setProducts(p.products)
      setBranchId((prev) => prev || b.branches[0]?.id || '')
      setSupplierId((prev) => prev || s.suppliers[0]?.id || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load purchasing')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  function flash(msg: string) {
    setOk(msg)
    window.setTimeout(() => setOk(''), 2200)
  }

  function addLine() {
    if (!productId || qty < 1) return
    const p = products.find((x) => x.id === productId)
    const cost = unitCost || p?.costPrice || 0
    setLines((prev) => {
      const hit = prev.find((x) => x.productId === productId)
      if (hit) {
        return prev.map((x) =>
          x.productId === productId
            ? { ...x, quantity: x.quantity + qty, unitCost: cost }
            : x,
        )
      }
      return [
        ...prev,
        {
          productId,
          name: p?.name || productId,
          quantity: qty,
          unitCost: cost,
        },
      ]
    })
  }

  async function createOrder() {
    if (!canCreate || lines.length === 0) return
    setBusy(true)
    setError('')
    try {
      await api('/purchasing/orders', {
        method: 'POST',
        body: JSON.stringify({
          supplierId: supplierId || undefined,
          supplierName: !supplierId ? supplierName.trim() : undefined,
          receiveBranchId: branchId || undefined,
          notes: notes.trim() || undefined,
          status: asDraft ? 'DRAFT' : 'ORDERED',
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitCost: l.unitCost,
          })),
        }),
      })
      setLines([])
      setNotes('')
      setSupplierName('')
      flash(asDraft ? 'Draft PO saved' : 'Purchase order created')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setBusy(false)
    }
  }

  async function receiveOrder(id: string) {
    if (!canReceive) return
    setBusy(true)
    setError('')
    try {
      await api(`/purchasing/orders/${id}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          branchId: branchId || undefined,
          updateCosts: true,
        }),
      })
      flash('Stock received · costs updated')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Receive failed')
    } finally {
      setBusy(false)
    }
  }

  async function submitOrder(id: string) {
    if (!canCreate) return
    setBusy(true)
    setError('')
    try {
      await api(`/purchasing/orders/${id}/submit`, {
        method: 'POST',
        body: '{}',
      })
      flash('PO submitted (ordered)')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  async function cancelOrder(id: string) {
    if (!canCreate) return
    if (!window.confirm('Cancel this purchase order?')) return
    setBusy(true)
    setError('')
    try {
      await api(`/purchasing/orders/${id}/cancel`, {
        method: 'POST',
        body: '{}',
      })
      flash('PO cancelled')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHero
        eyebrow="Head Office"
        title="Central purchasing"
        actions={
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              to="/app/suppliers"
              className="font-semibold text-royal hover:underline"
            >
              Manage suppliers
            </Link>
            <span className="text-ink-soft">Draft → ordered → receive</span>
          </div>
        }
      />

      {error ? <FormBanner tone="error">{error}</FormBanner> : null}
      {ok ? <FormBanner tone="ok">{ok}</FormBanner> : null}

      {canCreate ? (
        <section className="nx-card space-y-4 p-5">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-royal" />
            <h2 className="font-semibold text-ink">New purchase order</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Supplier
              </span>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-royal"
              >
                <option value="">New supplier…</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            {!supplierId ? (
              <label className="space-y-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Supplier name
                </span>
                <Input
                  label="Supplier name"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="e.g. Lusaka Wholesale"
                />
              </label>
            ) : (
              <label className="space-y-1 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Receive into branch
                </span>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-royal"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {supplierId ? null : (
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Receive into branch
              </span>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-royal"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_5rem_6rem_auto]">
            <select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value)
                const p = products.find((x) => x.id === e.target.value)
                if (p?.costPrice != null) setUnitCost(p.costPrice)
              }}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-royal"
            >
              <option value="">Product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Input
              label="Qty"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Number(e.target.value) || 1)}
            />
            <Input
              label="Unit cost"
              type="number"
              min={0}
              step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(Number(e.target.value) || 0)}
            />
            <Button type="button" variant="secondary" onClick={addLine}>
              Add
            </Button>
          </div>
          {lines.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {lines.map((l) => (
                <li
                  key={l.productId}
                  className="flex justify-between gap-2 rounded-lg bg-surface px-3 py-2"
                >
                  <span>
                    {l.name} × {l.quantity} @ {formatZMW(l.unitCost)}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-danger"
                    onClick={() =>
                      setLines((prev) =>
                        prev.filter((x) => x.productId !== l.productId),
                      )
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <Input
            label="Notes"
            placeholder="Optional"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={asDraft}
              onChange={(e) => setAsDraft(e.target.checked)}
            />
            Save as draft (submit later before receiving)
          </label>
          <Button
            type="button"
            disabled={
              busy ||
              lines.length === 0 ||
              (!supplierId && supplierName.trim().length < 2)
            }
            onClick={() => void createOrder()}
          >
            <PackagePlus className="h-4 w-4" />
            {asDraft ? 'Save draft' : 'Create PO'}
          </Button>
        </section>
      ) : null}

      <section className="nx-card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="font-semibold text-ink">Orders</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-line bg-surface px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ORDERED">Ordered</option>
            <option value="PARTIAL">Partial</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-ink-soft">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="p-6 text-sm text-ink-soft">No purchase orders yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {orders.map((o) => (
              <li
                key={o.id}
                className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="font-semibold text-ink">
                    {o.supplier.name} · {formatZMW(o.total)}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {o.status}
                    {o.receiveBranch ? ` · ${o.receiveBranch.name}` : ''} ·{' '}
                    {new Date(o.createdAt).toLocaleString()}
                  </p>
                  <ul className="mt-2 space-y-0.5 text-sm text-ink-soft">
                    {o.items.map((i) => (
                      <li key={i.id}>
                        {i.productName}: {i.receivedQty}/{i.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canCreate && o.status === 'DRAFT' ? (
                    <Button
                      type="button"
                      className="min-h-9 px-3 py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => void submitOrder(o.id)}
                    >
                      Submit
                    </Button>
                  ) : null}
                  {canReceive &&
                  (o.status === 'ORDERED' || o.status === 'PARTIAL') ? (
                    <Button
                      type="button"
                      className="min-h-9 px-3 py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => void receiveOrder(o.id)}
                    >
                      Receive to branch
                    </Button>
                  ) : null}
                  {canCreate &&
                  (o.status === 'DRAFT' || o.status === 'ORDERED') ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-9 px-3 py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => void cancelOrder(o.id)}
                    >
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
