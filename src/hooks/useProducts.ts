import { useCallback, useEffect, useState } from 'react'
import { localDb } from '@/lib/localDb'
import type { Product, ProductInput } from '@/types/database'

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // Tiny delay so loading states feel intentional on fast local reads
      await Promise.resolve()
      setProducts(localDb.listProducts())
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
    const product = localDb.createProduct(input)
    setProducts(localDb.listProducts())
    return product
  }

  async function updateProduct(productId: string, input: ProductInput) {
    const product = localDb.updateProduct(productId, input)
    setProducts(localDb.listProducts())
    return product
  }

  async function deleteProduct(productId: string) {
    localDb.deleteProduct(productId)
    setProducts(localDb.listProducts())
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
