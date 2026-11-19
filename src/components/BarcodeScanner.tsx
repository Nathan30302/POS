import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  SCAN_COOLDOWN_MS,
  useFastBarcodeCamera,
} from '@/hooks/useFastBarcodeCamera'
import { unlockAudio } from '@/lib/sounds'

type Props = {
  onScan: (code: string) => void
  onClose: () => void
  continuous?: boolean
  statusMessage?: string
  statusTone?: 'ok' | 'error' | 'idle'
}

function isMobileUa() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

/**
 * Live barcode gun — camera stays open, beep + add on each hit.
 * Needs HTTPS / localhost (secure context).
 */
export function BarcodeScanner({
  onScan,
  onClose,
  continuous = true,
  statusMessage,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const onScanRef = useRef(onScan)
  const continuousRef = useRef(continuous)
  const [sessionKey, setSessionKey] = useState(0)
  const [lastHit, setLastHit] = useState('')
  const mobile = isMobileUa()

  onScanRef.current = onScan
  continuousRef.current = continuous

  useEffect(() => {
    unlockAudio()
  }, [])

  const { status, error, ticks } = useFastBarcodeCamera(videoRef, {
    enabled: true,
    sessionKey,
    preferUserCamera: !mobile,
    // Single cooldown — beep/haptic live in Sell addProduct
    cooldownMs: continuous ? SCAN_COOLDOWN_MS : 450,
    onCode: (code) => {
      unlockAudio()
      try {
        navigator.vibrate?.(30)
      } catch {
        // ignore
      }
      setLastHit(code)
      onScanRef.current(code)
      if (!continuousRef.current) onClose()
    },
  })

  return (
    <div className="space-y-3">
      <div className="scanner-shell relative overflow-hidden rounded-2xl border border-line bg-black">
        <video
          ref={videoRef}
          className="h-[min(62vh,440px)] w-full bg-black object-cover"
          muted
          playsInline
          autoPlay
        />
        <div className="pointer-events-none absolute inset-x-8 top-[42%] h-36 -translate-y-1/2 rounded-2xl border-[3px] border-teal-300" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-4 py-3 text-xs font-semibold text-white">
          <span>
            {status === 'live'
              ? 'Point at barcode'
              : status === 'starting'
                ? 'Opening camera…'
                : 'Camera'}
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
        {lastHit || statusMessage ? (
          <div className="absolute inset-x-3 bottom-3 rounded-xl bg-emerald-500 px-3 py-2.5 text-center text-sm font-bold text-white shadow-lg">
            {lastHit ? `✓ ${lastHit}` : statusMessage}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-danger">
          <p>{error}</p>
          <p className="mt-1 text-xs text-ink-soft">
            Use the HTTPS shop link on the phone, tap Allow for camera, then Retry.
          </p>
          <Button
            type="button"
            className="mt-3 rounded-xl"
            onClick={() => {
              unlockAudio()
              setSessionKey((n) => n + 1)
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Retry camera
          </Button>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}
