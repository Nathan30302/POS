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

type Options = {
  enabled?: boolean
  /** Ignore same code for this many ms (default 650). */
  cooldownMs?: number
  onCode: (code: string) => void
}

/**
 * Fast continuous barcode reader.
 * Prefers native BarcodeDetector (phones/Chrome) — often <1s.
 * Falls back to ZXing with aggressive timing.
 */
export function useFastBarcodeCamera(
  videoRef: RefObject<HTMLVideoElement | null>,
  { enabled = true, cooldownMs = 650, onCode }: Options,
) {
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode
  const lastCodeRef = useRef('')
  const lastAtRef = useRef(0)
  const [status, setStatus] = useState<'starting' | 'live' | 'error'>('starting')
  const [engine, setEngine] = useState('')
  const [error, setError] = useState('')
  const [ticks, setTicks] = useState(0)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let stream: MediaStream | null = null
    let timer = 0
    let controls: { stop: () => void } | null = null

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

    async function startNative(): Promise<boolean> {
      if (!window.BarcodeDetector || !videoRef.current) return false
      let detector: BarcodeDetectorLike
      try {
        detector = new window.BarcodeDetector({ formats: NATIVE_FORMATS })
      } catch {
        return false
      }

      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop())
        return false
      }

      const video = videoRef.current
      video.srcObject = stream
      video.setAttribute('playsinline', 'true')
      await video.play()

      setEngine('Native fast scanner')
      setStatus('live')

      const tick = async () => {
        if (cancelled || !videoRef.current) return
        try {
          if (videoRef.current.readyState >= 2) {
            const codes = await detector.detect(videoRef.current)
            if (codes[0]?.rawValue) emit(codes[0].rawValue)
          }
        } catch {
          // keep looping
        }
        setTicks((n) => (n + 1) % 10000)
        // ~25–30 checks/sec on phones — feels instant
        timer = window.setTimeout(() => {
          void tick()
        }, 35)
      }
      void tick()
      return true
    }

    async function startZxing() {
      if (!videoRef.current) throw new Error('Video element missing')

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
      hints.set(DecodeHintType.TRY_HARDER, true)

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 20,
        delayBetweenScanSuccess: 500,
      })

      controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result: Result | undefined) => {
          if (cancelled) return
          setStatus('live')
          setTicks((n) => (n + 1) % 10000)
          if (result) emit(result.getText())
        },
      )
      setEngine('ZXing scanner')
    }

    async function start() {
      try {
        setStatus('starting')
        setError('')
        const ok = await startNative()
        if (cancelled) return
        if (!ok) await startZxing()
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setError(
          err instanceof Error
            ? err.message
            : 'Camera blocked. Allow camera access and try again.',
        )
      }
    }

    void start()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      try {
        controls?.stop()
      } catch {
        // ignore
      }
      stream?.getTracks().forEach((t) => t.stop())
      const media = videoRef.current?.srcObject
      if (media instanceof MediaStream) {
        media.getTracks().forEach((t) => t.stop())
      }
    }
  }, [cooldownMs, enabled, videoRef])

  return { status, engine, error, ticks }
}
