import { useEffect, useRef, useState, type RefObject } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import {
  BarcodeFormat,
  DecodeHintType,
  type Result,
} from '@zxing/library'

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: {
      formats?: string[]
    }) => BarcodeDetectorLike
  }
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

/** Same-code cooldown — different codes emit immediately. */
export const SCAN_COOLDOWN_MS = 180

type Options = {
  enabled?: boolean
  sessionKey?: number
  cooldownMs?: number
  preferUserCamera?: boolean
  onCode: (code: string) => void
}

function isMobileUa() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

function cameraErrorMessage(err: unknown): string {
  const insecure =
    typeof window !== 'undefined' && !window.isSecureContext
  if (insecure) {
    return 'Live camera needs HTTPS. See PHONE-SETUP.md — open a secure shop link, allow camera, retry.'
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

function zxingHints() {
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
  hints.set(DecodeHintType.TRY_HARDER, false)
  return hints
}

/** Preferred constraints first — never grab a weak default camera before the good ones. */
function buildConstraintAttempts(
  preferUserCamera?: boolean,
): MediaStreamConstraints[] {
  const preferUser = preferUserCamera ?? !isMobileUa()
  const facing = preferUser ? 'user' : 'environment'
  const baseVideo = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 60 },
  } as const

  const attempts: MediaStreamConstraints[] = [
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
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
    },
    {
      audio: false,
      video: { facingMode: { ideal: facing } },
    },
  ]

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

async function openCameraStream(
  preferUserCamera?: boolean,
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera API missing — use Chrome or Edge')
  }

  let lastError: unknown
  for (const constraints of buildConstraintAttempts(preferUserCamera)) {
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

async function attachStream(
  video: HTMLVideoElement,
  stream: MediaStream,
): Promise<void> {
  video.setAttribute('playsinline', 'true')
  video.setAttribute('webkit-playsinline', 'true')
  video.muted = true
  video.playsInline = true
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

type RoiMode = 'strip' | 'full'

/** Draw center barcode strip (or full frame) into a reused canvas. */
function paintRoi(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  mode: RoiMode,
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
    // Matches on-screen teal guide — horizontal strip mid-frame
    sw = vw * 0.82
    sh = vh * 0.3
    sx = (vw - sw) / 2
    sy = (vh - sh) / 2
  }

  // Keep ROI modest — big frames make the first detects sluggish on phones
  const maxW = mode === 'full' ? 800 : 640
  const dw = Math.min(maxW, Math.round(sw))
  const dh = Math.max(48, Math.round((sh / sw) * dw))
  if (canvas.width !== dw) canvas.width = dw
  if (canvas.height !== dh) canvas.height = dh
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'low'
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, dw, dh)
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
    onCode,
  }: Options,
) {
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode
  const lastCodeRef = useRef('')
  const lastAtRef = useRef(0)
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
    const roiCanvas = document.createElement('canvas')
    const roiCtx = roiCanvas.getContext('2d', {
      willReadFrequently: true,
      alpha: false,
    })

    function emit(raw: string) {
      const code = raw.trim()
      if (!code || cancelled) return
      const now = Date.now()
      // Same code: cooldown. New code: emit immediately.
      if (code === lastCodeRef.current && now - lastAtRef.current < cooldownMs) {
        return
      }
      lastCodeRef.current = code
      lastAtRef.current = now
      lastHitAt = now
      onCodeRef.current(code)
    }

    function scheduleNext(video: HTMLVideoElement, tick: () => void) {
      if (cancelled) return
      const vfc = (
        video as HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: () => void) => number
        }
      ).requestVideoFrameCallback
      if (typeof vfc === 'function') {
        raf = vfc.call(video, () => {
          tick()
        })
      } else {
        timer = window.setTimeout(tick, 16)
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

      setEngine('Fast · ROI')
      setStatus('starting')

      // Warm detector before “live” — cold first call can take >1s
      try {
        paintRoi(video, roiCanvas, roiCtx, 'strip')
        await detector.detect(roiCanvas)
      } catch {
        // empty/miss is fine — we only need the model loaded
      }
      if (cancelled) return false
      setStatus('live')

      // Rare ZXing assist only after ~1.2s with no hit (never on every frame)
      const softReader = new BrowserMultiFormatReader(zxingHints())
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
            const quiet = quietMs > 700
            // Center strip most frames; full frame every 8th while searching
            const mode: RoiMode =
              quiet && frameN % 8 === 0 ? 'full' : 'strip'
            if (!paintRoi(video, roiCanvas, roiCtx, mode)) return

            const codes = await detector.detect(roiCanvas)
            if (codes[0]?.rawValue) {
              emit(codes[0].rawValue)
            } else if (
              quietMs > 1200 &&
              !softBusy &&
              frameN % 12 === 0
            ) {
              softBusy = true
              try {
                const url = roiCanvas.toDataURL('image/jpeg', 0.65)
                const result = await softReader.decodeFromImageUrl(url)
                const text = result?.getText()?.trim()
                if (text) emit(text)
              } catch {
                // no code
              } finally {
                softBusy = false
              }
            }
          } catch {
            // keep looping
          } finally {
            detecting = false
            setTicks((n) => (n + 1) % 10000)
            scheduleNext(video, tick)
          }
        })()
      }

      tick()
      return true
    }

    /** Safari / older Chrome — ROI canvas loop beats full-frame decodeFromStream. */
    async function startZxingRoiLoop(video: HTMLVideoElement) {
      if (!roiCtx) {
        // Last resort: library stream decode
        zxingReader = new BrowserMultiFormatReader(zxingHints(), {
          delayBetweenScanAttempts: 25,
          delayBetweenScanSuccess: cooldownMs,
        })
        if (!stream) return
        controls = await zxingReader.decodeFromStream(
          stream,
          video,
          (result: Result | undefined) => {
            if (cancelled) return
            setStatus('live')
            setTicks((n) => (n + 1) % 10000)
            if (result) emit(result.getText())
          },
        )
        setEngine('Scanner')
        setStatus('live')
        return
      }

      zxingReader = new BrowserMultiFormatReader(zxingHints())
      setEngine('Scanner · ROI')
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
          const quiet = Date.now() - lastHitAt > 800
          const mode: RoiMode = quiet && frameN % 7 === 0 ? 'full' : 'strip'
          if (paintRoi(video, roiCanvas, roiCtx, mode)) {
            try {
              const result = zxingReader!.decodeFromCanvas(roiCanvas)
              const text = result?.getText()?.trim()
              if (text) emit(text)
            } catch {
              // NotFoundException every miss — expected
            }
          }
        } finally {
          detecting = false
          setTicks((n) => (n + 1) % 10000)
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

        stream = await openCameraStream(preferUserCamera)
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
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
      stream?.getTracks().forEach((t) => t.stop())
      const media = videoRef.current?.srcObject
      if (media instanceof MediaStream) {
        media.getTracks().forEach((t) => t.stop())
      }
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }, [cooldownMs, enabled, preferUserCamera, sessionKey, videoRef])

  return { status, engine, error, ticks }
}
