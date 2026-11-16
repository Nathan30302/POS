import { useEffect, useRef, useState } from 'react'
import Peer, { type DataConnection } from 'peerjs'
import QRCode from 'qrcode'
import { Smartphone, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  createRoomCode,
  hostPeerId,
  isLocalhostOrigin,
  phoneScanUrl,
  type ScanPacket,
} from '@/lib/peerRoom'
import { playLinkBeep, unlockAudio } from '@/lib/sounds'

type Props = {
  onCode: (code: string) => void
  onClose: () => void
}

export function PhonePairModal({ onCode, onClose }: Props) {
  const [room] = useState(() => createRoomCode())
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [status, setStatus] = useState<'waiting' | 'connected' | 'error'>(
    'waiting',
  )
  const [detail, setDetail] = useState('Waiting for phone…')
  const [lastCode, setLastCode] = useState('')
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode

  const url = phoneScanUrl(room)
  const localhostWarn = isLocalhostOrigin()

  useEffect(() => {
    void QRCode.toDataURL(url, {
      width: 280,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    }).then(setQrDataUrl)
  }, [url])

  useEffect(() => {
    unlockAudio()
    let peer: Peer | null = null
    let conn: DataConnection | null = null
    let cancelled = false

    try {
      peer = new Peer(hostPeerId(room), {
        debug: 0,
      })
    } catch (err) {
      setStatus('error')
      setDetail(
        err instanceof Error ? err.message : 'Could not start phone link',
      )
      return
    }

    peer.on('open', () => {
      if (cancelled) return
      setDetail('Room ready — scan the QR with your phone')
    })

    peer.on('connection', (connection) => {
      conn = connection
      connection.on('open', () => {
        if (cancelled) return
        setStatus('connected')
        setDetail('Phone connected · scan products now')
        playLinkBeep()
        connection.send({ type: 'ping' } satisfies ScanPacket)
      })
      connection.on('data', (raw) => {
        const data = raw as ScanPacket
        if (data?.type === 'barcode' && data.code) {
          setLastCode(data.code)
          onCodeRef.current(data.code)
        }
        if (data?.type === 'hello') {
          setStatus('connected')
          setDetail(`Linked · ${data.device}`)
          playLinkBeep()
        }
      })
      connection.on('close', () => {
        if (cancelled) return
        setStatus('waiting')
        setDetail('Phone disconnected — scan the QR again')
      })
    })

    peer.on('error', (err) => {
      if (cancelled) return
      setStatus('error')
      setDetail(err.message || 'Phone link error')
    })

    return () => {
      cancelled = true
      try {
        conn?.close()
      } catch {
        // ignore
      }
      try {
        peer?.destroy()
      } catch {
        // ignore
      }
    }
  }, [room])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand/20 bg-brand-soft/40 px-4 py-3 text-sm text-ink">
        <p className="font-semibold text-brand">Use your phone as the scanner</p>
        <p className="mt-1 text-ink-soft">
          Phone cameras read barcodes much faster than most laptop webcams.
          Keep this page open on the counter; scan on the phone.
        </p>
      </div>

      {localhostWarn ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong>Important:</strong> You’re on <code>localhost</code>. On the
          laptop, open NEXORA with your Wi‑Fi address first (e.g.{' '}
          <code>http://192.168.x.x:5173</code>), then open Connect phone again so
          the QR works on your phone.
        </div>
      ) : null}

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-white p-4">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="Phone scanner QR" className="h-56 w-56" />
        ) : (
          <div className="flex h-56 w-56 items-center justify-center text-sm text-ink-soft">
            Preparing QR…
          </div>
        )}
        <p className="font-mono text-2xl font-bold tracking-[0.3em] text-ink">
          {room}
        </p>
        <p className="break-all text-center text-xs text-ink-soft">{url}</p>
      </div>

      <div
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
          status === 'connected'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : status === 'error'
              ? 'border-red-100 bg-red-50 text-danger'
              : 'border-line bg-slate-50 text-ink'
        }`}
      >
        {status === 'connected' ? (
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <Wifi className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <div>
          <p className="font-semibold">{detail}</p>
          {lastCode ? (
            <p className="mt-1 text-xs opacity-80">Last scan: {lastCode}</p>
          ) : null}
        </div>
      </div>

      <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-soft">
        <li>Phone and laptop on the same Wi‑Fi</li>
        <li>Open the phone camera and scan this QR (or open the link)</li>
        <li>Allow camera on the phone — scan items; they appear on this counter</li>
      </ol>

      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )
}
