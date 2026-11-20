import { useRef } from 'react'
import { formatZMW } from '@/lib/money'
import type { Product } from '@/types/database'

type Props = {
  product: Product
  inCart: number
  onAdd: (productId: string, qty?: number) => void
}

const LONG_MS = 420

export function CatalogueTile({ product, inCart, onAdd }: Props) {
  const longTimer = useRef<number | null>(null)
  const suppressClick = useRef(false)
  const low = product.stock_quantity <= product.low_stock_threshold
  const out = product.stock_quantity <= 0

  function clearTimer() {
    if (longTimer.current != null) {
      window.clearTimeout(longTimer.current)
      longTimer.current = null
    }
  }

  function addMany() {
    const room = Math.max(0, product.stock_quantity - inCart)
    const add = Math.min(5, room || 5)
    onAdd(product.id, add)
    try {
      navigator.vibrate?.(40)
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      disabled={out}
      onPointerDown={() => {
        suppressClick.current = false
        clearTimer()
        longTimer.current = window.setTimeout(() => {
          suppressClick.current = true
          addMany()
        }, LONG_MS)
      }}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false
          return
        }
        onAdd(product.id, 1)
      }}
      className={`relative touch-manipulation select-none rounded-xl border px-3 py-3 text-left transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${
        inCart
          ? 'border-royal/40 bg-royal/10 hover:bg-royal/15'
          : 'border-line hover:border-brand hover:bg-brand-soft/40'
      }`}
    >
      {inCart > 0 ? (
        <span className="absolute right-2 top-2 inline-flex min-w-6 items-center justify-center rounded-full bg-royal px-1.5 py-0.5 text-[11px] font-bold text-white">
          {inCart}
        </span>
      ) : null}
      {product.image_url ? (
        <img
          src={product.image_url}
          alt=""
          className="pointer-events-none mb-2 h-16 w-full rounded-lg object-cover bg-surface"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div className="mb-2 flex h-12 items-center justify-center rounded-lg bg-surface text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
          {product.category}
        </div>
      )}
      <p className="line-clamp-2 text-sm font-medium text-ink">{product.name}</p>
      <p className="mt-1 text-sm font-semibold text-brand">
        {formatZMW(product.selling_price)}
      </p>
      <p className="mt-0.5 text-[11px] text-ink-soft">
        {out
          ? 'Out of stock'
          : `Stock ${product.stock_quantity}${low ? ' · low' : ''}`}
      </p>
      <p className="mt-1 text-[10px] text-ink-soft/70">Hold +5</p>
    </button>
  )
}
