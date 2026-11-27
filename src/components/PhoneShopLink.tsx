import { useEffect, useState } from 'react'
import { Check, Copy, Smartphone } from 'lucide-react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/Button'
import { resolveShopOrigin } from '@/lib/peerRoom'

type Props = {
  /** Path after origin, e.g. /login or /app/checkout */
  path?: string
  compact?: boolean
  title?: string
  hint?: string
}

function isPhoneUa() {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

/**
 * Laptop-only: Wi‑Fi / HTTPS shop URL + QR so staff open NEXORA on a phone.
 * Hidden entirely when already on a phone.
 */
export function PhoneShopLink({
  path = '/login',
  compact = false,
  title = 'Open on your phone',
  hint = 'Same Wi‑Fi as this computer · sign in · use Sell',
}: Props) {
  const onPhone = isPhoneUa()
  const [url, setUrl] = useState('')
  const [qr, setQr] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (onPhone) return
    let cancelled = false
    void resolveShopOrigin().then((origin) => {
      if (cancelled) return
      const full = `${origin.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
      setUrl(full)
    })
    return () => {
      cancelled = true
    }
  }, [path, onPhone])

  useEffect(() => {
    if (onPhone || !url) return
    void QRCode.toDataURL(url, {
      width: compact ? 160 : 220,
      margin: 1,
      color: { dark: '#0b1224', light: '#ffffff' },
    }).then(setQr)
  }, [url, compact, onPhone])

  if (onPhone) return null

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // ignore
    }
  }

  return (
    <div
      className={`rounded-2xl border border-royal/25 bg-gradient-to-br from-royal/10 via-card to-teal/10 ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-royal text-white">
          <Smartphone className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>
        </div>
      </div>

      <div
        className={`mt-3 flex ${compact ? 'flex-col items-center gap-3' : 'flex-col items-center gap-3 sm:flex-row sm:items-start'}`}
      >
        {qr ? (
          <img
            src={qr}
            alt="Phone link QR"
            className={`rounded-xl bg-white ${compact ? 'h-36 w-36' : 'h-44 w-44'}`}
          />
        ) : (
          <div
            className={`flex items-center justify-center rounded-xl bg-surface text-xs text-ink-soft ${
              compact ? 'h-36 w-36' : 'h-44 w-44'
            }`}
          >
            Preparing…
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
          <p className="break-all font-mono text-xs font-semibold text-ink sm:text-sm">
            {url || 'Finding Wi‑Fi address…'}
          </p>
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl"
              disabled={!url}
              onClick={() => void copy()}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copy link
                </>
              )}
            </Button>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-semibold text-ink hover:bg-brand-soft"
              >
                Open
              </a>
            ) : null}
          </div>
          <p className="text-[11px] text-ink-soft">
            Laptop shows this QR · phone opens Sell for fast scanning.
          </p>
        </div>
      </div>
    </div>
  )
}
