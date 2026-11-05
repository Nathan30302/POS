import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Peer, { type DataConnection } from 'peerjs'
import { useFastBarcodeCamera } from '@/hooks/useFastBarcodeCamera'
import {
  hostPeerId,
  type ScanPacket,
} from '@/lib/peerRoom'
import {
  playErrorBuzz,
  playLinkBeep,
  playScanBeep,
  unlockAudio,
} from '@/lib/sounds'

/**
 * Full-screen phone scanner. Opens from QR on the till.
 * Sends each barcode to the laptop over PeerJS.
 */
export function PhoneScannerPage() {
  const { roomId = '' } = useParams()
  const room = roomId.toUpperCase()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const connRef = useRef<DataConnection | null>(null)
  const [link, setLink] = useState<'connecting' | 'ready' | 'error'>('connecting')
  const [linkDetail, setLinkDetail] = useState('Connecting to till…')
  const [flash, setFlash] = useState('Point at a barcode')
  const [flashTone, setFlashTone] = useState<'ok' | 'idle' | 'error'>('idle')

  useEffect(() => {
    unlockAudio()
  }, [])

  useEffect(() => {
    if (!room) {
      setLink('error')
      setLinkDetail('Missing room code')
      return
    }

    let cancelled = false
    const peer = new Peer({ debug: 0 })
    let conn: DataConnection | null = null

    peer.on('open', () => {
      if (cancelled) return
      conn = peer.connect(hostPeerId(room), { reliable: true })
      connRef.current = conn

      conn.on('open', () => {
        if (cancelled) return
        setLink('ready')
        setLinkDetail('Linked to till — scan now')
        playLinkBeep()
        conn?.send({
          type: 'hello',
          device: navigator.userAgent.includes('iPhone')
            ? 'iPhone'
            : 'Phone',
        } satisfies ScanPacket)
      })

      conn.on('close', () => {
        if (cancelled) return
        setLink('error')
        setLinkDetail('Disconnected from till. Re-open the QR.')
      })

      conn.on('error', () => {
        if (cancelled) return
        setLink('error')
        setLinkDetail('Could not stay linked. Re-scan the QR on the till.')
      })
    })

    peer.on('error', (err) => {
      if (cancelled) return
      setLink('error')
      setLinkDetail(err.message || 'Connection failed')
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
  }, [room])

  const { status, ticks, error } = useFastBarcodeCamera(videoRef, {
    enabled: link !== 'error',
    cooldownMs: 700,
    onCode: (code) => {
      unlockAudio()
      const packet: ScanPacket = {
        type: 'barcode',
        code,
        at: Date.now(),
      }
      if (connRef.current?.open) {
        connRef.current.send(packet)
        playScanBeep()
        setFlash(`Sent ${code}`)
        setFlashTone('ok')
      } else {
        playErrorBuzz()
        setFlash('Not linked — re-open QR from till')
        setFlashTone('error')
      }
      window.setTimeout(() => {
        setFlash('Point at a barcode')
        setFlashTone('idle')
      }, 1200)
    },
  })

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-300">
            Phone scanner
          </p>
          <p className="text-sm font-semibold">Room {room || '—'}</p>
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

      <div className="relative min-h-0 flex-1">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          muted
          playsInline
          autoPlay
        />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-32 -translate-y-1/2 rounded-2xl border-2 border-teal-300/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-6 pt-16">
          <p
            className={`rounded-2xl px-4 py-3 text-center text-base font-semibold ${
              flashTone === 'ok'
                ? 'bg-emerald-500 text-white'
                : flashTone === 'error'
                  ? 'bg-red-500 text-white'
                  : 'bg-white/15 text-white'
            }`}
          >
            {flash}
          </p>
          <p className="mt-2 text-center text-xs text-slate-300">
            {status === 'live'
              ? `Camera live · ${ticks}`
              : status === 'starting'
                ? 'Starting camera…'
                : error || 'Camera idle'}
          </p>
        </div>
      </div>
    </div>
  )
}
