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
  onVoid?: () => void
}

export function SaleReceiptPanel({
  sale,
  onDone,
  doneLabel = 'New sale',
  changeDue,
  cashGiven,
  shop,
  onVoid,
}: Props) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cashInput, setCashInput] = useState(
    typeof cashGiven === 'number' ? String(cashGiven) : '',
  )
  const [changeInput, setChangeInput] = useState(
    typeof changeDue === 'number' ? String(changeDue) : '',
  )

  const tender = useMemo<ReceiptTender>(() => {
    const cash = cashInput.trim() === '' ? null : Number(cashInput)
    const change = changeInput.trim() === '' ? null : Number(changeInput)
    return {
      cashGiven: cash !== null && Number.isFinite(cash) ? cash : null,
      changeDue: change !== null && Number.isFinite(change) ? change : null,
    }
  }, [cashInput, changeInput])

  const options = useMemo(
    () => ({ shop, tender }),
    [shop, tender],
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
      const result = await sendWhatsAppReceiptPdf(sale, phone, options)
      if (result.mode === 'download') {
        setError('')
      }
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
            Edit cash & change, then print or send a premium PDF on WhatsApp.
          </p>
        </div>
      </div>

      <div className="space-y-1 text-sm">
        <p>
          <span className="text-ink-soft">Total:</span>{' '}
          <strong>{formatZMW(sale.total)}</strong>
        </p>
        <p>
          <span className="text-ink-soft">Payment:</span>{' '}
          <strong>{paymentLabel(sale.payment_method)}</strong>
        </p>
        {sale.discount > 0 ? (
          <p>
            <span className="text-ink-soft">Discount:</span>{' '}
            {formatZMW(sale.discount)}
          </p>
        ) : null}
      </div>

      <div className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold text-ink">Cash & change</p>
        <p className="text-xs text-ink-soft">
          Adjust before print / WhatsApp if the customer’s tender changed.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-ink">Cash given</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={cashInput}
              onChange={(e) => syncChangeFromCash(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-line bg-card px-3 py-2.5 outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-ink">Change</span>
            <input
              type="number"
              step="0.01"
              value={changeInput}
              onChange={(e) => setChangeInput(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-line bg-card px-3 py-2.5 outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
            />
          </label>
        </div>
        {tender.changeDue !== null ? (
          <p
            className={`text-sm font-semibold ${
              tender.changeDue < 0 ? 'text-danger' : 'text-ok'
            }`}
          >
            Change on receipt: {formatZMW(tender.changeDue)}
          </p>
        ) : null}
      </div>

      <ul className="space-y-2 rounded-xl border border-line p-3 text-sm">
        {sale.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span>
              {item.product_name} × {item.quantity}
            </span>
            <span className="font-medium">{formatZMW(item.line_total)}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-3 rounded-2xl border border-line bg-slate-50 p-4 dark:bg-white/5">
        <p className="text-sm font-semibold text-ink">WhatsApp PDF receipt</p>
        <Input
          label="Customer phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="097xxxxxxx"
          hint="Creates a premium PDF. On phone it can share straight into WhatsApp; on laptop it downloads the PDF and opens the chat."
        />
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={busy}
          onClick={() => void handleWhatsApp()}
        >
          <MessageCircle className="h-4 w-4" />
          {busy ? 'Preparing PDF…' : 'Send PDF via WhatsApp'}
        </Button>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger dark:bg-red-500/10">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          disabled={busy}
          onClick={() => void handlePdf()}
        >
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={() => void handlePrint()}
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>
        <Button type="button" className="flex-1" onClick={onDone}>
          {doneLabel}
        </Button>
      </div>

      {onVoid ? (
        <Button
          type="button"
          variant="danger"
          className="w-full"
          onClick={() => {
            if (
              window.confirm(
                'Void this sale? Stock will be returned to the shelf.',
              )
            ) {
              onVoid()
            }
          }}
        >
          Void sale
        </Button>
      ) : null}
    </div>
  )
}
