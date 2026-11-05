import { formatZMW } from '@/lib/money'
import type { SaleWithItems } from '@/types/database'

const SHOP_NAME = 'Stationery Shop'

export function formatReceiptText(sale: SaleWithItems) {
  const when = new Date(sale.created_at).toLocaleString()
  const lines = [
    SHOP_NAME,
    '------------------------',
    `Receipt: ${sale.id.slice(0, 8).toUpperCase()}`,
    `Date: ${when}`,
    `Paid: ${sale.payment_method.toUpperCase()}`,
    '------------------------',
    ...sale.items.map(
      (item) =>
        `${item.product_name}\n  ${item.quantity} x ${formatZMW(item.unit_price)} = ${formatZMW(item.line_total)}`,
    ),
    '------------------------',
  ]

  if (sale.discount > 0) {
    lines.push(`Discount: -${formatZMW(sale.discount)}`)
  }
  lines.push(`TOTAL: ${formatZMW(sale.total)}`)
  lines.push('------------------------')
  lines.push('Thank you for shopping with us!')
  return lines.join('\n')
}

export function buildReceiptHtml(sale: SaleWithItems) {
  const when = new Date(sale.created_at).toLocaleString()
  const rows = sale.items
    .map(
      (item) => `
      <tr>
        <td style="padding:6px 0;border-bottom:1px dashed #ccc;">
          <div style="font-weight:600;">${escapeHtml(item.product_name)}</div>
          <div style="color:#555;font-size:12px;">${item.quantity} × ${formatZMW(item.unit_price)}</div>
        </td>
        <td style="padding:6px 0;border-bottom:1px dashed #ccc;text-align:right;vertical-align:top;">
          ${formatZMW(item.line_total)}
        </td>
      </tr>`,
    )
    .join('')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${sale.id.slice(0, 8)}</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; margin: 24px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .muted { color: #666; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    .total { font-size: 18px; font-weight: 700; margin-top: 12px; display:flex; justify-content:space-between; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${SHOP_NAME}</h1>
  <div class="muted">Receipt #${sale.id.slice(0, 8).toUpperCase()}</div>
  <div class="muted">${when}</div>
  <div class="muted">Payment: ${sale.payment_method.toUpperCase()}</div>
  <table>${rows}</table>
  ${
    sale.discount > 0
      ? `<div class="muted" style="margin-top:8px;display:flex;justify-content:space-between;"><span>Discount</span><span>-${formatZMW(sale.discount)}</span></div>`
      : ''
  }
  <div class="total"><span>TOTAL</span><span>${formatZMW(sale.total)}</span></div>
  <p class="muted" style="margin-top:20px;">Thank you for shopping with us!</p>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`
}

export function printReceipt(sale: SaleWithItems) {
  const html = buildReceiptHtml(sale)
  const frame = window.open('', '_blank', 'width=420,height=640')
  if (!frame) {
    throw new Error('Pop-up blocked. Allow pop-ups to print the receipt.')
  }
  frame.document.open()
  frame.document.write(html)
  frame.document.close()
}

/** Zambia-friendly: 097... / 26097... / +26097... → digits for wa.me */
export function normalizeWhatsAppPhone(raw: string) {
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 10) {
    digits = `260${digits.slice(1)}`
  }
  if (digits.length === 9 && /^[79]/.test(digits)) {
    digits = `260${digits}`
  }
  return digits
}

export function openWhatsAppReceipt(sale: SaleWithItems, phoneRaw: string) {
  const phone = normalizeWhatsAppPhone(phoneRaw)
  if (phone.length < 10) {
    throw new Error('Enter a valid phone number, e.g. 097xxxxxxx')
  }
  const text = encodeURIComponent(formatReceiptText(sale))
  window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener,noreferrer')
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
