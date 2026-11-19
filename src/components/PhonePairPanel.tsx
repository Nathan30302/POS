import { useEffect, useRef, useState } from 'react'
import Peer, { type DataConnection } from 'peerjs'
import QRCode from 'qrcode'
import { Check, Copy, Smartphone, Wifi, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  createRoomCode,
  hostPeerId,
  phoneScanUrl,
  resolveShopOrigin,
  type ScanPacket,
  type ScanResult,
} from '@/lib/peerRoom'
import { playLinkBeep, unlockAudio } from '@/lib/sounds'

type Props = {
  onScan: (code: string) => ScanResult
  onClose: () => void
  onStatusChange?: (status: 'waiting' | 'connected' | 'error') => void
}

export function PhonePairPanel({ onScan, onClose, onStatusChange }: Props) {
  const [room] = useState(() => createRoomCode())
  const [url, setUrl] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [status, setStatus] = useState<'waiting' | 'connected' | 'error'>(
    'waiting',
  )
  const [detail, setDetail] = useState('Preparing Wi‑Fi phone link…')
  const [lastCode, setLastCode] = useState('')
  const [lastResult, setLastResult] = useState('')
  const [copied, setCopied] = useState(false)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan
  const connRef = useRef<DataConnection | null>(null)

  useEffect(() => {
    onStatusChange?.(status)
  }, [status, onStatusChange])

  useEffect(() => {
    let cancelled = false
    void resolveShopOrigin().then((origin) => {
      if (cancelled) return
      setUrl(phoneScanUrl(room, origin))
    })
    return () => {
      cancelled = true
    }
  }, [room])

  useEffect(() => {
    if (!url) return
    void QRCode.toDataURL(url, {
      width: 280,
      margin: 1,
      color: { dark: '#0b1224', light: '#ffffff' },
    }).then(setQrDataUrl)
  }, [url])

  useEffect(() => {
    unlockAudio()
    let peer: Peer | null = null
    let cancelled = false

    try {
      peer = new Peer(hostPeerId(room), { debug: 0 })
    } catch (err) {
      setStatus('error')
      setDetail(
        err instanceof Error ? err.message : 'Could not start phone link',
      )
      return
    }

    peer.on('open', () => {
      if (cancelled) return
      setDetail('Ready — scan the QR with your phone')
    })

    peer.on('connection', (connection) => {
      connRef.current = connection
      connection.on('open', () => {
        if (cancelled) return
        setStatus('connected')
        setDetail('Phone linked · keep scanning')
        playLinkBeep()
        connection.send({ type: 'ping' } satisfies ScanPacket)
      })
      connection.on('data', (raw) => {
        const data = raw as ScanPacket
        if (data?.type === 'hello') {
          setStatus('connected')
          setDetail(`Linked · ${data.device}`)
          playLinkBeep()
        }
        if (data?.type === 'barcode' && data.code) {
          setLastCode(data.code)
          const result = onScanRef.current(data.code)
          setLastResult(result.message)
          connection.send({
            type: 'ack',
            code: data.code,
            ok: result.ok,
            label: result.label,
            message: result.message,
          } satisfies ScanPacket)
        }
      })
      connection.on('close', () => {
        if (cancelled) return
        connRef.current = null
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
        connRef.current?.close()
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

  async function copyLink() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-royal">
            <Smartphone className="h-3.5 w-3.5" />
            Phone scanner
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            No phone login. Staff scan the QR, tap Scan product, and items land
            in this cart.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-line p-2 text-ink-soft hover:bg-brand-soft hover:text-ink"
          aria-label="Close phone scanner"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
          status === 'connected'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
            : status === 'error'
              ? 'border-red-500/30 bg-red-500/10 text-danger'
              : 'border-line bg-surface text-ink'
        }`}
      >
        {status === 'connected' ? (
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <Wifi className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="font-semibold">{detail}</p>
          {lastCode ? (
            <p className="mt-1 truncate text-xs opacity-80">
              Last: {lastCode}
              {lastResult ? ` · ${lastResult}` : ''}
            </p>
          ) : null}
        </div>
      </div>

      {status !== 'connected' ? (
        <>
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-card p-4">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Phone scanner QR"
                className="h-52 w-52 rounded-xl"
              />
            ) : (
              <div className="flex h-52 w-52 items-center justify-center text-sm text-ink-soft">
                Preparing Wi‑Fi QR…
              </div>
            )}
            <p className="font-mono text-2xl font-bold tracking-[0.28em] text-ink">
              {room}
            </p>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                disabled={!url}
                onClick={() => void copyLink()}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copy phone link
                  </>
                )}
              </Button>
            </div>
            <p className="break-all text-center text-[11px] text-ink-soft">
              {url || 'Resolving shop Wi‑Fi address…'}
            </p>
          </div>

          <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
            <li>Phone + laptop on the same Wi‑Fi</li>
            <li>Scan this QR (no sign-in on the phone)</li>
            <li>
              Tap <strong>Scan product</strong> — barcode adds here with a ting
            </li>
          </ol>
          <p className="text-xs text-ink-soft">
            Easier option: open NEXORA on the phone, sign in, go to{' '}
            <strong>Sell</strong> — catalogue + camera, sales sync to the shop
            (no QR needed).
          </p>
        </>
      ) : (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-5 text-center">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            Phone is live as your barcode gun
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            Keep scanning on the phone. You can keep selling on this screen.
          </p>
        </div>
      )}
    </div>
  )
}

/** @deprecated use PhonePairPanel */
export { PhonePairPanel as PhonePairModal }
