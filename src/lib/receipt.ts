import { jsPDF } from 'jspdf'
import { formatZMW } from '@/lib/money'
import type { ShopReceiptProfile } from '@/lib/shopProfile'
import type { ReceiptTender, SaleWithItems } from '@/types/database'
import { paymentLabel } from '@/types/database'

export type ReceiptOptions = {
  shop?: ShopReceiptProfile
  tender?: ReceiptTender
}

function shopName(shop?: ShopReceiptProfile) {
  return shop?.name?.trim() || 'NEXORA Shop'
}

function receiptCode(sale: SaleWithItems) {
  return sale.id.slice(0, 8).toUpperCase()
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function formatReceiptText(
  sale: SaleWithItems,
  options: ReceiptOptions = {},
) {
  const when = new Date(sale.created_at).toLocaleString()
  const name = shopName(options.shop)
  const lines = [
    name,
    options.shop?.phone ? `Tel: ${options.shop.phone}` : '',
    '------------------------------',
    `Receipt: ${receiptCode(sale)}`,
    `Date: ${when}`,
    `Paid: ${paymentLabel(sale.payment_method)}`,
    '------------------------------',
    ...sale.items.map(
      (item) =>
        `${item.product_name}\n  ${item.quantity} x ${formatZMW(item.unit_price)} = ${formatZMW(item.line_total)}`,
    ),
    '------------------------------',
  ].filter(Boolean)

  if (sale.discount > 0) lines.push(`Discount: -${formatZMW(sale.discount)}`)
  lines.push(`TOTAL: ${formatZMW(sale.total)}`)
  if (typeof options.tender?.cashGiven === 'number') {
    lines.push(`Cash given: ${formatZMW(options.tender.cashGiven)}`)
  }
  if (typeof options.tender?.changeDue === 'number') {
    lines.push(`Change: ${formatZMW(options.tender.changeDue)}`)
  }
  lines.push('------------------------------')
  lines.push('Thank you for shopping with us!')
  return lines.join('\n')
}

export function buildReceiptHtml(
  sale: SaleWithItems,
  options: ReceiptOptions = {},
) {
  const when = new Date(sale.created_at).toLocaleString()
  const name = shopName(options.shop)
  const rows = sale.items
    .map(
      (item) => `
      <tr>
        <td>
          <div class="item">${escapeHtml(item.product_name)}</div>
          <div class="meta">${item.quantity} × ${formatZMW(item.unit_price)}</div>
        </td>
        <td class="amount">${formatZMW(item.line_total)}</td>
      </tr>`,
    )
    .join('')

  const cashRow =
    typeof options.tender?.cashGiven === 'number'
      ? `<div class="row"><span>Cash given</span><span>${formatZMW(options.tender.cashGiven)}</span></div>`
      : ''
  const changeRow =
    typeof options.tender?.changeDue === 'number'
      ? `<div class="row strong"><span>Change</span><span>${formatZMW(options.tender.changeDue)}</span></div>`
      : ''

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${receiptCode(sale)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Fraunces:opsz,wght@9..144,700&display=swap');
    :root { --navy:#0b1224; --royal:#3563E9; --teal:#14b8a6; --line:#e2e8f0; }
    * { box-sizing: border-box; }
    body { margin:0; background:#eef2f7; color:var(--navy); font-family:'DM Sans',system-ui,sans-serif; }
    .sheet {
      width: 420px; max-width: 100%; margin: 24px auto; background:#fff;
      border-radius: 18px; overflow:hidden; box-shadow: 0 18px 50px rgba(11,18,36,.14);
    }
    .hero {
      background: linear-gradient(135deg, #0b1224 0%, #1e3a8a 55%, #0f766e 100%);
      color:#fff; padding: 28px 24px 22px;
    }
    .brand { font-size:11px; letter-spacing:.22em; text-transform:uppercase; opacity:.75; }
    h1 { font-family:'Fraunces',Georgia,serif; font-size:28px; margin:8px 0 4px; font-weight:700; }
    .sub { font-size:12px; opacity:.85; line-height:1.45; }
    .body { padding: 22px 24px 28px; }
    .meta-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:18px; }
    .pill { background:#f8fafc; border:1px solid var(--line); border-radius:12px; padding:10px 12px; }
    .pill span { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:#64748b; }
    .pill strong { display:block; margin-top:4px; font-size:13px; }
    table { width:100%; border-collapse:collapse; }
    td { padding:10px 0; border-bottom:1px dashed #dbe3ef; vertical-align:top; font-size:13px; }
    td.amount { text-align:right; font-weight:600; white-space:nowrap; padding-left:12px; }
    .item { font-weight:600; }
    .meta { color:#64748b; font-size:12px; margin-top:2px; }
    .totals { margin-top:16px; background:#f8fafc; border:1px solid var(--line); border-radius:14px; padding:14px; }
    .row { display:flex; justify-content:space-between; gap:12px; font-size:13px; margin:6px 0; color:#475569; }
    .row.strong { color:var(--navy); font-weight:700; font-size:16px; margin-top:10px; }
    .thanks { margin-top:22px; text-align:center; font-size:12px; color:#64748b; }
    .mark { margin-top:8px; text-align:center; font-size:10px; letter-spacing:.18em; text-transform:uppercase; color:#94a3b8; }
    @media print {
      body { background:#fff; }
      .sheet { margin:0; width:100%; box-shadow:none; border-radius:0; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="hero">
      <div class="brand">NEXORA receipt</div>
      <h1>${escapeHtml(name)}</h1>
      <div class="sub">
        ${options.shop?.address ? `${escapeHtml(options.shop.address)}<br/>` : ''}
        ${options.shop?.phone ? `Tel ${escapeHtml(options.shop.phone)}` : ''}
      </div>
    </div>
    <div class="body">
      <div class="meta-grid">
        <div class="pill"><span>Receipt</span><strong>#${receiptCode(sale)}</strong></div>
        <div class="pill"><span>Payment</span><strong>${escapeHtml(paymentLabel(sale.payment_method))}</strong></div>
        <div class="pill" style="grid-column:1/-1"><span>Date</span><strong>${escapeHtml(when)}</strong></div>
      </div>
      <table>${rows}</table>
      <div class="totals">
        ${
          sale.discount > 0
            ? `<div class="row"><span>Discount</span><span>-${formatZMW(sale.discount)}</span></div>`
            : ''
        }
        <div class="row strong"><span>Total</span><span>${formatZMW(sale.total)}</span></div>
        ${cashRow}
        ${changeRow}
      </div>
      <p class="thanks">Thank you for shopping with us. Keep this receipt for your records.</p>
      <p class="mark">Powered by NEXORA</p>
    </div>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`
}

export function printReceipt(sale: SaleWithItems, options: ReceiptOptions = {}) {
  const html = buildReceiptHtml(sale, options)
  const frame = window.open('', '_blank', 'width=480,height=720')
  if (!frame) {
    throw new Error('Pop-up blocked. Allow pop-ups to print the receipt.')
  }
  frame.document.open()
  frame.document.write(html)
  frame.document.close()
}

export async function buildReceiptPdf(
  sale: SaleWithItems,
  options: ReceiptOptions = {},
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 48
  const contentW = pageW - margin * 2
  const name = shopName(options.shop)
  const when = new Date(sale.created_at).toLocaleString()

  // Hero banner
  doc.setFillColor(11, 18, 36)
  doc.rect(0, 0, pageW, 132, 'F')
  doc.setFillColor(53, 99, 233)
  doc.rect(0, 132, pageW, 4, 'F')
  doc.setFillColor(20, 184, 166)
  doc.rect(0, 136, pageW, 3, 'F')

  doc.setTextColor(148, 163, 184)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('NEXORA OFFICIAL RECEIPT', margin, 36)

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.text(name.slice(0, 42), margin, 72)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  const heroLines: string[] = []
  if (options.shop?.address) heroLines.push(options.shop.address)
  if (options.shop?.phone) heroLines.push(`Tel ${options.shop.phone}`)
  doc.setTextColor(203, 213, 225)
  doc.text(heroLines.join('  ·  ') || 'Premium shop receipt', margin, 98)

  let y = 176
  doc.setTextColor(11, 18, 36)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Receipt #${receiptCode(sale)}`, margin, y)
  doc.setFont('helvetica', 'normal')
  doc.text(when, pageW - margin, y, { align: 'right' })
  y += 18
  doc.setTextColor(71, 85, 105)
  doc.text(`Payment · ${paymentLabel(sale.payment_method)}`, margin, y)
  y += 28

  // Table header
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(margin, y - 14, contentW, 28, 6, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(9)
  doc.text('ITEM', margin + 12, y + 2)
  doc.text('QTY', margin + contentW * 0.58, y + 2)
  doc.text('AMOUNT', pageW - margin - 12, y + 2, { align: 'right' })
  y += 28

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(11)

  for (const item of sale.items) {
    if (y > 700) {
      doc.addPage()
      y = 56
    }
    const title = doc.splitTextToSize(item.product_name, contentW * 0.52)
    doc.setFont('helvetica', 'bold')
    doc.text(title, margin + 4, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.setFontSize(9)
    doc.text(
      `${item.quantity} × ${formatZMW(item.unit_price)}`,
      margin + contentW * 0.58,
      y,
    )
    doc.setTextColor(15, 23, 42)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text(formatZMW(item.line_total), pageW - margin - 4, y, {
      align: 'right',
    })
    y += Math.max(22, title.length * 14)
    doc.setDrawColor(226, 232, 240)
    doc.line(margin, y - 8, pageW - margin, y - 8)
  }

  y += 18
  const boxH =
    64 +
    (sale.discount > 0 ? 18 : 0) +
    (typeof options.tender?.cashGiven === 'number' ? 18 : 0) +
    (typeof options.tender?.changeDue === 'number' ? 18 : 0)

  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, y, contentW, boxH, 10, 10, 'FD')

  let ty = y + 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(71, 85, 105)

  if (sale.discount > 0) {
    doc.text('Discount', margin + 16, ty)
    doc.text(`-${formatZMW(sale.discount)}`, pageW - margin - 16, ty, {
      align: 'right',
    })
    ty += 18
  }

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(11, 18, 36)
  doc.setFontSize(14)
  doc.text('TOTAL', margin + 16, ty)
  doc.text(formatZMW(sale.total), pageW - margin - 16, ty, { align: 'right' })
  ty += 20

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(51, 65, 85)

  if (typeof options.tender?.cashGiven === 'number') {
    doc.text('Cash given', margin + 16, ty)
    doc.text(formatZMW(options.tender.cashGiven), pageW - margin - 16, ty, {
      align: 'right',
    })
    ty += 18
  }
  if (typeof options.tender?.changeDue === 'number') {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(5, 150, 105)
    doc.text('Change due', margin + 16, ty)
    doc.text(formatZMW(options.tender.changeDue), pageW - margin - 16, ty, {
      align: 'right',
    })
  }

  y += boxH + 36
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(11)
  doc.text(
    'Thank you for shopping with us. This is your official sale receipt.',
    pageW / 2,
    y,
    { align: 'center' },
  )
  y += 20
  doc.setFontSize(9)
  doc.setTextColor(148, 163, 184)
  doc.text('POWERED BY NEXORA', pageW / 2, y, { align: 'center' })

  const filename = `NEXORA-Receipt-${receiptCode(sale)}.pdf`
  const blob = doc.output('blob')
  return { doc, blob, filename }
}

export async function downloadReceiptPdf(
  sale: SaleWithItems,
  options: ReceiptOptions = {},
) {
  const { doc, filename } = await buildReceiptPdf(sale, options)
  doc.save(filename)
  return filename
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

/**
 * Build a premium PDF, share it when the phone supports it,
 * otherwise download the PDF and open WhatsApp with a short note.
 */
export async function sendWhatsAppReceiptPdf(
  sale: SaleWithItems,
  phoneRaw: string,
  options: ReceiptOptions = {},
) {
  const phone = normalizeWhatsAppPhone(phoneRaw)
  if (phone.length < 10) {
    throw new Error('Enter a valid phone number, e.g. 097xxxxxxx')
  }

  const { blob, filename } = await buildReceiptPdf(sale, options)
  const file = new File([blob], filename, { type: 'application/pdf' })
  const name = shopName(options.shop)
  const message = `${name} receipt #${receiptCode(sale)}\nTotal: ${formatZMW(sale.total)}\nPayment: ${paymentLabel(sale.payment_method)}\n\nOfficial PDF receipt attached.`

  const canShareFile =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })

  if (canShareFile) {
    await navigator.share({
      files: [file],
      title: `${name} receipt`,
      text: message,
    })
    return { mode: 'share' as const, filename }
  }

  // Desktop / unsupported share: download PDF, open WhatsApp chat
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)

  const text = encodeURIComponent(
    `${message}\n\n(PDF "${filename}" downloaded — attach it in this chat.)`,
  )
  window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener,noreferrer')
  return { mode: 'download' as const, filename }
}
