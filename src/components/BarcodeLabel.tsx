import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

type Props = {
  value: string
  label?: string
  height?: number
}

/** Renders a real scannable barcode (print this page / product labels). */
export function BarcodeLabel({ value, label, height = 56 }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null)

  useEffect(() => {
    if (!svgRef.current || !value) return
    try {
      JsBarcode(svgRef.current, value, {
        format: 'EAN13',
        width: 2,
        height,
        displayValue: true,
        fontSize: 14,
        margin: 8,
        background: '#ffffff',
        lineColor: '#0f172a',
      })
    } catch {
      // Non-EAN codes fall back to CODE128
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: 2,
          height,
          displayValue: true,
          fontSize: 14,
          margin: 8,
        })
      } catch {
        // ignore invalid
      }
    }
  }, [height, value])

  if (!value) return null

  return (
    <div className="inline-flex flex-col items-center rounded-xl border border-line bg-white p-3">
      {label ? (
        <p className="mb-1 max-w-[220px] truncate text-xs font-medium text-ink">
          {label}
        </p>
      ) : null}
      <svg ref={svgRef} />
    </div>
  )
}
