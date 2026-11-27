import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { enqueueBarcodeEncode } from '@/lib/barcodeEncodeQueue'

type Props = {
  value: string
  label?: string
  height?: number
  /** Compact sticker tile for blank pre-print sheets. */
  sticker?: boolean
  className?: string
  /**
   * When true (default for sticker sheets), encode via the shared stagger
   * queue so large print jobs stay responsive.
   */
  deferEncode?: boolean
}

function encodeBarcode(
  svg: SVGSVGElement,
  value: string,
  opts: {
    width: number
    height: number
    displayValue: boolean
    fontSize: number
    margin: number
    background: string
    lineColor: string
  },
) {
  try {
    JsBarcode(svg, value, { format: 'EAN13', ...opts })
  } catch {
    try {
      JsBarcode(svg, value, { format: 'CODE128', ...opts })
    } catch {
      // ignore invalid
    }
  }
}

/** Renders a real scannable barcode (print this page / product labels). */
export function BarcodeLabel({
  value,
  label,
  height = 56,
  sticker = false,
  className = '',
  deferEncode,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const barHeight = sticker ? Math.min(height, 40) : height
  const stagger = deferEncode ?? sticker

  useEffect(() => {
    if (!svgRef.current || !value) return
    const svg = svgRef.current
    const opts = {
      width: sticker ? 1.6 : 2,
      height: barHeight,
      displayValue: true,
      fontSize: sticker ? 11 : 14,
      margin: sticker ? 4 : 8,
      background: '#ffffff',
      lineColor: '#0f172a',
    } as const

    const run = () => encodeBarcode(svg, value, opts)

    if (!stagger) {
      run()
      return
    }

    return enqueueBarcodeEncode(run)
  }, [barHeight, sticker, stagger, value])

  if (!value) return null

  return (
    <div
      className={
        sticker
          ? `barcode-sticker inline-flex flex-col items-center justify-center border border-dashed border-slate-300 bg-white p-2 ${className}`
          : `inline-flex flex-col items-center rounded-xl border border-line bg-white p-3 ${className}`
      }
    >
      {label ? (
        <p className="mb-1 max-w-[220px] truncate text-xs font-medium text-ink">
          {label}
        </p>
      ) : null}
      <svg ref={svgRef} />
    </div>
  )
}
