import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { usableImageUrl } from '@/lib/productPhoto'
import type { Product, ProductInput } from '@/types/database'

type ApiProduct = {
  id: string
  name: string
  barcode: string | null
  sku: string | null
  category?: { name: string } | null
  costPrice: number
  sellingPrice: number
  stockQuantity: number
  lowStockThreshold: number
  trackExpiry?: boolean
  expiryDate?: string | null
  requiresPrescription?: boolean
  imageUrl: string | null
  preferredSupplierId?: string | null
  preferredSupplier?: { id: string; name: string } | null
  _count?: { batches?: number }
  createdAt: string
  updatedAt: string
}

function mapProduct(p: ApiProduct): Product {
  return {
    id: p.id,
    name: p.name,
    barcode: p.barcode,
    sku: p.sku,
    category: p.category?.name || 'General',
    cost_price: p.costPrice,
    selling_price: p.sellingPrice,
    stock_quantity: p.stockQuantity,
    low_stock_threshold: p.lowStockThreshold,
    image_url: usableImageUrl(p.imageUrl) || null,
    preferred_supplier_id: p.preferredSupplierId || p.preferredSupplier?.id || null,
    preferred_supplier_name: p.preferredSupplier?.name || null,
    track_expiry: Boolean(p.trackExpiry),
    expiry_date: p.expiryDate || null,
    requires_prescription: Boolean(p.requiresPrescription),
    open_batches: p._count?.batches || 0,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }
}

export function useProducts(opts?: { lean?: boolean }) {
  const lean = Boolean(opts?.lean)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async (refreshOpts?: { silent?: boolean }) => {
    if (!refreshOpts?.silent) setLoading(true)
    setError('')
    try {
      const path = lean ? '/products?lean=1' : '/products'
      const data = await api<{ products: ApiProduct[] }>(path)
      setProducts(data.products.map(mapProduct))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products')
    } finally {
      if (!refreshOpts?.silent) setLoading(false)
    }
  }, [lean])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function createProduct(input: ProductInput) {
    const data = await api<{ product: ApiProduct }>('/products', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        barcode: input.barcode || undefined,
        sku: input.sku || undefined,
        category: input.category,
        costPrice: input.cost_price,
        sellingPrice: input.selling_price,
        stockQuantity: input.stock_quantity,
        lowStockThreshold: input.low_stock_threshold,
        imageUrl: input.image_url || undefined,
        preferredSupplierId: input.preferred_supplier_id || null,
        trackExpiry: input.track_expiry ?? false,
        requiresPrescription: input.requires_prescription ?? false,
      }),
    })
    await refresh()
    return mapProduct(data.product)
  }

  async function updateProduct(productId: string, input: ProductInput) {
    const data = await api<{ product: ApiProduct }>(`/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: input.name,
        barcode: input.barcode || null,
        sku: input.sku || null,
        category: input.category,
        costPrice: input.cost_price,
        sellingPrice: input.selling_price,
        stockQuantity: input.stock_quantity,
        lowStockThreshold: input.low_stock_threshold,
        imageUrl: input.image_url || null,
        preferredSupplierId: input.preferred_supplier_id || null,
        trackExpiry: input.track_expiry ?? false,
        requiresPrescription: input.requires_prescription ?? false,
      }),
    })
    await refresh()
    return mapProduct(data.product)
  }

  async function deleteProduct(productId: string) {
    await api(`/products/${productId}`, { method: 'DELETE' })
    await refresh()
  }

  /** Optimistic stock patch after a sale — no full catalogue reload. */
  const applyStockDeltas = useCallback(
    (deltas: Array<{ productId: string; delta: number }>) => {
      if (!deltas.length) return
      const map = new Map(deltas.map((d) => [d.productId, d.delta]))
      setProducts((prev) =>
        prev.map((p) => {
          const delta = map.get(p.id)
          if (delta == null) return p
          return {
            ...p,
            stock_quantity: Math.max(0, p.stock_quantity + delta),
          }
        }),
      )
    },
    [],
  )

  return {
    products,
    loading,
    error,
    refresh,
    applyStockDeltas,
    createProduct,
    updateProduct,
    deleteProduct,
  }
}
