import { useMemo, useState } from 'react'
import {
  PackagePlus,
  Pencil,
  Search,
  Trash2,
  PackageOpen,
} from 'lucide-react'
import { EmptyState, LoadingBlock, StatChip } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useProducts } from '@/hooks/useProducts'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { formatZMW } from '@/lib/money'
import type { Product, ProductInput } from '@/types/database'
import { PRODUCT_CATEGORIES } from '@/types/database'
import { ProductForm } from './ProductForm'

export function ProductsPage() {
  const { isOwnerLike: isOwner, can } = useAuth()
  const canManageInventory = can('inventory')
  const canReceiveStock = can('receive_stock')
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
  const [busyDelete, setBusyDelete] = useState(false)
  const [busyReceive, setBusyReceive] = useState(false)
  const [actionError, setActionError] = useState('')

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

  async function handleSave(input: ProductInput) {
    setActionError('')
    if (editing) {
      await updateProduct(editing.id, input)
    } else {
      await createProduct(input)
    }
    setEditorOpen(false)
    setEditing(null)
  }

  async function confirmDelete() {
    if (!deleting) return
    setBusyDelete(true)
    setActionError('')
    try {
      await deleteProduct(deleting.id)
      setDeleting(null)
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
      await api(`/products/${receiving.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({ quantity: receiveQty }),
      })
      await refresh()
      setReceiving(null)
      setReceiveQty(10)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Receive failed')
    } finally {
      setBusyReceive(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHero
        eyebrow="Inventory · catalogue"
        title="Stock & catalogue"
        subtitle="Prices, barcodes, and stock — use Voice fill to speak name, rate, and barcode."
        actions={
          canManageInventory ? (
            <Button
              type="button"
              className="bg-[#3563E9] hover:bg-[#2f58d4]"
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

      <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, barcode, or SKU…"
            className="w-full rounded-xl border border-line bg-card py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15"
        >
          <option value="All">All categories</option>
          {PRODUCT_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatChip value={products.length} label="in catalogue" tone="royal" />
        <StatChip
          value={lowStockCount}
          label="low stock"
          tone={lowStockCount > 0 ? 'warn' : 'ok'}
        />
      </div>

      {error || actionError ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-danger">
          {error || actionError}
        </p>
      ) : null}

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
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Barcode / SKU</th>
                  {isOwner ? (
                    <th className="px-4 py-3 font-medium">Cost</th>
                  ) : null}
                  <th className="px-4 py-3 font-medium">Sell</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const low =
                    product.stock_quantity <= product.low_stock_threshold
                  return (
                    <tr key={product.id} className="border-t border-line">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 overflow-hidden rounded-xl bg-slate-100">
                            {product.image_url ? (
                              <img
                                src={product.image_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div>
                            <p className="font-medium text-ink">{product.name}</p>
                            {low ? (
                              <p className="text-xs font-medium text-warn">
                                Low stock
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {product.category}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                        <div>{product.barcode || '—'}</div>
                        <div>{product.sku || '—'}</div>
                      </td>
                      {isOwner ? (
                        <td className="px-4 py-3">
                          {formatZMW(product.cost_price)}
                        </td>
                      ) : null}
                      <td className="px-4 py-3 font-semibold">
                        {formatZMW(product.selling_price)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            low
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {product.stock_quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {canReceiveStock ? (
                            <button
                              type="button"
                              className="rounded-lg p-2 text-ink-soft hover:bg-brand-soft/60 hover:text-brand"
                              onClick={() => {
                                setReceiving(product)
                                setReceiveQty(10)
                              }}
                              aria-label={`Receive stock for ${product.name}`}
                              title="Receive stock"
                            >
                              <PackageOpen className="h-4 w-4" />
                            </button>
                          ) : null}
                          {canManageInventory ? (
                            <>
                              <button
                                type="button"
                                className="rounded-lg p-2 text-ink-soft hover:bg-slate-100 hover:text-ink"
                                onClick={() => {
                                  setEditing(product)
                                  setEditorOpen(true)
                                }}
                                aria-label={`Edit ${product.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="rounded-lg p-2 text-ink-soft hover:bg-red-50 hover:text-danger"
                                onClick={() => setDeleting(product)}
                                aria-label={`Delete ${product.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
        >
          <ProductForm
            initial={editing}
            showCost={isOwner}
            onCancel={() => {
              setEditorOpen(false)
              setEditing(null)
            }}
            onSubmit={handleSave}
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
          <div className="mt-4">
            <Input
              label="Quantity received"
              type="number"
              min={1}
              step={1}
              value={receiveQty}
              onChange={(e) => setReceiveQty(Number(e.target.value))}
            />
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
    </div>
  )
}
