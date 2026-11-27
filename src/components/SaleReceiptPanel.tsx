import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  Download,
  MessageCircle,
  Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatZMW } from '@/lib/money'
import {
  downloadReceiptPdf,
  printReceipt,
  sendWhatsAppReceiptPdf,
} from '@/lib/receipt'
import type { ShopReceiptProfile } from '@/lib/shopProfile'
import type { ReceiptTender, SaleWithItems } from '@/types/database'
import { paymentLabel } from '@/types/database'

type Props = {
  sale: SaleWithItems
  onDone: () => void
  doneLabel?: string
  changeDue?: number
  cashGiven?: number
  shop?: ShopReceiptProfile
  /** Called with a short reason (+ optional manager PIN) when voiding. */
  onVoid?: (reason: string, managerPin?: string) => void | Promise<void>
  /** Prompt for manager PIN on large voids when shop has PIN configured. */
  requireManagerPin?: boolean
  cashierName?: string | null
  branchName?: string | null
}

export function SaleReceiptPanel({
  sale,
  onDone,
  doneLabel = 'New sale',
  changeDue,
  cashGiven,
  shop,
  onVoid,
  requireManagerPin = false,
  cashierName,
  branchName,
}: Props) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [managerPin, setManagerPin] = useState('')
  const [voidBusy, setVoidBusy] = useState(false)

  const needsPin =
    requireManagerPin && sale.total >= 50
  const [cashInput, setCashInput] = useState(
    typeof cashGiven === 'number'
      ? String(cashGiven)
      : sale.payment_method === 'cash'
        ? String(sale.total)
        : '',
  )
  const [changeInput, setChangeInput] = useState(() => {
    if (typeof changeDue === 'number') return String(changeDue)
    if (typeof cashGiven === 'number') {
      return String(Number((cashGiven - sale.total).toFixed(2)))
    }
    if (sale.payment_method === 'cash') return '0'
    return ''
  })

  const tender = useMemo<ReceiptTender>(() => {
    const cash = cashInput.trim() === '' ? null : Number(cashInput)
    const change = changeInput.trim() === '' ? null : Number(changeInput)
    return {
      cashGiven: cash !== null && Number.isFinite(cash) ? cash : null,
      changeDue: change !== null && Number.isFinite(change) ? change : null,
    }
  }, [cashInput, changeInput])

  const options = useMemo(
    () => ({
      shop,
      tender,
      cashierName: cashierName ?? null,
      branchName: branchName ?? null,
    }),
    [shop, tender, cashierName, branchName],
  )

  function syncChangeFromCash(nextCash: string) {
    setCashInput(nextCash)
    const value = Number(nextCash)
    if (nextCash.trim() !== '' && Number.isFinite(value)) {
      setChangeInput(String(Number((value - sale.total).toFixed(2))))
    }
  }

  async function handlePrint() {
    setError('')
    try {
      printReceipt(sale, options)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not print')
    }
  }

  async function handlePdf() {
    setError('')
    setBusy(true)
    try {
      await downloadReceiptPdf(sale, options)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create PDF')
    } finally {
      setBusy(false)
    }
  }

  async function handleWhatsApp() {
    setError('')
    setBusy(true)
    try {
      await sendWhatsAppReceiptPdf(sale, phone, options)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open WhatsApp')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-ok dark:bg-emerald-500/10">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Sale complete</p>
          <p className="text-sm text-emerald-800/80 dark:text-emerald-200/80">
            Confirm cash received & change, then print or send the PDF.
          </p>
        </div>
      </div>

      {/* Mini receipt preview — mirrors print/PDF branding */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
        <div className="border-b-2 border-ink px-4 py-4 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-soft">
            Sale receipt
          </p>
          <p className="font-display mt-1.5 text-xl font-bold tracking-tight text-ink">
            {shop?.name?.trim() || 'Your shop'}
          </p>
          {shop?.address?.trim() ? (
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">
              {shop.address.trim()}
            </p>
          ) : null}
          {shop?.phone ? (
            <p className="mt-0.5 text-xs text-ink-soft">Tel {shop.phone}</p>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2 border-b border-line px-4 py-3 text-xs">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
              Receipt
            </p>
            <p className="font-semibold tabular-nums text-ink">
              #{sale.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
              Payment
            </p>
            <p className="font-semibold text-ink">
              {paymentLabel(sale.payment_method)}
            </p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
              Date
            </p>
            <p className="font-medium text-ink">
              {new Date(sale.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        {cashierName || branchName ? (
          <p className="border-b border-line px-4 py-2 text-center text-xs text-ink-soft">
            {[cashierName ? `Cashier ${cashierName}` : null, branchName]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}
        <ul className="divide-y divide-line px-4 py-1 text-sm">
          {sale.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3 py-2.5">
              <span className="min-w-0">
                <span className="font-semibold text-ink">{item.product_name}</span>
                <span className="mt-0.5 block text-xs text-ink-soft">
                  {item.quantity} × {formatZMW(item.unit_price)}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatZMW(item.line_total)}
              </span>
            </li>
          ))}
        </ul>
        <div className="space-y-1.5 border-t border-line bg-surface px-4 py-3 text-sm">
          {sale.discount > 0 ? (
            <div className="flex justify-between text-ink-soft">
              <span>Discount</span>
              <span>-{formatZMW(sale.discount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t-2 border-ink pt-2 text-base font-bold text-ink">
            <span>Total</span>
            <span className="tabular-nums">{formatZMW(sale.total)}</span>
          </div>
          {tender.cashGiven !== null ? (
            <div className="mt-2 space-y-1 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5">
              <div className="flex justify-between text-emerald-900 dark:text-emerald-100">
                <span>Cash received</span>
                <span className="font-semibold tabular-nums">
                  {formatZMW(tender.cashGiven)}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-emerald-700 dark:text-emerald-300">
                <span>Change given</span>
                <span className="tabular-nums">
                  {formatZMW(tender.changeDue ?? tender.cashGiven - sale.total)}
                </span>
              </div>
            </div>
          ) : null}
          <p className="pt-2 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
            Powered by NEXORA
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink">Edit cash & change</p>
        <p className="text-xs text-ink-soft">
          Example: total {formatZMW(sale.total)} · customer hands you{' '}
          {formatZMW(Math.ceil(sale.total / 50) * 50 || sale.total + 100)} →
          enter that as cash received; change calculates for the PDF.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-ink">Cash received</span>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={cashInput}
              onChange={(e) => syncChangeFromCash(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-line bg-card px-3 py-3 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-ink">Change to give</span>
            <input
              type="number"
              step="0.01"
              inputMode="decimal"
              value={changeInput}
              onChange={(e) => setChangeInput(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-line bg-card px-3 py-3 text-base outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
          </label>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink">WhatsApp PDF</p>
        <Input
          label="Customer phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="097xxxxxxx"
          hint="Premium PDF with cash received + change."
        />
        <Button
          type="button"
          variant="secondary"
          className="w-full min-h-12"
          disabled={busy}
          onClick={() => void handleWhatsApp()}
        >
          <MessageCircle className="h-4 w-4" />
          {busy ? 'Preparing PDF…' : 'Send PDF via WhatsApp'}
        </Button>
      </div>

      {error ? (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          className="min-h-12 flex-1"
          disabled={busy}
          onClick={() => void handlePdf()}
        >
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-12 flex-1"
          onClick={() => void handlePrint()}
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>
        <Button type="button" className="min-h-12 flex-1" onClick={onDone}>
          {doneLabel}
        </Button>
      </div>

      {onVoid ? (
        voidOpen ? (
          <div className="space-y-2 rounded-xl border border-red-500/25 bg-red-500/5 p-3">
            <p className="text-sm font-semibold text-ink">Void reason</p>
            <Input
              label="Reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Why void? (logged on Audit)"
              autoFocus
            />
            {needsPin ? (
              <Input
                label="Manager PIN"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value)}
                placeholder="4–6 digits"
                maxLength={6}
              />
            ) : null}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                disabled={voidBusy}
                onClick={() => {
                  setVoidOpen(false)
                  setVoidReason('')
                  setManagerPin('')
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                className="flex-1"
                disabled={
                  voidBusy ||
                  voidReason.trim().length < 3 ||
                  (needsPin && !/^\d{4,6}$/.test(managerPin.trim()))
                }
                onClick={() => {
                  void (async () => {
                    setVoidBusy(true)
                    setError('')
                    try {
                      await onVoid(
                        voidReason.trim(),
                        needsPin ? managerPin.trim() : undefined,
                      )
                      setVoidOpen(false)
                      setVoidReason('')
                      setManagerPin('')
                    } catch (err) {
                      setError(
                        err instanceof Error ? err.message : 'Void failed',
                      )
                    } finally {
                      setVoidBusy(false)
                    }
                  })()
                }}
              >
                Confirm void
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="danger"
            className="w-full"
            onClick={() => setVoidOpen(true)}
          >
            Void sale
          </Button>
        )
      ) : null}
    </div>
  )
}
