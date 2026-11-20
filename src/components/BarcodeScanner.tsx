import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  SCAN_COOLDOWN_MS,
  useFastBarcodeCamera,
} from '@/hooks/useFastBarcodeCamera'
import { runScanSelfTest } from '@/lib/scanSelfTest'
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
  const [hitFlash, setHitFlash] = useState(false)
  const [bench, setBench] = useState('')
  const mobile = isMobileUa()

  onScanRef.current = onScan
  continuousRef.current = continuous

  useEffect(() => {
    unlockAudio()
    void runScanSelfTest()
      .then((r) => {
        const line = `${r.engine} ${r.ms.toFixed(0)}ms warm${r.ok ? '' : ' · slow'}`
        setBench(line)
        if (import.meta.env.DEV) {
          console.info('[nexora-scan]', r)
        }
      })
      .catch(() => setBench(''))
  }, [])

  const { status, engine, error, ticks } = useFastBarcodeCamera(videoRef, {
    enabled: true,
    sessionKey,
    preferUserCamera: !mobile,
    cooldownMs: continuous ? SCAN_COOLDOWN_MS : 400,
    onCode: (code) => {
      unlockAudio()
      try {
        navigator.vibrate?.(28)
      } catch {
        // ignore
      }
      setLastHit(code)
      setHitFlash(true)
      window.setTimeout(() => setHitFlash(false), 280)
      onScanRef.current(code)
      if (!continuousRef.current) onClose()
    },
  })

  return (
    <div className="space-y-3">
      <div
        className={`scanner-shell relative overflow-hidden rounded-2xl border bg-black transition ${
          hitFlash ? 'border-emerald-400 ring-4 ring-emerald-400/40' : 'border-line'
        }`}
      >
        <video
          ref={videoRef}
          className="h-[min(68vh,520px)] w-full bg-black object-cover"
          muted
          playsInline
          autoPlay
        />
        {/* Aim guide — matches ROI strip used by the detector */}
        <div className="pointer-events-none absolute inset-x-[9%] top-1/2 h-[30%] -translate-y-1/2">
          <div className="h-full rounded-2xl border-[3px] border-teal-300/95 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]" />
          <div className="absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-teal-300/80" />
        </div>
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/75 to-transparent px-4 py-3 text-xs font-semibold text-white">
          <span>
            {status === 'live'
              ? 'Hold barcode in the box'
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
            {status === 'live' ? (
              <span className="tabular-nums opacity-90">
                {engine || 'Live'} · {ticks}
              </span>
            ) : (
              '—'
            )}
          </span>
        </div>
        {lastHit || statusMessage ? (
          <div
            className={`absolute inset-x-3 bottom-3 rounded-xl px-3 py-2.5 text-center text-sm font-bold text-white shadow-lg ${
              hitFlash ? 'bg-emerald-500 scale-[1.02]' : 'bg-emerald-600/95'
            }`}
          >
            {lastHit ? `✓ ${lastHit}` : statusMessage}
          </div>
        ) : (
          <div className="absolute inset-x-3 bottom-3 rounded-xl bg-black/55 px-3 py-2 text-center text-xs font-medium text-white/90">
            Fill the teal box · stays open for the next item
          </div>
        )}
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

      <div className="flex items-center justify-between gap-3">
        {bench ? (
          <p className="text-[11px] text-ink-soft tabular-nums">{bench}</p>
        ) : (
          <span />
        )}
        <Button type="button" variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  )
}
