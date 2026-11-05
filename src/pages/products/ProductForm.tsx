import { useState, type FormEvent } from 'react'
import { ScanLine } from 'lucide-react'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import type { Product, ProductInput } from '@/types/database'
import { PRODUCT_CATEGORIES } from '@/types/database'

type Props = {
  initial?: Product | null
  showCost?: boolean
  onSubmit: (input: ProductInput) => Promise<void>
  onCancel: () => void
}

function toInput(product?: Product | null): ProductInput {
  return {
    name: product?.name ?? '',
    barcode: product?.barcode ?? '',
    sku: product?.sku ?? '',
    category: product?.category ?? 'Writing',
    cost_price: Number(product?.cost_price ?? 0),
    selling_price: Number(product?.selling_price ?? 0),
    stock_quantity: Number(product?.stock_quantity ?? 0),
    low_stock_threshold: Number(product?.low_stock_threshold ?? 10),
    image_url: product?.image_url ?? '',
  }
}

export function ProductForm({
  initial,
  showCost = true,
  onSubmit,
  onCancel,
}: Props) {
  const [form, setForm] = useState<ProductInput>(() => toInput(initial))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [scanOpen, setScanOpen] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (!form.name.trim()) throw new Error('Name is required')
      if (form.selling_price < 0 || form.cost_price < 0) {
        throw new Error('Prices cannot be negative')
      }
      await onSubmit({
        ...form,
        name: form.name.trim(),
        barcode: form.barcode.trim(),
        sku: form.sku.trim(),
        category: form.category.trim() || 'General',
        image_url: form.image_url.trim(),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save product')
      setSaving(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Product name"
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="e.g. Black Gel Pen 0.7mm"
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink">Barcode</span>
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-deep"
              >
                <ScanLine className="h-3.5 w-3.5" />
                Scan
              </button>
            </div>
            <input
              value={form.barcode}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, barcode: e.target.value }))
              }
              placeholder="Scan or type barcode"
              className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
          </div>

          <Input
            label="SKU"
            value={form.sku}
            onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))}
            placeholder="PEN-BLK-07"
          />
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Category</span>
          <select
            value={form.category}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, category: e.target.value }))
            }
            className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15"
          >
            {PRODUCT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <div className={`grid gap-4 ${showCost ? 'sm:grid-cols-2' : ''}`}>
          {showCost ? (
            <Input
              label="Cost price (ZMW)"
              type="number"
              min="0"
              step="0.01"
              value={form.cost_price}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  cost_price: Number(e.target.value),
                }))
              }
            />
          ) : null}
          <Input
            label="Selling price (ZMW)"
            type="number"
            min="0"
            step="0.01"
            value={form.selling_price}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                selling_price: Number(e.target.value),
              }))
            }
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Stock quantity"
            type="number"
            min="0"
            step="1"
            value={form.stock_quantity}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                stock_quantity: Number(e.target.value),
              }))
            }
          />
          <Input
            label="Low stock threshold"
            type="number"
            min="0"
            step="1"
            value={form.low_stock_threshold}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                low_stock_threshold: Number(e.target.value),
              }))
            }
          />
        </div>

        <Input
          label="Image URL (optional)"
          value={form.image_url}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, image_url: e.target.value }))
          }
          placeholder="/products/pen-black.jpg"
          hint="Use a public URL or a path under /public for demo images."
        />

        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Add product'}
          </Button>
        </div>
      </form>

      {scanOpen ? (
        <Modal title="Scan barcode" onClose={() => setScanOpen(false)}>
          <BarcodeScanner
            onScan={(code) => {
              setForm((prev) => ({ ...prev, barcode: code }))
              setScanOpen(false)
            }}
            onClose={() => setScanOpen(false)}
          />
        </Modal>
      ) : null}
    </>
  )
}
