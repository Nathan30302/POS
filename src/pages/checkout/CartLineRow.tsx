import { Minus, Plus, Trash2 } from 'lucide-react'
import { usePressRepeat } from '@/hooks/usePressRepeat'
import { formatZMW } from '@/lib/money'
import type { CartLine } from '@/types/database'

type Props = {
  line: CartLine
  onSetQty: (productId: string, quantity: number) => void
  onRemove: (productId: string) => void
}

export function CartLineRow({ line, onSetQty, onRemove }: Props) {
  const minus = usePressRepeat(() =>
    onSetQty(line.product.id, line.quantity - 1),
  )
  const plus = usePressRepeat(() =>
    onSetQty(line.product.id, line.quantity + 1),
  )

  return (
    <li className="rounded-xl border border-line bg-card px-3 py-2.5 sm:py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug text-ink">
            {line.product.name}
          </p>
          <p className="mt-0.5 text-xs text-ink-soft">
            {formatZMW(line.product.selling_price)} each
            {line.quantity >= line.product.stock_quantity ? ' · max stock' : ''}
          </p>
        </div>
        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-soft transition hover:bg-danger/10 hover:text-danger"
          onClick={() => onRemove(line.product.id)}
          aria-label="Remove"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5">
          <button
            type="button"
            className="touch-manipulation flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-card active:bg-card"
            aria-label="Decrease quantity"
            {...minus}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-9 text-center text-base font-semibold tabular-nums text-ink">
            {line.quantity}
          </span>
          <button
            type="button"
            className="touch-manipulation flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-card active:bg-card"
            aria-label="Increase quantity"
            {...plus}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <p className="font-semibold tabular-nums text-ink">
          {formatZMW(line.product.selling_price * line.quantity)}
        </p>
      </div>
    </li>
  )
}
