import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Peer, { type DataConnection } from 'peerjs'
import { Flashlight, Keyboard, Minus, Plus, RefreshCw, Smartphone } from 'lucide-react'
import {
  SCAN_COOLDOWN_MS,
  openCameraStream,
  useFastBarcodeCamera,
  type ScanHit,
  type ScanIntent,
} from '@/hooks/useFastBarcodeCamera'
import { hostPeerId, type ScanPacket } from '@/lib/peerRoom'
import {
  playErrorBuzz,
  playLinkBeep,
  playAddBeep,
  playRemoveBeep,
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
  const pendingRef = useRef<Array<{ code: string; intent: ScanIntent }>>([])
  const secure = typeof window !== 'undefined' && window.isSecureContext

  const [link, setLink] = useState<'connecting' | 'ready' | 'error'>('connecting')
  const [linkDetail, setLinkDetail] = useState('Linking…')
  const [flash, setFlash] = useState(
    secure
      ? 'Tap Start live scan'
      : 'Open the HTTPS shop link for live scan',
  )
  const [flashTone, setFlashTone] = useState<'ok' | 'idle' | 'error'>('idle')
  const [mode, setMode] = useState<ScanIntent>('add')
  const modeRef = useRef<ScanIntent>('add')
  modeRef.current = mode
  const [lastIntent, setLastIntent] = useState<ScanIntent>('add')
  const pausedRef = useRef(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [reconnectKey, setReconnectKey] = useState(0)
  const [cameraKey, setCameraKey] = useState(0)
  const [scanCount, setScanCount] = useState(0)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [arming, setArming] = useState(false)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  // Always require a tap so iOS/Safari keeps the user gesture for getUserMedia
  const [liveOn, setLiveOn] = useState(false)

  useEffect(() => {
    unlockAudio()
  }, [])

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const flushPending = useCallback(() => {
    const conn = connRef.current
    if (!conn?.open || !pendingRef.current.length) return
    const queued = [...pendingRef.current]
    pendingRef.current = []
    for (const item of queued) {
      conn.send({
        type: 'barcode',
        code: item.code,
        intent: item.intent,
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

  const sendHit = useCallback((hit: ScanHit) => {
    if (pausedRef.current) return
    const intent = modeRef.current
    unlockAudio()
    if (intent === 'remove') playRemoveBeep()
    else playAddBeep()
    try {
      navigator.vibrate?.(intent === 'remove' ? [35, 30, 35] : 40)
    } catch {
      // ignore
    }
    setScanCount((n) => n + 1)
    setLastIntent(intent)
    setFlash(intent === 'remove' ? `− ${hit.code}` : `+ ${hit.code}`)
    setFlashTone('ok')
    pausedRef.current = true
    window.setTimeout(() => {
      pausedRef.current = false
    }, 480)

    const packet: ScanPacket = {
      type: 'barcode',
      code: hit.code,
      intent,
      at: Date.now(),
    }
    if (connRef.current?.open) {
      connRef.current.send(packet)
    } else {
      pendingRef.current.push({ code: hit.code, intent })
      setFlash(`Queued ${hit.code}`)
    }
  }, [])

  const { status, error, engine, ticks } = useFastBarcodeCamera(videoRef, {
    enabled: liveOn && secure,
    sessionKey: cameraKey,
    mediaStream,
    preferUserCamera: false,
    cooldownMs: SCAN_COOLDOWN_MS,
    requireLeaveFrame: true,
    onHit: sendHit,
  })

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')
    video.muted = true
    video.defaultMuted = true
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

  async function startLive() {
    unlockAudio()
    if (!secure) {
      setFlash('Open the HTTPS shop link for live scan')
      setFlashTone('error')
      return
    }
    setArming(true)
    setFlash('Opening camera…')
    setFlashTone('idle')
    try {
      const stream = await openCameraStream(false)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        video.srcObject = stream
        video.muted = true
        video.defaultMuted = true
        video.playsInline = true
        try {
          await video.play()
        } catch {
          // hook retries play after metadata
        }
      }
      setMediaStream(stream)
      setLiveOn(true)
      setCameraKey((n) => n + 1)
      setFlash('Point at barcode')
      setFlashTone('idle')
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Could not open camera — Allow camera, then Retry.'
      setFlash(message)
      setFlashTone('error')
      setLiveOn(false)
      setMediaStream(null)
    } finally {
      setArming(false)
    }
  }

  function submitManual() {
    const code = manualCode.trim()
    if (!code) return
    sendHit({ code, intent: 'add' })
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
            {status === 'live' && engine
              ? ` · ${engine} · ${ticks}`
              : status === 'starting'
                ? ' · warming…'
                : ''}
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
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full bg-black object-cover ${
            liveOn ? 'opacity-100' : 'opacity-0'
          }`}
          muted
          playsInline
          autoPlay
        />

        {!liveOn ? (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#0b1224] px-6 text-center">
            <p className="text-lg font-semibold">Live barcode camera</p>
            <p className="text-sm text-slate-300">
              {secure
                ? 'Tap to open the camera — left/center adds, right removes.'
                : 'This page needs HTTPS for live scan. Open the https:// shop link, then tap below.'}
            </p>
            <button
              type="button"
              onClick={() => void startLive()}
              disabled={arming}
              className="inline-flex min-h-14 w-full max-w-sm items-center justify-center rounded-2xl bg-[#3563E9] px-6 text-base font-semibold disabled:opacity-70"
            >
              {arming ? 'Opening…' : 'Start live scan'}
            </button>
          </div>
        ) : null}

        {liveOn && status === 'live' ? (
          <>
            <div
              className={`pointer-events-none absolute inset-0 z-10 ${
                mode === 'remove' ? 'bg-rose-500/30' : 'bg-emerald-500/25'
              }`}
            />
            <div className="pointer-events-none absolute inset-x-[8%] top-1/2 z-[15] h-[42%] -translate-y-1/2">
              <div
                className={`relative h-full rounded-xl border-[2.5px] ${
                  mode === 'remove' ? 'border-rose-300' : 'border-emerald-300'
                } shadow-[0_0_0_999px_rgba(0,0,0,0.28)]`}
              >
                <div
                  className={`absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 ${
                    mode === 'remove' ? 'bg-rose-200/90' : 'bg-emerald-200/90'
                  }`}
                />
              </div>
            </div>
            <div className="absolute inset-0 z-20 flex">
              <button
                type="button"
                className="w-[62%] bg-transparent"
                aria-label="Add mode"
                onClick={() => setMode('add')}
              />
              <button
                type="button"
                className="w-[38%] bg-transparent"
                aria-label="Remove mode"
                onClick={() => setMode('remove')}
              />
            </div>
          </>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black via-black/75 to-transparent px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-16">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('add')}
              className={`flex min-h-12 items-center justify-center gap-1.5 rounded-2xl text-sm font-bold ${
                mode === 'add' ? 'bg-emerald-500 text-white' : 'bg-white/15 text-white'
              }`}
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
            <button
              type="button"
              onClick={() => setMode('remove')}
              className={`flex min-h-12 items-center justify-center gap-1.5 rounded-2xl text-sm font-bold ${
                mode === 'remove' ? 'bg-rose-500 text-white' : 'bg-white/15 text-white'
              }`}
            >
              <Minus className="h-4 w-4" />
              Remove
            </button>
          </div>
          <p
            className={`rounded-2xl px-4 py-3.5 text-center text-base font-semibold ${
              flashTone === 'ok'
                ? lastIntent === 'remove'
                  ? 'bg-rose-500 text-white'
                  : 'bg-emerald-500 text-white'
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
                  ? mode === 'remove'
                    ? 'Remove'
                    : 'Add'
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
            {liveOn && (status === 'error' || error || flashTone === 'error') ? (
              <button
                type="button"
                onClick={() => void startLive()}
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
