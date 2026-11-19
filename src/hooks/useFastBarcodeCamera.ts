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

/** Single emit cooldown for “ping-ping” scanning (~200ms). */
export const SCAN_COOLDOWN_MS = 200

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

async function openCameraStream(
  preferUserCamera?: boolean,
): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera API missing — use Chrome or Edge')
  }

  const preferUser = preferUserCamera ?? !isMobileUa()
  const attempts: MediaStreamConstraints[] = [{ audio: false, video: true }]

  if (preferUser) {
    attempts.push(
      {
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      { audio: false, video: { facingMode: { ideal: 'user' } } },
    )
  } else {
    attempts.push(
      {
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      { audio: false, video: { facingMode: { ideal: 'environment' } } },
      { audio: false, video: { facingMode: { ideal: 'user' } } },
    )
  }

  let lastError: unknown
  for (const constraints of attempts) {
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
  for (let i = 0; i < 40; i += 1) {
    if (video.readyState >= 2 && video.videoWidth > 0) return
    await new Promise((r) => window.setTimeout(r, 25))
  }
}

/**
 * Fast continuous barcode reader — native detector first, light ZXing fallback.
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

    function emit(raw: string) {
      const code = raw.trim()
      if (!code || cancelled) return
      const now = Date.now()
      if (code === lastCodeRef.current && now - lastAtRef.current < cooldownMs) {
        return
      }
      lastCodeRef.current = code
      lastAtRef.current = now
      onCodeRef.current(code)
    }

    async function startNativeDetect(video: HTMLVideoElement): Promise<boolean> {
      if (!window.BarcodeDetector) return false
      let detector: BarcodeDetectorLike
      try {
        detector = new window.BarcodeDetector({ formats: NATIVE_FORMATS })
      } catch {
        return false
      }

      setEngine('Fast scanner')
      setStatus('live')

      const scheduleNext = () => {
        if (cancelled) return
        const vfc = (
          video as HTMLVideoElement & {
            requestVideoFrameCallback?: (cb: () => void) => number
          }
        ).requestVideoFrameCallback
        if (typeof vfc === 'function') {
          raf = vfc.call(video, () => {
            void tick()
          })
        } else {
          timer = window.setTimeout(() => {
            void tick()
          }, 33)
        }
      }

      const tick = async () => {
        if (cancelled || !videoRef.current) return
        if (!detecting && video.readyState >= 2 && video.videoWidth > 0) {
          detecting = true
          try {
            const codes = await detector.detect(video)
            if (codes[0]?.rawValue) emit(codes[0].rawValue)
          } catch {
            // keep looping
          } finally {
            detecting = false
          }
        }
        setTicks((n) => (n + 1) % 10000)
        scheduleNext()
      }

      void tick()
      return true
    }

    async function startZxingDetect(
      video: HTMLVideoElement,
      media: MediaStream,
    ) {
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
      // Soft decode — TRY_HARDER makes phones feel laggy
      hints.set(DecodeHintType.TRY_HARDER, false)

      zxingReader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 30,
        delayBetweenScanSuccess: cooldownMs,
      })

      controls = await zxingReader.decodeFromStream(
        media,
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

        const nativeOk = await startNativeDetect(video)
        if (cancelled) return
        if (!nativeOk) await startZxingDetect(video, stream)
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
      try {
        zxingReader?.reset()
      } catch {
        // ignore
      }
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
