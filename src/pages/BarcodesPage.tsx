import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PackagePlus, Printer, Tag } from 'lucide-react'
import { BarcodeLabel } from '@/components/BarcodeLabel'
import { EmptyState, LoadingBlock } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { useProducts } from '@/hooks/useProducts'

/** Printable barcode sheet — print these, then scan with phone/camera/gun. */
export function BarcodesPage() {
  const { products, loading } = useProducts()
  const withCodes = useMemo(
    () => products.filter((p) => (p.barcode ?? '').trim().length > 0),
    [products],
  )
  const missing = products.length - withCodes.length

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHero
        eyebrow="Labels · shelf ready"
        title="Barcode labels"
        subtitle="Print stickers, label stock, then scan at Sell with phone gun or USB."
        actions={
          withCodes.length > 0 ? (
            <Button
              type="button"
              className="bg-[#3563E9] hover:bg-[#2f58d4]"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Print sheet
            </Button>
          ) : null
        }
      />

      {loading ? (
        <div className="nx-card">
          <LoadingBlock label="Preparing labels…" />
        </div>
      ) : withCodes.length === 0 ? (
        <div className="nx-card">
          <EmptyState
            icon={Tag}
            title="No barcodes to print"
            body="Add barcodes on Inventory products (type, scan, or voice), then print stickers here."
            action={
              <Link to="/app/products">
                <Button type="button">
                  <PackagePlus className="h-4 w-4" />
                  Open Inventory
                </Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {missing > 0 ? (
            <p className="text-xs text-ink-soft">
              Showing {withCodes.length} labeled products · {missing} still need
              a barcode in Inventory.
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
            {withCodes.map((product) => (
              <BarcodeLabel
                key={product.id}
                value={product.barcode!}
                label={product.name}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
