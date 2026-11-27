import { useEffect, useRef, useState } from 'react'
import { Check, Minus, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  SCAN_COOLDOWN_MS,
  openCameraStream,
  useFastBarcodeCamera,
  type ScanHit,
  type ScanIntent,
} from '@/hooks/useFastBarcodeCamera'
import { unlockAudio } from '@/lib/sounds'

type Props = {
  onScan: (code: string, intent?: ScanIntent) => void
  onClose: () => void
  continuous?: boolean
  statusMessage?: string
  statusTone?: 'ok' | 'error' | 'idle'
  cartHint?: string
  showDone?: boolean
  /** Product / label capture — no Add/Remove cart modes, single-shot feel. */
  captureOnly?: boolean
}

function isMobileUa() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

function armErrorMessage(err: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Live camera needs a secure link (HTTPS). Open the shop HTTPS URL, allow camera, then Retry.'
  }
  const name =
    err && typeof err === 'object' && 'name' in err
      ? String((err as { name: string }).name)
      : ''
  const message = err instanceof Error ? err.message : ''
  if (
    name === 'NotAllowedError' ||
    /permission|notallowed|denied/i.test(message)
  ) {
    return 'Camera permission blocked — Allow camera, then Retry.'
  }
  if (name === 'NotFoundError' || /not found|no device/i.test(message)) {
    return 'No camera found — close this and scan with a USB barcode gun into the search box instead.'
  }
  if (name === 'NotReadableError' || /track|in use|busy/i.test(message)) {
    return 'Camera is busy in another app — close it, then Retry.'
  }
  return message || 'Could not open camera.'
}

/**
 * Clean barcode reader — Add/Remove tint, center line, minimal chrome.
 * Video stays clear (no full-screen color wash that looked like a white blur).
 */
export function BarcodeScanner({
  onScan,
  onClose,
  continuous = true,
  statusMessage,
  cartHint,
  showDone = false,
  captureOnly = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const onScanRef = useRef(onScan)
  const continuousRef = useRef(continuous)
  const modeRef = useRef<ScanIntent>('add')
  const streamRef = useRef<MediaStream | null>(null)
  const [sessionKey, setSessionKey] = useState(0)
  const [mode, setMode] = useState<ScanIntent>('add')
  const [lastHit, setLastHit] = useState('')
  const [lastIntent, setLastIntent] = useState<ScanIntent>('add')
  const [hitFlash, setHitFlash] = useState(false)
  const [armError, setArmError] = useState('')
  const [arming, setArming] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const pausedRef = useRef(false)
  const mobile = isMobileUa()
  const secure =
    typeof window !== 'undefined' ? window.isSecureContext : true
  // Phones need a tap so Safari/Chrome keep the user gesture for getUserMedia
  const [armed, setArmed] = useState(!mobile)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)

  onScanRef.current = onScan
  continuousRef.current = continuous
  modeRef.current = mode

  useEffect(() => {
    unlockAudio()
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')
    video.muted = true
    video.defaultMuted = true
    // Never mirror or filter the preview — that caused washed-out white frames
    video.style.transform = 'none'
    video.style.filter = 'none'
    video.style.webkitTransform = 'none'
  }, [armed, sessionKey])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // Detect when real frames are painted (avoids white empty video shell)
  useEffect(() => {
    if (!armed) {
      setVideoReady(false)
      return
    }
    const video = videoRef.current
    if (!video) return
    let cancelled = false
    const check = () => {
      if (cancelled) return
      if (video.readyState >= 2 && video.videoWidth > 16) {
        setVideoReady(true)
        return
      }
      window.requestAnimationFrame(check)
    }
    check()
    const onPlaying = () => setVideoReady(true)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('loadeddata', onPlaying)
    return () => {
      cancelled = true
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('loadeddata', onPlaying)
    }
  }, [armed, sessionKey, mediaStream])

  function setScanMode(next: ScanIntent) {
    setMode(next)
    modeRef.current = next
    unlockAudio()
  }

  async function armCamera() {
    unlockAudio()
    setArmError('')
    setVideoReady(false)
    if (!secure) {
      setArmError(
        'Live camera needs a secure link (HTTPS). Open the shop HTTPS URL on this phone, then Retry.',
      )
      return
    }
    setArming(true)
    try {
      // Open stream inside the tap — required for iOS Safari getUserMedia
      // preferUserCamera false on phones → rear camera
      const stream = await openCameraStream(!mobile)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        video.muted = true
        video.defaultMuted = true
        video.playsInline = true
        video.style.transform = 'none'
        video.style.filter = 'none'
        try {
          await video.play()
        } catch {
          // muted + playsInline usually recovers on loadedmetadata in the hook
        }
      }
      setMediaStream(stream)
      setArmed(true)
      setSessionKey((n) => n + 1)
    } catch (err) {
      setArmError(armErrorMessage(err))
      setArmed(false)
      setMediaStream(null)
    } finally {
      setArming(false)
    }
  }

  function applyHit(hit: ScanHit) {
    if (pausedRef.current) return
    const intent = modeRef.current
    unlockAudio()
    try {
      navigator.vibrate?.(intent === 'remove' ? [35, 30, 35] : 28)
    } catch {
      // ignore
    }
    setLastHit(hit.code)
    setLastIntent(intent)
    setHitFlash(true)
    window.setTimeout(() => setHitFlash(false), mobile ? 420 : 280)
    pausedRef.current = true
    window.setTimeout(() => {
      pausedRef.current = false
    }, mobile ? 480 : 260)
    onScanRef.current(hit.code, intent)
    if (!continuousRef.current) onClose()
  }

  const { status, error } = useFastBarcodeCamera(videoRef, {
    enabled: armed && secure,
    sessionKey,
    // Prefer stream opened from a tap (iOS + laptop Retry); else hook opens one
    mediaStream,
    preferUserCamera: !mobile,
    cooldownMs: continuous ? SCAN_COOLDOWN_MS : 220,
    requireLeaveFrame: true,
    onHit: applyHit,
  })

  const insecureMessage =
    'Live camera needs a secure link (HTTPS). Open the shop HTTPS URL on this phone, then Retry.'
  const displayError = !secure ? insecureMessage : armError || error

  const showBanner = hitFlash || (statusMessage && statusMessage.length > 0)
  const liveClear = armed && videoReady && status !== 'error'

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {captureOnly ? null : (
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setScanMode('add')}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-2xl text-sm font-bold transition active:scale-[0.98] ${
              mode === 'add'
                ? 'bg-emerald-500 text-white shadow-md'
                : 'border border-line bg-surface text-ink-soft'
            }`}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
          <button
            type="button"
            onClick={() => setScanMode('remove')}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-2xl text-sm font-bold transition active:scale-[0.98] ${
              mode === 'remove'
                ? 'bg-rose-500 text-white shadow-md'
                : 'border border-line bg-surface text-ink-soft'
            }`}
          >
            <Minus className="h-4 w-4" />
            Remove
          </button>
        </div>
      )}

      <div
        className={`scanner-shell relative min-h-[min(58dvh,420px)] flex-1 overflow-hidden rounded-2xl border border-line bg-black sm:min-h-[300px] ${
          hitFlash
            ? mode === 'remove'
              ? 'ring-4 ring-rose-400/50'
              : 'ring-4 ring-emerald-400/50'
            : ''
        }`}
      >
        {/* Always mounted so iOS can attach the gesture-opened stream immediately */}
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full bg-black object-cover ${
            liveClear ? 'opacity-100' : 'opacity-0'
          }`}
          muted
          playsInline
          autoPlay
          // Critical: no CSS filters / mirrors on the preview
          style={{ transform: 'none', filter: 'none' }}
        />

        {!armed ? (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#0b1224] px-5 text-center">
            <p className="text-sm font-semibold text-white">
              {secure
                ? 'Tap once to open the rear camera'
                : 'This page needs HTTPS for live scan'}
            </p>
            <p className="max-w-xs text-xs text-slate-400">
              Point at a barcode — it adds to the cart automatically.
            </p>
            <button
              type="button"
              onClick={() => void armCamera()}
              disabled={arming}
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[#3563E9] px-6 text-sm font-bold text-white disabled:opacity-70"
            >
              {arming ? 'Opening…' : 'Start live scan'}
            </button>
          </div>
        ) : null}

        {/* Dark loading shell until real frames — prevents white flash */}
        {armed && !liveClear ? (
          <div className="absolute inset-0 z-25 flex flex-col items-center justify-center gap-2 bg-[#0b1224] px-4 text-center">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400" />
            <p className="text-sm font-semibold text-white">
              {status === 'starting' ? 'Starting camera…' : 'Getting a clear picture…'}
            </p>
            <p className="text-xs text-slate-400">
              {mobile
                ? 'Keep the phone steady'
                : 'Hold the barcode steady · or close and use a USB scanner'}
            </p>
          </div>
        ) : null}

        {/* Edge mode hints only — never wash the whole preview */}
        {!captureOnly && liveClear ? (
          <>
            <div
              className={`pointer-events-none absolute inset-y-0 left-0 z-[5] w-[10%] ${
                mode === 'add' ? 'bg-gradient-to-r from-emerald-500/35 to-transparent' : ''
              }`}
            />
            <div
              className={`pointer-events-none absolute inset-y-0 right-0 z-[5] w-[14%] ${
                mode === 'remove'
                  ? 'bg-gradient-to-l from-rose-500/40 to-transparent'
                  : 'bg-gradient-to-l from-black/25 to-transparent'
              }`}
            />
          </>
        ) : null}

        {/* Tap zones (invisible) — cart modes only */}
        {!captureOnly && armed ? (
          <div className="absolute inset-0 z-10 flex">
            <button
              type="button"
              aria-label="Add"
              className="w-[62%] bg-transparent"
              onClick={() => setScanMode('add')}
            />
            <button
              type="button"
              aria-label="Remove"
              className="w-[38%] bg-transparent"
              onClick={() => setScanMode('remove')}
            />
          </div>
        ) : null}

        {/* Barcode reader frame + center line */}
        {liveClear ? (
          <div className="pointer-events-none absolute inset-x-[8%] top-1/2 z-20 h-[38%] -translate-y-1/2">
            <div
              className={`relative h-full rounded-xl border-[2.5px] ${
                mode === 'remove' ? 'border-rose-300' : 'border-emerald-300'
              }`}
            >
              <div
                className={`absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 ${
                  mode === 'remove' ? 'bg-rose-200/90' : 'bg-emerald-200/90'
                }`}
              />
              <span
                className={`absolute left-0 top-0 h-4 w-4 border-l-[3px] border-t-[3px] ${
                  mode === 'remove' ? 'border-rose-200' : 'border-emerald-200'
                }`}
              />
              <span
                className={`absolute right-0 top-0 h-4 w-4 border-r-[3px] border-t-[3px] ${
                  mode === 'remove' ? 'border-rose-200' : 'border-emerald-200'
                }`}
              />
              <span
                className={`absolute bottom-0 left-0 h-4 w-4 border-b-[3px] border-l-[3px] ${
                  mode === 'remove' ? 'border-rose-200' : 'border-emerald-200'
                }`}
              />
              <span
                className={`absolute bottom-0 right-0 h-4 w-4 border-b-[3px] border-r-[3px] ${
                  mode === 'remove' ? 'border-rose-200' : 'border-emerald-200'
                }`}
              />
            </div>
          </div>
        ) : null}

        {liveClear ? (
          <p className="pointer-events-none absolute inset-x-0 top-3 z-20 text-center text-[11px] font-semibold text-white drop-shadow">
            {mode === 'remove'
              ? 'Remove mode · aim barcode in the frame'
              : 'Point barcode at the green line'}
          </p>
        ) : null}

        <div className="pointer-events-none absolute right-3 top-3 z-20">
          <span
            className={`block h-2.5 w-2.5 rounded-full ${
              status === 'live' && videoReady
                ? 'animate-pulse bg-emerald-400'
                : status === 'starting' || (armed && !videoReady)
                  ? 'bg-amber-400'
                  : 'bg-slate-500'
            }`}
          />
        </div>

        {showBanner ? (
          <div
            className={`pointer-events-none absolute inset-x-3 bottom-3 z-20 rounded-xl px-3 py-2 text-center text-sm font-bold text-white shadow-lg ${
              hitFlash
                ? lastIntent === 'remove'
                  ? 'bg-rose-500'
                  : 'bg-emerald-500'
                : 'bg-black/75'
            }`}
          >
            {hitFlash && lastHit
              ? captureOnly
                ? lastHit
                : lastIntent === 'remove'
                  ? `− ${lastHit}`
                  : `+ ${lastHit}`
              : statusMessage}
          </div>
        ) : null}
      </div>

      {displayError ? (
        <div className="shrink-0 rounded-xl border border-danger/20 bg-danger/10 px-3 py-3 text-sm text-danger">
          <p>{displayError}</p>
          <Button
            type="button"
            className="mt-3 rounded-xl"
            onClick={() => void armCamera()}
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      ) : null}

      {cartHint ? (
        <p className="shrink-0 text-center text-xs font-semibold tabular-nums text-ink-soft">
          {cartHint}
        </p>
      ) : null}

      {showDone ? (
        <Button
          type="button"
          className="min-h-12 w-full shrink-0 rounded-2xl bg-brand text-base font-bold hover:bg-brand-deep"
          onClick={onClose}
        >
          <Check className="h-5 w-5" />
          Done
        </Button>
      ) : null}
    </div>
  )
}
