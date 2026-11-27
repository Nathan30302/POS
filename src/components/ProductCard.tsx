import { ProductPhoto } from '@/components/ProductPhoto'
import { formatZMW } from '@/lib/money'
import type { Product } from '@/types/database'

type Props = {
  product: Product
  showCost?: boolean
  onOpen?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onReceive?: () => void
  onHistory?: () => void
}

/** Inventory catalogue card — tap anywhere to open; actions stop propagation. */
export function ProductCard({
  product,
  showCost,
  onOpen,
  onEdit,
  onDelete,
  onReceive,
  onHistory,
}: Props) {
  const low = product.stock_quantity <= product.low_stock_threshold
  const open = onOpen || onEdit

  return (
    <article
      className={`overflow-hidden rounded-[var(--radius-xl)] border border-line bg-card shadow-[var(--shadow)] transition ${
        open
          ? 'cursor-pointer hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md active:scale-[0.99]'
          : ''
      }`}
      onClick={open}
      onKeyDown={
        open
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                open()
              }
            }
          : undefined
      }
      role={open ? 'button' : undefined}
      tabIndex={open ? 0 : undefined}
    >
      <div className="relative aspect-[4/3] bg-surface">
        <ProductPhoto
          src={product.image_url}
          name={product.name}
          category={product.category}
          hint={onEdit ? 'Add photo' : undefined}
          className="h-full w-full"
        />
        <span className="pointer-events-none absolute left-2 top-2 rounded-lg bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          {product.category}
        </span>
        {low ? (
          <span className="absolute bottom-2 left-2 rounded-lg bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
            Low stock
          </span>
        ) : null}
      </div>

      <div className="space-y-2 p-3 sm:p-3.5">
        <div>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink sm:text-[0.95rem]">
            {product.name}
          </h3>
          <p className="mt-0.5 font-mono text-[10px] text-ink-soft sm:mt-1 sm:text-[11px]">
            {product.sku || '—'}
            {product.barcode ? ` · ${product.barcode}` : ''}
          </p>
        </div>

        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="font-display text-base font-bold tabular-nums text-brand sm:text-lg">
              {formatZMW(product.selling_price)}
            </p>
            {showCost ? (
              <p className="text-[11px] text-ink-soft">
                Cost {formatZMW(product.cost_price)}
              </p>
            ) : null}
          </div>
          <span
            className={`rounded-lg px-2 py-1 text-[11px] font-bold tabular-nums sm:px-2.5 sm:text-xs ${
              low
                ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200'
                : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
            }`}
          >
            {product.stock_quantity} in stock
          </span>
        </div>

        {(onEdit || onDelete || onReceive || onHistory) && (
          <div
            className="space-y-1.5 border-t border-line pt-2"
            onClick={(e) => e.stopPropagation()}
          >
            {(onEdit || onReceive || onDelete) && (
              <div className="space-y-1.5">
                {onEdit || onReceive ? (
                  <div className="flex gap-1.5">
                    {onEdit ? (
                      <button
                        type="button"
                        className="min-h-11 min-w-0 flex-1 rounded-xl bg-royal/12 px-2 text-xs font-bold text-royal"
                        onClick={onEdit}
                      >
                        Edit
                      </button>
                    ) : null}
                    {onReceive ? (
                      <button
                        type="button"
                        className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-card px-2 text-xs font-bold text-ink"
                        onClick={onReceive}
                      >
                        Receive
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    className="min-h-11 w-full rounded-xl border border-danger/30 bg-danger/10 px-2 text-xs font-bold text-danger"
                    onClick={onDelete}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            )}
            {onHistory ? (
              <button
                type="button"
                className="flex min-h-9 w-full items-center justify-center rounded-lg text-[11px] font-semibold text-ink-soft"
                onClick={onHistory}
              >
                Stock history
              </button>
            ) : null}
          </div>
        )}
      </div>
    </article>
  )
}
