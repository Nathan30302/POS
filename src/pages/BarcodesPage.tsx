import { useMemo } from 'react'
import { BarcodeLabel } from '@/components/BarcodeLabel'
import { PageHero } from '@/components/PageHero'
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
      <PageHero
        eyebrow="Labels · print"
        title="Printable barcodes"
        subtitle="Print this page, stick codes on products, then scan them at the counter. Phone cameras usually beat laptop webcams."
        actions={
          <Button
            type="button"
            className="bg-[#3563E9] hover:bg-[#2f58d4]"
            onClick={() => window.print()}
          >
            Print sheet
          </Button>
        }
      />

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
