import { useMemo } from 'react'
import { BarcodeLabel } from '@/components/BarcodeLabel'
import { Button } from '@/components/ui/Button'
import { useProducts } from '@/hooks/useProducts'

/** Printable barcode sheet — print these, then scan with phone/camera/gun. */
export function BarcodesPage() {
  const { products, loading } = useProducts()
  const withCodes = useMemo(
    () => products.filter((p) => p.barcode),
    [products],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Labels
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-ink">
            Printable barcodes
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">
            Print this page, stick codes on products, then scan them at Checkout.
            Phone cameras usually beat laptop webcams. A USB barcode gun is
            fastest of all.
          </p>
        </div>
        <Button type="button" onClick={() => window.print()}>
          Print sheet
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
          {withCodes.map((product) => (
            <BarcodeLabel
              key={product.id}
              value={product.barcode!}
              label={product.name}
            />
          ))}
        </div>
      )}
    </div>
  )
}
