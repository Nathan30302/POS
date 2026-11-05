import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useFastBarcodeCamera } from '@/hooks/useFastBarcodeCamera'

type Props = {
  onScan: (code: string) => void
  onClose: () => void
  continuous?: boolean
  statusMessage?: string
  statusTone?: 'ok' | 'error' | 'idle'
}

/**
 * Fast camera barcode scanner for product form + checkout.
 * Phone cameras are much quicker — use Connect phone on Checkout for that.
 */
export function BarcodeScanner({
  onScan,
  onClose,
  continuous = false,
  statusMessage,
  statusTone = 'idle',
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const onScanRef = useRef(onScan)
  const continuousRef = useRef(continuous)
  const [manual, setManual] = useState('')

  onScanRef.current = onScan
  continuousRef.current = continuous

  const { status, engine, error, ticks } = useFastBarcodeCamera(videoRef, {
    enabled: true,
    cooldownMs: continuous ? 650 : 1200,
    onCode: (code) => {
      onScanRef.current(code)
      if (!continuousRef.current) onClose()
    },
  })

  useEffect(() => {
    const value = manual.trim()
    if (!/^\d{8,14}$/.test(value)) return
    const timer = window.setTimeout(() => {
      onScanRef.current(value)
      setManual('')
      if (!continuousRef.current) onClose()
    }, 60)
    return () => window.clearTimeout(timer)
  }, [manual, onClose])

  const statusClass =
    statusTone === 'ok'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : statusTone === 'error'
        ? 'border-red-100 bg-red-50 text-danger'
        : 'border-line bg-slate-50 text-ink-soft'

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">
        Hold the barcode 10–20cm from the camera. On a phone this is usually
        under 2 seconds. Laptop webcams are slower — prefer{' '}
        <strong>Connect phone</strong>.
      </p>

      <div className="scanner-shell relative overflow-hidden rounded-2xl border border-line bg-black">
        <video
          ref={videoRef}
          className="h-[320px] w-full object-cover"
          muted
          playsInline
          autoPlay
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 py-3 text-xs font-medium text-white">
          <span>
            {status === 'starting'
              ? 'Starting camera…'
              : status === 'live'
                ? `LIVE · ${engine || 'scanning'}`
                : 'Camera issue'}
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                status === 'live' ? 'animate-pulse bg-emerald-400' : 'bg-slate-400'
              }`}
            />
            {status === 'live' ? ticks : '—'}
          </span>
        </div>
        <div className="pointer-events-none absolute inset-x-6 top-1/2 h-28 -translate-y-1/2 rounded-xl border-2 border-teal-300/95" />
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-ink">
          Or type / paste barcode (auto-adds)
        </span>
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              const value = manual.trim()
              if (!value) return
              onScan(value)
              setManual('')
              if (!continuous) onClose()
            }
          }}
          placeholder="6001234567001"
          className="w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
          autoComplete="off"
          inputMode="numeric"
        />
      </label>

      {continuous ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-ink-soft">Quick test:</p>
          <div className="flex flex-wrap gap-2">
            {[
              ['6001234567001', 'Black pen'],
              ['6001234567002', 'Blue pen'],
              ['6001234567018', 'Eraser'],
            ].map(([code, label]) => (
              <button
                key={code}
                type="button"
                onClick={() => onScan(code)}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink hover:border-brand hover:bg-brand-soft/40"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {statusMessage ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${statusClass}`}
        >
          {statusMessage}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          {continuous ? 'Done' : 'Cancel'}
        </Button>
      </div>
    </div>
  )
}
