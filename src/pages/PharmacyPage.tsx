import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Pill, RefreshCw } from 'lucide-react'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { formatZMW } from '@/lib/money'

type ExpiringLot = {
  id: string
  productId: string
  productName: string
  barcode: string | null
  requiresPrescription: boolean
  lotNumber: string
  expiryDate: string
  quantity: number
  costPrice: number | null
  daysLeft: number
  expired: boolean
}

export function PharmacyPage() {
  const [days, setDays] = useState(90)
  const [lots, setLots] = useState<ExpiringLot[]>([])
  const [enabled, setEnabled] = useState(false)
  const [industry, setIndustry] = useState('')
  const [pageLabel, setPageLabel] = useState('Pharmacy')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [receive, setReceive] = useState({
    productId: '',
    lotNumber: '',
    expiryDate: '',
    quantity: 10,
    costPrice: '',
  })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const meta = await api<{
        enabled: boolean
        industry: string
        label?: string
      }>('/pharmacy/meta')
      setEnabled(meta.enabled)
      setIndustry(meta.industry)
      setPageLabel(meta.label || 'Pharmacy')
      if (!meta.enabled) {
        setLots([])
        return
      }
      const data = await api<{ batches: ExpiringLot[] }>(
        `/pharmacy/expiring?days=${days}&expired=1`,
      )
      setLots(data.batches)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load pharmacy')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    void load()
  }, [load])

  async function enablePharmacy() {
    setBusy(true)
    setError('')
    try {
      await api('/business/me', {
        method: 'PATCH',
        body: JSON.stringify({
          industry: 'pharmacy',
          settings: { pharmacy: { enabled: true, warnDays: 90 } },
        }),
      })
      setOk('Pharmacy mode on — receive stock with lot + expiry.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable')
    } finally {
      setBusy(false)
    }
  }

  async function scanAlerts() {
    setBusy(true)
    try {
      const data = await api<{ alerted: number }>('/pharmacy/scan-alerts', {
        method: 'POST',
        body: '{}',
      })
      setOk(
        data.alerted
          ? `Posted expiry alert for ${data.alerted} lot(s).`
          : 'No lots in the warning window.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Alert scan failed')
    } finally {
      setBusy(false)
    }
  }

  async function receiveLot(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setOk('')
    try {
      await api('/pharmacy/receive', {
        method: 'POST',
        body: JSON.stringify({
          productId: receive.productId.trim(),
          lotNumber: receive.lotNumber.trim(),
          expiryDate: new Date(receive.expiryDate).toISOString(),
          quantity: receive.quantity,
          costPrice: receive.costPrice
            ? Number(receive.costPrice)
            : undefined,
        }),
      })
      setOk('Lot received into FEFO stock.')
      setReceive((r) => ({ ...r, lotNumber: '', quantity: 10 }))
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Receive failed')
    } finally {
      setBusy(false)
    }
  }

  const expired = lots.filter((l) => l.expired)
  const soon = lots.filter((l) => !l.expired)

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHero
        eyebrow={`${pageLabel} · lots · FEFO`}
        title="Expiry & dispense"
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || loading}
              onClick={() => void load()}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => void scanAlerts()}
            >
              Push expiry alerts
            </Button>
          </>
        }
      />

      {error ? <FormBanner tone="error">{error}</FormBanner> : null}
      {ok ? <FormBanner tone="ok">{ok}</FormBanner> : null}

      {!enabled ? (
        <section className="nx-card space-y-3 p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal/15 text-teal">
              <Pill className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-ink">Enable pharmacy mode</h3>
              <p className="text-sm text-ink-soft">
                Lot numbers, expiry dates, FEFO selling, and Rx notes on Sell.
                Works alongside general retail on the same shop.
              </p>
            </div>
          </div>
          <Button type="button" disabled={busy} onClick={() => void enablePharmacy()}>
            Turn on pharmacy
          </Button>
        </section>
      ) : (
        <p className="text-xs text-ink-soft">
          Pharmacy mode active
          {industry ? ` · industry “${industry}”` : ''}. Sell deducts
          soonest-expiring lots first.
        </p>
      )}

      <section className="nx-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="nx-section-title">Receive lot</h3>
            <p className="text-xs text-ink-soft">
              Paste a product id from Inventory (edit product → copy id) or open
              Inventory and receive with lot fields.
            </p>
          </div>
          <Link
            to="/app/products"
            className="text-xs font-semibold text-royal hover:underline"
          >
            Open Inventory
          </Link>
        </div>
        <form
          onSubmit={receiveLot}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Input
            label="Product ID"
            value={receive.productId}
            onChange={(e) =>
              setReceive((r) => ({ ...r, productId: e.target.value }))
            }
            required
          />
          <Input
            label="Lot / batch #"
            value={receive.lotNumber}
            onChange={(e) =>
              setReceive((r) => ({ ...r, lotNumber: e.target.value }))
            }
            required
          />
          <Input
            label="Expiry date"
            type="date"
            value={receive.expiryDate}
            onChange={(e) =>
              setReceive((r) => ({ ...r, expiryDate: e.target.value }))
            }
            required
          />
          <Input
            label="Quantity"
            type="number"
            min={1}
            value={receive.quantity}
            onChange={(e) =>
              setReceive((r) => ({
                ...r,
                quantity: Math.max(1, Number(e.target.value) || 1),
              }))
            }
            required
          />
          <Input
            label="Cost / unit (optional)"
            value={receive.costPrice}
            onChange={(e) =>
              setReceive((r) => ({ ...r, costPrice: e.target.value }))
            }
          />
          <div className="flex items-end">
            <Button type="submit" disabled={busy} className="w-full">
              Receive into FEFO
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="nx-section-title">Expiring lots</h3>
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            Window
            <select
              className="nx-field py-1 text-xs"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {[30, 60, 90, 180, 365].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <p className="text-sm text-ink-soft">Loading lots…</p>
        ) : lots.length === 0 ? (
          <div className="nx-card p-6 text-sm text-ink-soft">
            No lots in this window. Receive stock with lot + expiry to start
            FEFO tracking.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Lot</th>
                  <th className="px-3 py-2">Expiry</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {[...expired, ...soon].map((l) => (
                  <tr
                    key={l.id}
                    className={`border-t border-line ${
                      l.expired
                        ? 'bg-danger/5'
                        : l.daysLeft <= 30
                          ? 'bg-amber-500/5'
                          : ''
                    }`}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium text-ink">{l.productName}</p>
                      <p className="text-[11px] text-ink-soft">
                        {l.requiresPrescription ? 'Rx · ' : ''}
                        {l.barcode || l.productId.slice(0, 8)}
                      </p>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{l.lotNumber}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        {l.expired || l.daysLeft <= 30 ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        ) : null}
                        {l.expiryDate.slice(0, 10)}
                        <span className="text-[11px] text-ink-soft">
                          {l.expired ? 'expired' : `${l.daysLeft}d`}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2">{l.quantity}</td>
                    <td className="px-3 py-2 text-ink-soft">
                      {l.costPrice != null
                        ? formatZMW(l.costPrice * l.quantity)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
