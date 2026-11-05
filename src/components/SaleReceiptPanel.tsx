import { useState } from 'react'
import { CheckCircle2, MessageCircle, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatZMW } from '@/lib/money'
import { openWhatsAppReceipt, printReceipt } from '@/lib/receipt'
import type { SaleWithItems } from '@/types/database'

type Props = {
  sale: SaleWithItems
  onDone: () => void
  doneLabel?: string
  changeDue?: number
  onVoid?: () => void
}

export function SaleReceiptPanel({
  sale,
  onDone,
  doneLabel = 'New sale',
  changeDue,
  onVoid,
}: Props) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  function handlePrint() {
    setError('')
    try {
      printReceipt(sale)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not print')
    }
  }

  function handleWhatsApp() {
    setError('')
    try {
      openWhatsAppReceipt(sale, phone)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open WhatsApp')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-ok">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Sale complete</p>
          <p className="text-sm text-emerald-800/80">
            Print a receipt or send it on WhatsApp.
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
          <strong className="capitalize">{sale.payment_method}</strong>
        </p>
        {sale.discount > 0 ? (
          <p>
            <span className="text-ink-soft">Discount:</span>{' '}
            {formatZMW(sale.discount)}
          </p>
        ) : null}
        {typeof changeDue === 'number' ? (
          <p>
            <span className="text-ink-soft">Change:</span>{' '}
            <strong>{formatZMW(changeDue)}</strong>
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

      <div className="space-y-3 rounded-2xl border border-line bg-slate-50 p-4">
        <p className="text-sm font-semibold text-ink">Send WhatsApp receipt</p>
        <Input
          label="Customer phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="097xxxxxxx"
          hint="Opens WhatsApp with the receipt ready to send."
        />
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={handleWhatsApp}
        >
          <MessageCircle className="h-4 w-4" />
          Send via WhatsApp
        </Button>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={handlePrint}
        >
          <Printer className="h-4 w-4" />
          Print receipt
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
