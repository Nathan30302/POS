import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
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
  imageUrl: string | null
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
    image_url: p.imageUrl,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api<{ products: ApiProduct[] }>('/products')
      setProducts(data.products.map(mapProduct))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [])

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
      }),
    })
    await refresh()
    return mapProduct(data.product)
  }

  async function deleteProduct(productId: string) {
    await api(`/products/${productId}`, { method: 'DELETE' })
    await refresh()
  }

  return {
    products,
    loading,
    error,
    refresh,
    createProduct,
    updateProduct,
    deleteProduct,
  }
}
