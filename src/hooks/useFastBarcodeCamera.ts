import { useEffect, useRef, useState, type RefObject } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import {
  BarcodeFormat,
  DecodeHintType,
  type Result,
} from '@zxing/library'

type DetectedBarcode = {
  rawValue: string
  boundingBox?: { x: number; y: number; width: number; height: number }
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<DetectedBarcode[]>
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: {
      formats?: string[]
    }) => BarcodeDetectorLike
  }
}

/** add = barcode in left/center · remove = barcode aimed to the right */
export type ScanIntent = 'add' | 'remove'

export type ScanHit = {
  code: string
  intent: ScanIntent
}

/** Retail 1D + QR — keep list tight for native speed. */
const NATIVE_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'codabar',
  'qr_code',
]

/**
 * Hard floor between identical emits (same code+intent).
 * Re-scans are gated by barcode movement / leaving the frame — not a long timer.
 */
export const SCAN_COOLDOWN_MS = 160

type Options = {
  enabled?: boolean
  sessionKey?: number
  /** Tiny floor between identical emits */
  cooldownMs?: number
  preferUserCamera?: boolean
  /**
   * Stream opened during a user tap (required on iOS Safari).
   * When set, getUserMedia is skipped.
   */
  mediaStream?: MediaStream | null
  /**
   * Same code+intent only fires again after the barcode leaves the frame
   * (stops accidental 10× adds while holding still).
   */
  requireLeaveFrame?: boolean
  /** Preferred — includes add/remove from barcode position */
  onHit?: (hit: ScanHit) => void
  /** @deprecated use onHit — always treated as add */
  onCode?: (code: string) => void
}

type TrackedBox = { cx: number; cy: number; area: number }

type DetectBox = { x: number; y: number; width: number; height: number }

/** Right ~38% of the scan strip = remove zone (matches on-screen pink). */
function intentFromBox(
  box: DetectBox | undefined,
  canvasW: number,
): ScanIntent {
  if (!box || canvasW < 8) return 'add'
  const cx = box.x + box.width / 2
  // Slightly under 0.62 so aiming into the pink zone registers remove
  return cx / canvasW >= 0.58 ? 'remove' : 'add'
}

function summarizeBox(box: DetectBox | undefined): TrackedBox | null {
  if (!box || box.width < 2 || box.height < 1) return null
  return {
    cx: box.x + box.width / 2,
    cy: box.y + box.height / 2,
    area: Math.max(1, box.width * box.height),
  }
}

function isMobileUa() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

function isDesktopUa() {
  return !isMobileUa()
}

function cameraErrorMessage(err: unknown): string {
  const insecure =
    typeof window !== 'undefined' && !window.isSecureContext
  if (insecure) {
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
    return 'No camera found on this device.'
  }
  if (name === 'NotReadableError' || /track|in use|busy/i.test(message)) {
    return 'Camera is busy in another app — close it, then Retry.'
  }
  return message || 'Could not open camera.'
}

function zxingHints(tryHarder = false) {
  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODABAR,
    BarcodeFormat.ITF,
    BarcodeFormat.QR_CODE,
  ])
  hints.set(DecodeHintType.TRY_HARDER, tryHarder)
  return hints
}

/**
 * Preferred constraints first — never grab a weak default camera before the good ones.
 * Desktop: favor snappy 720p (1080p slows decode on laptop webcams).
 * Mobile: keep rear-camera + 720p bias for phone scanners.
 */
function buildConstraintAttempts(
  preferUserCamera?: boolean,
  deviceId?: string,
): MediaStreamConstraints[] {
  const desktop = isDesktopUa()
  const preferUser = preferUserCamera ?? desktop
  const facing = preferUser ? 'user' : 'environment'
  // Laptop cams: open at 480p first (faster cold start), then nudge to 720p
  const desktopFast = {
    width: { ideal: 640, max: 960 },
    height: { ideal: 480, max: 720 },
    frameRate: { ideal: 30, max: 30 },
  }
  const baseVideo = desktop
    ? {
        width: { ideal: 960, max: 1280 },
        height: { ideal: 540, max: 720 },
        frameRate: { ideal: 30, max: 30 },
      }
    : {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 60 },
      }

  const attempts: MediaStreamConstraints[] = []

  if (deviceId) {
    // Laptop: exact deviceId first — skips failed facingMode probes (~100–400ms each)
    if (desktop) {
      attempts.push({
        audio: false,
        video: { deviceId: { exact: deviceId }, ...desktopFast },
      })
      attempts.push({
        audio: false,
        video: { deviceId: { exact: deviceId }, ...baseVideo },
      })
    }
    // Fast path — ideal deviceId (phones + desktop fallback)
    attempts.push({
      audio: false,
      video: { deviceId: { ideal: deviceId }, ...desktopFast },
    })
    attempts.push({
      audio: false,
      video: { deviceId: { ideal: deviceId }, ...baseVideo },
    })
  }

  // Phones: rear camera first with modest 720p — 1080p often washes out / lags
  if (!preferUser && !desktop) {
    attempts.push({
      audio: false,
      video: {
        facingMode: { exact: 'environment' },
        width: { ideal: 1280, max: 1280 },
        height: { ideal: 720, max: 720 },
        frameRate: { ideal: 30, max: 30 },
      },
    })
    attempts.push({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280, max: 1280 },
        height: { ideal: 720, max: 720 },
      },
    })
    // Minimal — some Androids reject size constraints
    attempts.push({
      audio: false,
      video: { facingMode: { exact: 'environment' } },
    })
    attempts.push({
      audio: false,
      video: { facingMode: 'environment' },
    })
  }

  if (desktop) {
    // Keep laptop attempts short — each failed getUserMedia costs ~100–400ms
    // Prefer exact deviceId already pushed above; facingMode is fallback only.
    if (!deviceId) {
      attempts.push({
        audio: false,
        video: { ...desktopFast },
      })
      attempts.push({
        audio: false,
        video: { facingMode: { ideal: facing }, ...desktopFast },
      })
    }
    attempts.push(
      {
        audio: false,
        video: { facingMode: { ideal: facing }, ...baseVideo },
      },
      { audio: false, video: true },
    )
    return attempts
  }

  attempts.push(
    {
      audio: false,
      video: {
        facingMode: { ideal: facing },
        ...baseVideo,
      },
    },
    {
      audio: false,
      video: {
        facingMode: facing,
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
    },
    {
      audio: false,
      video: { facingMode: { ideal: facing } },
    },
  )

  if (!preferUser) {
    attempts.push({
      audio: false,
      video: { facingMode: { ideal: 'user' }, ...baseVideo },
    })
  }

  // Absolute last resort
  attempts.push({ audio: false, video: true })
  return attempts
}

/** Prefer a real built-in / USB webcam on laptops (skip virtual/IR when possible). */
async function pickDesktopDeviceId(): Promise<string | undefined> {
  if (!isDesktopUa() || !navigator.mediaDevices?.enumerateDevices) {
    return undefined
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    const videos = devices.filter((d) => d.kind === 'videoinput' && d.deviceId)
    if (!videos.length) return undefined
    const score = (label: string) => {
      const l = label.toLowerCase()
      if (/virtual|obs|iriun|continuity|phone link|camo/i.test(l)) return -20
      if (/infrared|\bir\b|meta|tof/i.test(l)) return -10
      if (/logitech|webcam|usb camera/i.test(l)) return 14
      if (/facetime|integrated|built-?in|hd webcam|usb/i.test(l)) return 10
      return 0
    }
    const ranked = [...videos].sort(
      (a, b) => score(b.label || '') - score(a.label || ''),
    )
    return ranked[0]?.deviceId
  } catch {
    return undefined
  }
}

/** Open a camera stream — call from a tap handler on iOS so the gesture sticks. */
export async function openCameraStream(
  preferUserCamera?: boolean,
): Promise<MediaStream> {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new Error(
      'Live camera needs a secure link (HTTPS). Open the shop HTTPS URL, allow camera, then Retry.',
    )
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera API missing — use Chrome or Edge')
  }

  const deviceId = await pickDesktopDeviceId()
  let lastError: unknown
  for (const constraints of buildConstraintAttempts(
    preferUserCamera,
    deviceId,
  )) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints)
    } catch (err) {
      lastError = err
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Could not open camera')
}

/** Continuous autofocus / exposure when the device supports it. */
async function tuneTrack(track: MediaStreamTrack) {
  try {
    const caps = track.getCapabilities?.() as
      | {
          focusMode?: string[]
          exposureMode?: string[]
          whiteBalanceMode?: string[]
          torch?: boolean
        }
      | undefined
    if (!caps) return
    const advanced: Record<string, string>[] = []
    if (caps.focusMode?.includes('continuous')) {
      advanced.push({ focusMode: 'continuous' })
    }
    if (caps.exposureMode?.includes('continuous')) {
      advanced.push({ exposureMode: 'continuous' })
    }
    if (caps.whiteBalanceMode?.includes('continuous')) {
      advanced.push({ whiteBalanceMode: 'continuous' })
    }
    if (advanced.length) {
      await track.applyConstraints({ advanced } as MediaTrackConstraints)
    }
  } catch {
    // optional
  }
}

async function ensureVideoPlaying(video: HTMLVideoElement): Promise<void> {
  try {
    await video.play()
  } catch {
    await new Promise<void>((resolve) => {
      const onReady = () => {
        video.removeEventListener('loadedmetadata', onReady)
        void video.play().finally(() => resolve())
      }
      video.addEventListener('loadedmetadata', onReady)
      if (video.readyState >= 1) onReady()
    })
  }
  for (let i = 0; i < 48; i += 1) {
    if (video.readyState >= 2 && video.videoWidth > 0) return
    await new Promise((r) => window.setTimeout(r, 20))
  }
}

async function attachStream(
  video: HTMLVideoElement,
  stream: MediaStream,
): Promise<void> {
  video.setAttribute('playsinline', 'true')
  video.setAttribute('webkit-playsinline', 'true')
  video.setAttribute('autoplay', '')
  video.muted = true
  video.defaultMuted = true
  video.playsInline = true
  // Same stream already attached (opened in a tap handler) — don't stop tracks
  if (video.srcObject === stream) {
    const track = stream.getVideoTracks()[0]
    if (track) void tuneTrack(track)
    await ensureVideoPlaying(video)
    return
  }
  if (video.srcObject) {
    try {
      const old = video.srcObject
      if (old instanceof MediaStream) {
        old.getTracks().forEach((t) => t.stop())
      }
    } catch {
      // ignore
    }
  }
  video.srcObject = stream
  const track = stream.getVideoTracks()[0]
  if (track) void tuneTrack(track)
  await ensureVideoPlaying(video)
}

type RoiMode = 'strip' | 'full'

/** Draw center barcode strip (or full frame) into a reused canvas. */
function paintRoi(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  mode: RoiMode,
  desktop: boolean,
) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (vw < 16 || vh < 16) return false

  let sx: number
  let sy: number
  let sw: number
  let sh: number
  if (mode === 'full') {
    sx = 0
    sy = 0
    sw = vw
    sh = vh
  } else {
    // Matches on-screen split guide — taller on phones so ZXing can lock 1D codes
    sw = vw * (desktop ? 0.96 : 0.94)
    sh = vh * (desktop ? 0.42 : 0.46)
    sx = (vw - sw) / 2
    sy = (vh - sh) / 2
  }

  // Keep ROI modest so detect stays under ~16ms on laptop CPUs.
  const maxW = desktop
    ? mode === 'full'
      ? 640
      : 560
    : mode === 'full'
      ? 640
      : 480
  const dw = Math.min(maxW, Math.round(sw))
  const dh = Math.max(48, Math.round((sh / sw) * dw))
  if (canvas.width !== dw) canvas.width = dw
  if (canvas.height !== dh) canvas.height = dh
  ctx.imageSmoothingEnabled = false
  // Contrast + grayscale lifts 1D edges (laptops + phones without BarcodeDetector)
  ctx.filter = desktop
    ? 'contrast(1.45) brightness(1.06) saturate(0)'
    : 'contrast(1.3) brightness(1.05) saturate(0)'
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh)
  ctx.filter = 'none'
  return true
}

/**
 * Fast continuous barcode reader.
 * Native BarcodeDetector on a center ROI every frame; light ZXing assist.
 */
export function useFastBarcodeCamera(
  videoRef: RefObject<HTMLVideoElement | null>,
  {
    enabled = true,
    sessionKey = 0,
    cooldownMs = SCAN_COOLDOWN_MS,
    preferUserCamera,
    mediaStream = null,
    requireLeaveFrame = true,
    onHit,
    onCode,
  }: Options,
) {
  const onHitRef = useRef(onHit)
  onHitRef.current = onHit
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode
  const lastCodeRef = useRef('')
  const lastIntentRef = useRef<ScanIntent>('add')
  const lastAtRef = useRef(0)
  const lastBoxRef = useRef<TrackedBox | null>(null)
  const leftViewRef = useRef(true)
  const [status, setStatus] = useState<'idle' | 'starting' | 'live' | 'error'>(
    'idle',
  )
  const [engine, setEngine] = useState('')
  const [error, setError] = useState('')
  const [ticks, setTicks] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setStatus('idle')
      setError('')
      return
    }

    let cancelled = false
    let stream: MediaStream | null = null
    let timer = 0
    let raf = 0
    let controls: { stop: () => void } | null = null
    let zxingReader: BrowserMultiFormatReader | null = null
    let detecting = false
    let frameN = 0
    let lastHitAt = 0
    let missStreak = 0
    const desktop = isDesktopUa()
    lastCodeRef.current = ''
    lastIntentRef.current = 'add'
    lastAtRef.current = 0
    lastBoxRef.current = null
    leftViewRef.current = true
    // Desktop: snappier floor for laptop webcam; phones keep prior feel (untouched)
    const minGapMs = Math.max(
      desktop ? 70 : 120,
      Math.min(cooldownMs, desktop ? 140 : SCAN_COOLDOWN_MS),
    )
    const roiCanvas = document.createElement('canvas')
    const roiCtx = roiCanvas.getContext('2d', {
      willReadFrequently: true,
      alpha: false,
    })

    function bumpTicks() {
      // Avoid re-rendering React every frame (major laptop lag source)
      if (frameN % (desktop ? 8 : 6) !== 0) return
      setTicks((n) => (n + 1) % 10000)
    }

    function noteMiss() {
      missStreak += 1
      // ~4–6 missed frames ≈ barcode left — allow same code again
      if (missStreak >= 4) leftViewRef.current = true
    }

    function emit(
      raw: string,
      intent: ScanIntent = 'add',
      box?: DetectBox,
    ) {
      const code = raw.trim()
      if (!code || cancelled) return
      const now = Date.now()
      const nextBox = summarizeBox(box)
      const sameLock =
        code === lastCodeRef.current && intent === lastIntentRef.current

      // Tiny floor — stops the same frame bursting 2–3 times
      if (sameLock && now - lastAtRef.current < minGapMs) return

      // Must pull barcode out of view before the same code can fire again
      if (requireLeaveFrame && sameLock && !leftViewRef.current) return

      lastCodeRef.current = code
      lastIntentRef.current = intent
      lastAtRef.current = now
      lastBoxRef.current = nextBox
      leftViewRef.current = false
      missStreak = 0
      lastHitAt = now
      if (onHitRef.current) onHitRef.current({ code, intent })
      else onCodeRef.current?.(code)
    }

    function scheduleNext(video: HTMLVideoElement, tick: () => void) {
      if (cancelled) return
      const vfc = (
        video as HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: () => void) => number
        }
      ).requestVideoFrameCallback
      // Desktop: rVFC when available; else ~45fps timer (enough for webcam decode)
      if (typeof vfc === 'function') {
        raf = vfc.call(video, () => {
          tick()
        })
      } else {
        timer = window.setTimeout(tick, desktop ? 22 : 16)
      }
    }

    async function startNativeLoop(video: HTMLVideoElement): Promise<boolean> {
      if (!window.BarcodeDetector || !roiCtx) return false
      let detector: BarcodeDetectorLike
      try {
        detector = new window.BarcodeDetector({ formats: NATIVE_FORMATS })
      } catch {
        return false
      }

      setEngine(desktop ? 'Fast · Scan' : 'Fast · ROI')
      setStatus('starting')

      // Warm detector before “live” — cold first call can take >1s
      try {
        paintRoi(video, roiCanvas, roiCtx, 'strip', desktop)
        await detector.detect(roiCanvas)
      } catch {
        // empty/miss is fine — we only need the model loaded
      }
      if (cancelled) return false
      setStatus('live')

      // Soft ZXing assist — TRY_HARDER helps soft cams; never toDataURL
      const softReader = new BrowserMultiFormatReader(zxingHints(true))
      let softBusy = false

      const tick = () => {
        if (cancelled || !videoRef.current) return
        void (async () => {
          if (detecting || video.readyState < 2 || video.videoWidth < 16) {
            scheduleNext(video, tick)
            return
          }
          detecting = true
          frameN += 1
          try {
            const quietMs = Date.now() - lastHitAt
            const quiet = quietMs > (desktop ? 450 : 500)
            // Strip every frame; occasional full frame while searching
            const fullEvery = desktop ? 5 : 6
            const mode: RoiMode =
              quiet && frameN % fullEvery === 0 ? 'full' : 'strip'
            if (!paintRoi(video, roiCanvas, roiCtx, mode, desktop)) return

            const codes = await detector.detect(roiCanvas)
            if (codes[0]?.rawValue) {
              missStreak = 0
              const box = codes[0].boundingBox
              const intent = intentFromBox(box, roiCanvas.width)
              emit(codes[0].rawValue, intent, box)
            } else {
              noteMiss()
              // Android may have a weak BarcodeDetector — ZXing assist quickly.
              // Desktop: lean on native detector; ZXing assist is rarer (CPU).
              const softAfter = desktop ? 900 : 400
              const softEvery = desktop ? 10 : 4
              if (quietMs > softAfter && !softBusy && frameN % softEvery === 0) {
                softBusy = true
                try {
                  const result = softReader.decodeFromCanvas(roiCanvas)
                  const text = result?.getText()?.trim()
                  if (text) emit(text)
                } catch {
                  // no code
                } finally {
                  softBusy = false
                }
              }
            }
          } catch {
            // keep looping
          } finally {
            detecting = false
            bumpTicks()
            scheduleNext(video, tick)
          }
        })()
      }

      tick()
      return true
    }

    /** Safari / older Chrome — ROI canvas loop beats full-frame decodeFromStream. */
    async function startZxingRoiLoop(video: HTMLVideoElement) {
      // iOS has no BarcodeDetector — TRY_HARDER is required for reliable 1D
      const hints = zxingHints(true)
      if (!roiCtx) {
        // Last resort: library stream decode
        zxingReader = new BrowserMultiFormatReader(hints, {
          delayBetweenScanAttempts: desktop ? 12 : 20,
          delayBetweenScanSuccess: cooldownMs,
        })
        if (!stream) return
        controls = await zxingReader.decodeFromStream(
          stream,
          video,
          (result: Result | undefined) => {
            if (cancelled) return
            setStatus('live')
            bumpTicks()
            if (result) emit(result.getText())
          },
        )
        setEngine('Scanner')
        setStatus('live')
        return
      }

      zxingReader = new BrowserMultiFormatReader(hints)
      setEngine(desktop ? 'Scanner · Scan' : 'Scanner · ROI')
      setStatus('live')

      const tick = () => {
        if (cancelled || !videoRef.current) return
        if (detecting || video.readyState < 2 || video.videoWidth < 16) {
          scheduleNext(video, tick)
          return
        }
        detecting = true
        frameN += 1
        try {
          // Phones need frequent full-frame retries — strip alone misses tall codes
          const quiet = Date.now() - lastHitAt > (desktop ? 450 : 400)
          const mode: RoiMode =
            quiet && frameN % (desktop ? 4 : 3) === 0 ? 'full' : 'strip'
          if (paintRoi(video, roiCanvas, roiCtx, mode, desktop)) {
            try {
              const result = zxingReader!.decodeFromCanvas(roiCanvas)
              const text = result?.getText()?.trim()
              if (text) {
                missStreak = 0
                emit(text)
              } else {
                noteMiss()
              }
            } catch {
              noteMiss()
              // NotFoundException every miss — expected
            }
          }
        } finally {
          detecting = false
          bumpTicks()
          scheduleNext(video, tick)
        }
      }

      tick()
    }

    async function waitForVideo(): Promise<HTMLVideoElement> {
      for (let i = 0; i < 60; i += 1) {
        const video = videoRef.current
        if (video) return video
        await new Promise((r) => window.setTimeout(r, 16))
      }
      throw new Error('Camera view not ready — close and open again')
    }

    async function start() {
      try {
        setStatus('starting')
        setError('')
        const video = await waitForVideo()
        if (cancelled) return

        if (mediaStream && mediaStream.active) {
          stream = mediaStream
        } else if (mediaStream && !mediaStream.active) {
          throw new Error('Camera stopped — tap Retry to open again.')
        } else {
          stream = await openCameraStream(preferUserCamera)
        }
        if (cancelled) {
          // Only stop tracks we just opened (no provided stream)
          if (!mediaStream) stream.getTracks().forEach((t) => t.stop())
          return
        }

        await attachStream(video, stream)
        if (cancelled) return

        const nativeOk = await startNativeLoop(video)
        if (cancelled) return
        if (!nativeOk) await startZxingRoiLoop(video)
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setError(cameraErrorMessage(err))
      }
    }

    void start()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (raf && videoRef.current) {
        const cancel = (
          videoRef.current as HTMLVideoElement & {
            cancelVideoFrameCallback?: (id: number) => void
          }
        ).cancelVideoFrameCallback
        try {
          cancel?.call(videoRef.current, raf)
        } catch {
          // ignore
        }
      }
      try {
        controls?.stop()
      } catch {
        // ignore
      }
      zxingReader = null
      // Always stop tracks we opened or were handed — parent replaces on Retry
      stream?.getTracks().forEach((t) => t.stop())
      const media = videoRef.current?.srcObject
      if (media instanceof MediaStream) {
        media.getTracks().forEach((t) => t.stop())
      }
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [
    cooldownMs,
    enabled,
    mediaStream,
    preferUserCamera,
    requireLeaveFrame,
    sessionKey,
    videoRef,
  ])

  return { status, engine, error, ticks }
}
