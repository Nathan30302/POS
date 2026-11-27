import { useRef } from 'react'
import { ProductPhoto } from '@/components/ProductPhoto'
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
      className={`group relative touch-manipulation select-none overflow-hidden rounded-2xl border text-left transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 ${
        inCart
          ? 'border-royal/50 bg-royal/10 shadow-md shadow-royal/10'
          : 'border-line bg-card hover:border-royal/35 hover:shadow-md'
      }`}
    >
      {inCart > 0 ? (
        <span className="absolute right-2 top-2 z-10 inline-flex min-w-7 items-center justify-center rounded-full bg-royal px-2 py-1 text-xs font-bold text-white shadow">
          ×{inCart}
        </span>
      ) : null}

      <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface">
        <ProductPhoto
          src={product.image_url}
          name={product.name}
          category={product.category}
          className="pointer-events-none h-full w-full"
          imgClassName="transition duration-300 group-hover:scale-[1.03]"
        />
        {low && !out ? (
          <span className="absolute bottom-2 left-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
            Low stock
          </span>
        ) : null}
        {out ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-bold text-white">
            Out of stock
          </span>
        ) : null}
      </div>

      <div className="space-y-1 px-2.5 py-2 sm:px-3 sm:py-2.5">
        <p className="line-clamp-2 min-h-[2.4rem] text-[13px] font-semibold leading-snug text-ink sm:text-sm">
          {product.name}
        </p>
        <div className="flex items-end justify-between gap-2">
          <p className="font-display text-[0.95rem] font-bold tabular-nums text-brand sm:text-base">
            {formatZMW(product.selling_price)}
          </p>
          <p className="text-[11px] tabular-nums text-ink-soft">
            {out ? '—' : `${product.stock_quantity} left`}
          </p>
        </div>
      </div>
    </button>
  )
}
