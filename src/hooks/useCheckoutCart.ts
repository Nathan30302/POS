import { useCallback, useMemo, useState } from 'react'
import type { CartLine } from '@/types/database'

/** Cart state helpers extracted from Sell — keeps CheckoutPage thinner. */
export function useCheckoutCart() {
  const [cart, setCart] = useState<CartLine[]>([])

  const setQty = useCallback((productId: string, quantity: number) => {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.product.id !== productId) return line
          const max = line.product.stock_quantity
          return { ...line, quantity: Math.min(Math.max(0, quantity), max) }
        })
        .filter((line) => line.quantity > 0),
    )
  }, [])

  const removeLine = useCallback((productId: string) => {
    setCart((prev) => prev.filter((l) => l.product.id !== productId))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
  }, [])

  const restoreCart = useCallback((lines: CartLine[]) => {
    setCart(lines.map((line) => ({ ...line })))
  }, [])

  const subtotal = useMemo(
    () =>
      cart.reduce(
        (sum, line) => sum + line.product.selling_price * line.quantity,
        0,
      ),
    [cart],
  )

  const itemCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity, 0),
    [cart],
  )

  return {
    cart,
    setCart,
    setQty,
    removeLine,
    clearCart,
    restoreCart,
    subtotal,
    itemCount,
  }
}
