import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Peer, { type DataConnection } from 'peerjs'
import { Flashlight, Keyboard, RefreshCw, Smartphone } from 'lucide-react'
import {
  SCAN_COOLDOWN_MS,
  useFastBarcodeCamera,
} from '@/hooks/useFastBarcodeCamera'
import { hostPeerId, type ScanPacket } from '@/lib/peerRoom'
import {
  playErrorBuzz,
  playLinkBeep,
  playScanBeep,
  unlockAudio,
} from '@/lib/sounds'

/**
 * Full-screen live barcode gun for the phone — no photo step.
 * Needs HTTPS so the browser allows a continuous camera stream.
 */
export function PhoneScannerPage() {
  const { roomId = '' } = useParams()
  const room = roomId.toUpperCase()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const connRef = useRef<DataConnection | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pendingRef = useRef<string[]>([])
  const secure = typeof window !== 'undefined' && window.isSecureContext

  const [link, setLink] = useState<'connecting' | 'ready' | 'error'>('connecting')
  const [linkDetail, setLinkDetail] = useState('Linking…')
  const [flash, setFlash] = useState(
    secure ? 'Open camera…' : 'Open the HTTPS shop link for live scan',
  )
  const [flashTone, setFlashTone] = useState<'ok' | 'idle' | 'error'>('idle')
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [reconnectKey, setReconnectKey] = useState(0)
  const [cameraKey, setCameraKey] = useState(0)
  const [scanCount, setScanCount] = useState(0)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [liveOn, setLiveOn] = useState(secure)

  useEffect(() => {
    unlockAudio()
  }, [])

  const flushPending = useCallback(() => {
    const conn = connRef.current
    if (!conn?.open || !pendingRef.current.length) return
    const queued = [...pendingRef.current]
    pendingRef.current = []
    for (const code of queued) {
      conn.send({
        type: 'barcode',
        code,
        at: Date.now(),
      } satisfies ScanPacket)
    }
  }, [])

  useEffect(() => {
    if (!room) {
      setLink('error')
      setLinkDetail('Missing room')
      return
    }

    let cancelled = false
    const peer = new Peer({ debug: 0 })
    let conn: DataConnection | null = null

    peer.on('open', () => {
      if (cancelled) return
      setLink('connecting')
      setLinkDetail('Linking…')
      conn = peer.connect(hostPeerId(room), { reliable: true })
      connRef.current = conn

      conn.on('open', () => {
        if (cancelled) return
        setLink('ready')
        setLinkDetail('Linked')
        setFlash('Point at barcode')
        playLinkBeep()
        try {
          navigator.vibrate?.(40)
        } catch {
          // ignore
        }
        conn?.send({
          type: 'hello',
          device: /iPhone|iPad/i.test(navigator.userAgent) ? 'iPhone' : 'Phone',
        } satisfies ScanPacket)
        flushPending()
      })

      conn.on('data', (raw) => {
        const data = raw as ScanPacket
        if (data?.type === 'ack') {
          setFlash(data.message || (data.ok ? data.label || 'Added' : 'Not found'))
          setFlashTone(data.ok ? 'ok' : 'error')
          if (!data.ok) playErrorBuzz()
          try {
            navigator.vibrate?.(data.ok ? [25, 30, 25] : [80, 40, 80])
          } catch {
            // ignore
          }
          window.setTimeout(() => {
            setFlash('Point at barcode')
            setFlashTone('idle')
          }, 700)
        }
      })

      conn.on('close', () => {
        if (cancelled) return
        setLink('error')
        setLinkDetail('Disconnected')
      })

      conn.on('error', () => {
        if (cancelled) return
        setLink('error')
        setLinkDetail('Link failed')
      })
    })

    peer.on('error', (err) => {
      if (cancelled) return
      setLink('error')
      setLinkDetail(err.message || 'Failed')
      playErrorBuzz()
    })

    return () => {
      cancelled = true
      try {
        conn?.close()
      } catch {
        // ignore
      }
      try {
        peer.destroy()
      } catch {
        // ignore
      }
    }
  }, [room, reconnectKey, flushPending])

  const onCode = useCallback((code: string) => {
    unlockAudio()
    playScanBeep()
    try {
      navigator.vibrate?.(40)
    } catch {
      // ignore
    }
    setScanCount((n) => n + 1)
    setFlash(code)
    setFlashTone('ok')

    const packet: ScanPacket = {
      type: 'barcode',
      code,
      at: Date.now(),
    }
    if (connRef.current?.open) {
      connRef.current.send(packet)
    } else {
      pendingRef.current.push(code)
      setFlash(`Queued ${code}`)
    }
  }, [])

  const { status, error } = useFastBarcodeCamera(videoRef, {
    enabled: liveOn && link !== 'error',
    sessionKey: cameraKey,
    preferUserCamera: false,
    cooldownMs: SCAN_COOLDOWN_MS,
    onCode,
  })

  useEffect(() => {
    const video = videoRef.current
    if (!video || !liveOn) return
    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')
    video.muted = true
  }, [liveOn, cameraKey])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !liveOn) return
    const onMeta = () => {
      const media = video.srcObject
      if (!(media instanceof MediaStream)) return
      streamRef.current = media
      const track = media.getVideoTracks()[0]
      const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined
      setTorchSupported(Boolean(caps?.torch))
    }
    video.addEventListener('loadedmetadata', onMeta)
    if (video.srcObject) onMeta()
    return () => video.removeEventListener('loadedmetadata', onMeta)
  }, [liveOn, cameraKey, status])

  async function toggleTorch() {
    const track =
      streamRef.current?.getVideoTracks()[0] ||
      (videoRef.current?.srcObject instanceof MediaStream
        ? videoRef.current.srcObject.getVideoTracks()[0]
        : undefined)
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({
        // @ts-expect-error torch is supported on many Android devices
        advanced: [{ torch: next }],
      })
      setTorchOn(next)
    } catch {
      setTorchSupported(false)
    }
  }

  function startLive() {
    unlockAudio()
    setLiveOn(true)
    setCameraKey((n) => n + 1)
    setFlash('Point at barcode')
    setFlashTone('idle')
  }

  function submitManual() {
    const code = manualCode.trim()
    if (!code) return
    onCode(code)
    setManualCode('')
    setManualOpen(false)
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white">
      <header className="relative z-20 flex items-center justify-between gap-3 bg-black/50 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-300">
            <Smartphone className="h-3 w-3" />
            Live scan
          </p>
          <p className="truncate text-sm font-semibold">
            {scanCount} scanned · {room}
          </p>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            link === 'ready'
              ? 'bg-emerald-500/20 text-emerald-300'
              : link === 'error'
                ? 'bg-red-500/20 text-red-300'
                : 'bg-white/10 text-slate-300'
          }`}
        >
          {linkDetail}
        </div>
      </header>

      <div className="relative min-h-0 flex-1 bg-black">
        {liveOn ? (
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full bg-black object-cover"
            muted
            playsInline
            autoPlay
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0b1224] px-6 text-center">
            <p className="text-lg font-semibold">Live barcode camera</p>
            <p className="text-sm text-slate-300">
              {secure
                ? 'Tap to open the camera — scans beep instantly.'
                : 'This page needs HTTPS for live scan. Open the https:// shop link, then tap below.'}
            </p>
            <button
              type="button"
              onClick={startLive}
              className="inline-flex min-h-14 w-full max-w-sm items-center justify-center rounded-2xl bg-[#3563E9] px-6 text-base font-semibold"
            >
              Start live scan
            </button>
          </div>
        )}

        {liveOn && status === 'live' ? (
          <div className="pointer-events-none absolute inset-x-[9%] top-1/2 z-10 h-[30%] -translate-y-1/2">
            <div className="h-full rounded-3xl border-[3px] border-teal-300 shadow-[0_0_0_999px_rgba(0,0,0,0.38)]" />
            <div className="absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-teal-300/85" />
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/70 to-transparent px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16">
          <p
            className={`rounded-2xl px-4 py-3.5 text-center text-base font-semibold ${
              flashTone === 'ok'
                ? 'bg-emerald-500 text-white'
                : flashTone === 'error'
                  ? 'bg-red-500 text-white'
                  : 'bg-white/15 text-white'
            }`}
          >
            {liveOn && status === 'starting'
              ? 'Opening camera…'
              : liveOn && error
                ? error
                : liveOn && status === 'live' && flashTone === 'idle'
                  ? 'Hold barcode in the box'
                  : flash}
          </p>

          {manualOpen ? (
            <div className="mt-3 flex gap-2">
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitManual()
                  }
                }}
                placeholder="Type code"
                inputMode="numeric"
                className="min-w-0 flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={submitManual}
                className="rounded-2xl bg-[#3563E9] px-4 py-3 text-sm font-semibold"
              >
                Add
              </button>
            </div>
          ) : null}

          <div className="mt-3 flex gap-2">
            {liveOn && torchSupported ? (
              <button
                type="button"
                onClick={() => void toggleTorch()}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${
                  torchOn ? 'bg-amber-400 text-slate-900' : 'bg-white/15'
                }`}
              >
                <Flashlight className="h-4 w-4" />
                Torch
              </button>
            ) : null}
            {link === 'error' ? (
              <button
                type="button"
                onClick={() => {
                  setLink('connecting')
                  setLinkDetail('Reconnecting…')
                  setReconnectKey((n) => n + 1)
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#3563E9] px-4 py-3 text-sm font-semibold"
              >
                <RefreshCw className="h-4 w-4" />
                Reconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setManualOpen((v) => !v)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 py-3 text-sm font-semibold"
              >
                <Keyboard className="h-4 w-4" />
                Type
              </button>
            )}
            {liveOn && (status === 'error' || error) ? (
              <button
                type="button"
                onClick={startLive}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#3563E9] px-4 py-3 text-sm font-semibold"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
