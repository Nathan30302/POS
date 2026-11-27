import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { History, PackagePlus, PackageOpen } from 'lucide-react'
import { CsvImportPanel } from '@/components/CsvImportPanel'
import { EmptyState, LoadingBlock, StatChip } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { ProductCard } from '@/components/ProductCard'
import {
  MetricTile,
  ToolbarCard,
  ToolbarSearch,
  ToolbarSelect,
} from '@/components/ToolbarSearch'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useProducts } from '@/hooks/useProducts'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import {
  categoriesForUser,
  hasLotModule,
  lotNavLabel,
} from '@/lib/industry'
import { formatZMW } from '@/lib/money'
import type { Product, ProductInput } from '@/types/database'
import { ProductForm } from './ProductForm'

export function ProductsPage() {
  const { user, isOwnerLike: isOwner, can } = useAuth()
  const canManageInventory = can('inventory')
  const canReceiveStock = can('receive_stock')
  const showLots = hasLotModule(user)
  const lotsLabel = lotNavLabel(user)
  const categoryOptions = categoriesForUser(user)
  const {
    products,
    loading,
    error,
    refresh,
    createProduct,
    updateProduct,
    deleteProduct,
  } = useProducts()

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [receiving, setReceiving] = useState<Product | null>(null)
  const [receiveQty, setReceiveQty] = useState(10)
  const [receiveLot, setReceiveLot] = useState('')
  const [receiveExpiry, setReceiveExpiry] = useState('')
  const [historyFor, setHistoryFor] = useState<Product | null>(null)
  const [movements, setMovements] = useState<
    Array<{
      id: string
      type: string
      quantity: number
      note: string | null
      createdAt: string
    }>
  >([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [busyDelete, setBusyDelete] = useState(false)
  const [busyReceive, setBusyReceive] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionOk, setActionOk] = useState('')

  function flashOk(message: string) {
    setActionOk(message)
    window.setTimeout(() => setActionOk(''), 2200)
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((product) => {
      const matchesCategory =
        category === 'All' || product.category === category
      const matchesQuery =
        !q ||
        product.name.toLowerCase().includes(q) ||
        (product.barcode ?? '').toLowerCase().includes(q) ||
        (product.sku ?? '').toLowerCase().includes(q)
      return matchesCategory && matchesQuery
    })
  }, [products, query, category])

  const lowStockCount = products.filter(
    (p) => p.stock_quantity <= p.low_stock_threshold,
  ).length
  const stockAtCost = products.reduce(
    (s, p) => s + p.cost_price * p.stock_quantity,
    0,
  )
  const stockAtSell = products.reduce(
    (s, p) => s + p.selling_price * p.stock_quantity,
    0,
  )

  async function handleSave(input: ProductInput) {
    setActionError('')
    const wasEdit = Boolean(editing)
    if (editing) {
      await updateProduct(editing.id, input)
    } else {
      await createProduct(input)
    }
    setEditorOpen(false)
    setEditing(null)
    flashOk(wasEdit ? 'Product updated.' : 'Product added.')
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusyDelete(true)
    setActionError('')
    try {
      await deleteProduct(deleting.id)
      setDeleting(null)
      flashOk('Product deleted.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyDelete(false)
    }
  }

  async function confirmReceive() {
    if (!receiving) return
    setBusyReceive(true)
    setActionError('')
    try {
      const useLot = receiveLot.trim() && receiveExpiry
      if (useLot) {
        await api('/pharmacy/receive', {
          method: 'POST',
          body: JSON.stringify({
            productId: receiving.id,
            quantity: receiveQty,
            lotNumber: receiveLot.trim(),
            expiryDate: new Date(receiveExpiry).toISOString(),
          }),
        })
      } else {
        await api(`/products/${receiving.id}/receive`, {
          method: 'POST',
          body: JSON.stringify({ quantity: receiveQty }),
        })
      }
      await refresh()
      setReceiving(null)
      setReceiveQty(10)
      setReceiveLot('')
      setReceiveExpiry('')
      flashOk(useLot ? 'Lot received (FEFO).' : 'Stock received.')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Receive failed')
    } finally {
      setBusyReceive(false)
    }
  }

  async function openHistory(product: Product) {
    setHistoryFor(product)
    setHistoryLoading(true)
    setActionError('')
    try {
      const data = await api<{
        movements: Array<{
          id: string
          type: string
          quantity: number
          note: string | null
          createdAt: string
        }>
      }>(`/products/${product.id}/movements`)
      setMovements(data.movements)
    } catch (err) {
      setMovements([])
      setActionError(
        err instanceof Error ? err.message : 'Could not load movements',
      )
    } finally {
      setHistoryLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-5">
      <PageHero
        eyebrow="Inventory · catalogue"
        title="Stock & catalogue"
        subtitle="Search, receive, and keep the till’s live catalogue honest."
        actions={
          canManageInventory ? (
            <Button
              type="button"
              onClick={() => {
                setEditing(null)
                setEditorOpen(true)
              }}
            >
              <PackagePlus className="h-4 w-4" />
              Add product
            </Button>
          ) : null
        }
      />

      {canManageInventory ? (
        <section className="nx-card p-4 sm:p-5">
          <CsvImportPanel onDone={() => void refresh()} />
        </section>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3">
        <MetricTile label="Stock at cost" value={formatZMW(stockAtCost)} />
        <MetricTile label="Stock at selling" value={formatZMW(stockAtSell)} />
        <MetricTile
          label="Shortcuts"
          value={`${lowStockCount} low`}
          hint={
            <>
              <Link to="/app/insights" className="font-semibold text-royal hover:underline">
                Reorder
              </Link>
              {showLots ? (
                <>
                  {' · '}
                  <Link
                    to="/app/pharmacy"
                    className="font-semibold text-royal hover:underline"
                  >
                    {lotsLabel}
                  </Link>
                </>
              ) : null}
              {' · '}
              <Link to="/app/barcodes" className="font-semibold text-royal hover:underline">
                Labels
              </Link>
            </>
          }
        />
      </div>

      <ToolbarCard>
        <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1.4fr)_minmax(11rem,0.7fr)_auto] sm:items-stretch">
          <ToolbarSearch
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, barcode, SKU…"
            aria-label="Search products"
          />
          <ToolbarSelect
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter category"
          >
            <option value="All">All categories</option>
            {categoryOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </ToolbarSelect>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatChip value={products.length} label="in catalogue" tone="royal" />
          <StatChip
            value={lowStockCount}
            label="low stock"
            tone={lowStockCount > 0 ? 'warn' : 'ok'}
          />
        </div>
      </ToolbarCard>

      {error || actionError ? (
        <FormBanner tone="error">{error || actionError}</FormBanner>
      ) : null}
      {actionOk ? <FormBanner tone="ok">{actionOk}</FormBanner> : null}

      <div className="nx-card overflow-hidden">
        {loading ? (
          <LoadingBlock label="Loading catalogue…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title={products.length === 0 ? 'Catalogue is empty' : 'No matches'}
            body={
              products.length === 0
                ? 'Add your first product so Sell and Pulse have real stock to work with.'
                : 'Try another search or category.'
            }
            action={
              canManageInventory && products.length === 0 ? (
                <Button
                  type="button"
                  onClick={() => {
                    setEditing(null)
                    setEditorOpen(true)
                  }}
                >
                  <PackagePlus className="h-4 w-4" />
                  Add product
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-2.5 p-2.5 sm:grid-cols-3 sm:gap-3 sm:p-4 lg:grid-cols-4">
            {filtered.map((product) => {
              const openProduct = canManageInventory
                ? () => {
                    setEditing(product)
                    setEditorOpen(true)
                  }
                : undefined
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  showCost={isOwner}
                  onOpen={openProduct}
                  onReceive={
                    canReceiveStock
                      ? () => {
                          setReceiving(product)
                          setReceiveQty(10)
                        }
                      : undefined
                  }
                  onEdit={openProduct}
                  onDelete={
                    canManageInventory
                      ? () => setDeleting(product)
                      : undefined
                  }
                  onHistory={
                    isOwner || canManageInventory
                      ? () => void openHistory(product)
                      : undefined
                  }
                />
              )
            })}
          </div>
        )}
      </div>

      {editorOpen && canManageInventory ? (
        <Modal
          title={editing ? 'Edit product' : 'Add product'}
          onClose={() => {
            setEditorOpen(false)
            setEditing(null)
          }}
          wide
          fullScreen={
            typeof navigator !== 'undefined' &&
            /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
          }
        >
          <ProductForm
            key={editing?.id || 'new'}
            initial={editing}
            showCost={isOwner}
            onCancel={() => {
              setEditorOpen(false)
              setEditing(null)
            }}
            onSubmit={handleSave}
            onDelete={
              editing
                ? () => {
                    const product = editing
                    setEditorOpen(false)
                    setEditing(null)
                    setDeleting(product)
                  }
                : undefined
            }
            onHistory={
              editing
                ? () => {
                    const product = editing
                    setEditorOpen(false)
                    setEditing(null)
                    void openHistory(product)
                  }
                : undefined
            }
          />
        </Modal>
      ) : null}

      {receiving && canReceiveStock ? (
        <Modal title="Receive stock" onClose={() => setReceiving(null)}>
          <p className="text-sm text-ink-soft">
            Add incoming stock for{' '}
            <strong className="text-ink">{receiving.name}</strong>. Current:{' '}
            <strong className="text-ink">{receiving.stock_quantity}</strong>
          </p>
          <div className="mt-4 space-y-3">
            <Input
              label="Quantity received"
              type="number"
              min={1}
              step={1}
              value={receiveQty}
              onChange={(e) => setReceiveQty(Number(e.target.value))}
            />
            {showLots ? (
              <>
                <Input
                  label={`Lot / batch # (${lotsLabel})`}
                  value={receiveLot}
                  onChange={(e) => setReceiveLot(e.target.value)}
                  placeholder="Optional — enables FEFO"
                />
                <Input
                  label="Expiry date (with lot)"
                  type="date"
                  value={receiveExpiry}
                  onChange={(e) => setReceiveExpiry(e.target.value)}
                />
                <p className="text-[11px] text-ink-soft">
                  Leave lot blank for plain stock. With lot + expiry, Sell uses
                  soonest-expiry first.
                </p>
              </>
            ) : null}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setReceiving(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busyReceive}
              onClick={() => void confirmReceive()}
            >
              {busyReceive ? 'Saving…' : 'Add to stock'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {deleting && canManageInventory ? (
        <Modal title="Delete product" onClose={() => setDeleting(null)}>
          <p className="text-sm text-ink-soft">
            Delete <strong className="text-ink">{deleting.name}</strong>? This
            cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={busyDelete}
              onClick={() => void confirmDelete()}
            >
              {busyDelete ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </Modal>
      ) : null}

      {historyFor ? (
        <Modal
          title={`Stock history · ${historyFor.name}`}
          onClose={() => {
            setHistoryFor(null)
            setMovements([])
          }}
        >
          {historyLoading ? (
            <LoadingBlock label="Loading movements…" />
          ) : movements.length === 0 ? (
            <EmptyState
              icon={History}
              title="No movements yet"
              body="Sales, receives, voids, and adjustments will appear here."
            />
          ) : (
            <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {movements.map((m) => (
                <li
                  key={m.id}
                  className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{m.type}</p>
                    <p className="text-xs text-ink-soft">
                      {m.note || '—'} ·{' '}
                      {new Date(m.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
                      m.quantity < 0 ? 'text-danger' : 'text-emerald-700'
                    }`}
                  >
                    {m.quantity > 0 ? '+' : ''}
                    {m.quantity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      ) : null}
    </div>
  )
}
