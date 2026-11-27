import { formatZMW } from '@/lib/money'
import type { ShopReceiptProfile } from '@/lib/shopProfile'
import type { ReceiptTender, SaleWithItems } from '@/types/database'
import { paymentLabel } from '@/types/database'

export type ReceiptOptions = {
  shop?: ShopReceiptProfile
  tender?: ReceiptTender
  cashierName?: string | null
  branchName?: string | null
}

function shopName(shop?: ShopReceiptProfile) {
  return shop?.name?.trim() || 'Your shop'
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

function changeAmount(sale: SaleWithItems, tender?: ReceiptTender) {
  if (typeof tender?.cashGiven !== 'number') return null
  if (typeof tender.changeDue === 'number') return tender.changeDue
  return Number((tender.cashGiven - sale.total).toFixed(2))
}

export function formatReceiptText(
  sale: SaleWithItems,
  options: ReceiptOptions = {},
) {
  const when = new Date(sale.created_at).toLocaleString()
  const name = shopName(options.shop)
  const lines = [
    name,
    options.shop?.address?.trim() || '',
    options.shop?.phone ? `Tel: ${options.shop.phone}` : '',
    '------------------------------',
    `Receipt: ${receiptCode(sale)}`,
    `Date: ${when}`,
    `Paid: ${paymentLabel(sale.payment_method)}`,
    options.cashierName ? `Cashier: ${options.cashierName}` : '',
    options.branchName ? `Branch: ${options.branchName}` : '',
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
    lines.push(`Cash received: ${formatZMW(options.tender.cashGiven)}`)
    lines.push(`Change given: ${formatZMW(changeAmount(sale, options.tender) ?? 0)}`)
  }
  lines.push('------------------------------')
  lines.push('Thank you for shopping with us!')
  return lines.join('\n')
}

/** Fast print HTML — system fonts only (no network font fetch). */
export function buildReceiptHtml(
  sale: SaleWithItems,
  options: ReceiptOptions = {},
) {
  const when = new Date(sale.created_at).toLocaleString()
  const name = shopName(options.shop)
  const change = changeAmount(sale, options.tender)
  const rows = sale.items
    .map(
      (item) => `
      <tr>
        <td>
          <div class="item">${escapeHtml(item.product_name)}</div>
          <div class="item-meta">${item.quantity} × ${formatZMW(item.unit_price)}</div>
        </td>
        <td class="amount">${formatZMW(item.line_total)}</td>
      </tr>`,
    )
    .join('')

  const contactBits = [
    options.shop?.address?.trim()
      ? escapeHtml(options.shop.address.trim())
      : '',
    options.shop?.phone ? `Tel ${escapeHtml(options.shop.phone)}` : '',
  ].filter(Boolean)

  const staffBits = [
    options.cashierName
      ? `Cashier ${escapeHtml(options.cashierName)}`
      : '',
    options.branchName ? escapeHtml(options.branchName) : '',
  ].filter(Boolean)

  const tenderBlock =
    typeof options.tender?.cashGiven === 'number'
      ? `<div class="tender">
          <div class="tender-title">Cash</div>
          <div class="row"><span>Amount due</span><span>${formatZMW(sale.total)}</span></div>
          <div class="row"><span>Cash received</span><span>${formatZMW(options.tender.cashGiven)}</span></div>
          <div class="row change"><span>Change given</span><span>${formatZMW(change ?? 0)}</span></div>
        </div>`
      : ''

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(name)} · Receipt ${receiptCode(sale)}</title>
  <style>
    :root { --ink:#0f172a; --soft:#64748b; --line:#e2e8f0; --accent:#0f766e; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f1f5f9;
      color: var(--ink);
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      width: 380px; max-width: 100%; margin: 16px auto; background: #fff;
      border: 1px solid var(--line); border-radius: 12px; overflow: hidden;
    }
    .head {
      text-align: center; padding: 22px 20px 16px;
      border-bottom: 2px solid var(--ink);
    }
    .head .eyebrow {
      font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
      color: var(--soft); font-weight: 700; margin: 0 0 8px;
    }
    .head h1 {
      margin: 0; font-size: 22px; line-height: 1.2; font-weight: 800;
      letter-spacing: -0.02em;
    }
    .head .contact {
      margin: 8px 0 0; font-size: 11px; color: var(--soft); line-height: 1.45;
    }
    .meta {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      padding: 14px 18px; font-size: 11px;
    }
    .meta div span { display: block; color: var(--soft); font-size: 9px;
      text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }
    .meta div strong { font-size: 12px; font-weight: 700; }
    .staff {
      padding: 0 18px 12px; font-size: 11px; color: var(--soft); text-align: center;
    }
    .body { padding: 0 18px 20px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 9px 0; border-bottom: 1px dashed var(--line); vertical-align: top; font-size: 12px; }
    td.amount { text-align: right; font-weight: 700; white-space: nowrap; padding-left: 10px; }
    .item { font-weight: 700; }
    .item-meta { color: var(--soft); font-size: 11px; margin-top: 2px; }
    .totals { margin-top: 12px; padding-top: 4px; }
    .row { display: flex; justify-content: space-between; gap: 10px; font-size: 12px; margin: 5px 0; color: #475569; }
    .row.strong { color: var(--ink); font-weight: 800; font-size: 15px; margin-top: 8px;
      padding-top: 8px; border-top: 2px solid var(--ink); }
    .tender {
      margin-top: 12px; border: 1px solid #a7f3d0; background: #ecfdf5;
      border-radius: 10px; padding: 12px;
    }
    .tender-title {
      font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
      font-weight: 800; color: #047857; margin-bottom: 6px;
    }
    .tender .row { color: #065f46; }
    .tender .row.change { font-weight: 800; font-size: 14px; color: #047857; margin-top: 6px; }
    .thanks { margin: 18px 0 0; text-align: center; font-size: 11px; color: var(--soft); }
    .powered { margin: 6px 0 0; text-align: center; font-size: 9px;
      letter-spacing: 0.16em; text-transform: uppercase; color: #94a3b8; }
    @media print {
      body { background: #fff; }
      .sheet { margin: 0; width: 100%; max-width: none; border: none; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      <p class="eyebrow">Sale receipt</p>
      <h1>${escapeHtml(name)}</h1>
      ${
        contactBits.length
          ? `<p class="contact">${contactBits.join('<br/>')}</p>`
          : ''
      }
    </div>
    <div class="meta">
      <div><span>Receipt</span><strong>#${receiptCode(sale)}</strong></div>
      <div><span>Payment</span><strong>${escapeHtml(paymentLabel(sale.payment_method))}</strong></div>
      <div style="grid-column:1/-1"><span>Date</span><strong>${escapeHtml(when)}</strong></div>
    </div>
    ${staffBits.length ? `<p class="staff">${staffBits.join(' · ')}</p>` : ''}
    <div class="body">
      <table>${rows}</table>
      <div class="totals">
        ${
          sale.discount > 0
            ? `<div class="row"><span>Discount</span><span>-${formatZMW(sale.discount)}</span></div>`
            : ''
        }
        <div class="row strong"><span>Total</span><span>${formatZMW(sale.total)}</span></div>
      </div>
      ${tenderBlock}
      <p class="thanks">Thank you for shopping with ${escapeHtml(name)}.</p>
      <p class="powered">Powered by NEXORA</p>
    </div>
  </div>
  <script>window.onload = () => { window.print(); }</script>
</body>
</html>`
}

export function printReceipt(sale: SaleWithItems, options: ReceiptOptions = {}) {
  const html = buildReceiptHtml(sale, options)
  const frame = window.open('', '_blank', 'width=440,height=720')
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
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 48
  const contentW = pageW - margin * 2
  const name = shopName(options.shop)
  const when = new Date(sale.created_at).toLocaleString()
  const change = changeAmount(sale, options.tender)

  // Top accent bar
  doc.setFillColor(15, 118, 110)
  doc.rect(0, 0, pageW, 6, 'F')

  let y = 40
  doc.setTextColor(100, 116, 139)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text('SALE RECEIPT', pageW / 2, y, { align: 'center' })
  y += 22

  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  const nameLines = doc.splitTextToSize(name, contentW)
  doc.text(nameLines, pageW / 2, y, { align: 'center' })
  y += nameLines.length * 24 + 4

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  const contact: string[] = []
  if (options.shop?.address?.trim()) contact.push(options.shop.address.trim())
  if (options.shop?.phone) contact.push(`Tel ${options.shop.phone}`)
  if (contact.length) {
    const contactLines = doc.splitTextToSize(contact.join('  ·  '), contentW)
    doc.text(contactLines, pageW / 2, y, { align: 'center' })
    y += contactLines.length * 13 + 8
  }

  doc.setDrawColor(15, 23, 42)
  doc.setLineWidth(1.2)
  doc.line(margin, y, pageW - margin, y)
  y += 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.text(`Receipt #${receiptCode(sale)}`, margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.text(when, pageW - margin, y, { align: 'right' })
  y += 16
  doc.text(`Payment · ${paymentLabel(sale.payment_method)}`, margin, y)
  y += 14
  const staff = [
    options.cashierName ? `Cashier ${options.cashierName}` : '',
    options.branchName ? options.branchName : '',
  ]
    .filter(Boolean)
    .join('  ·  ')
  if (staff) {
    doc.text(staff, margin, y)
    y += 18
  } else {
    y += 8
  }

  // Table header
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(margin, y - 12, contentW, 24, 4, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(8)
  doc.text('ITEM', margin + 10, y + 2)
  doc.text('QTY', margin + contentW * 0.58, y + 2)
  doc.text('AMOUNT', pageW - margin - 10, y + 2, { align: 'right' })
  y += 24

  doc.setFontSize(11)
  for (const item of sale.items) {
    if (y > 700) {
      doc.addPage()
      y = 56
    }
    const title = doc.splitTextToSize(item.product_name, contentW * 0.52)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
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
    y += Math.max(20, title.length * 13) + 4
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(margin, y - 6, pageW - margin, y - 6)
  }

  y += 14
  const totalsH = 44 + (sale.discount > 0 ? 16 : 0)
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, y, contentW, totalsH, 8, 8, 'FD')

  let ty = y + 18
  if (sale.discount > 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(71, 85, 105)
    doc.text('Discount', margin + 14, ty)
    doc.text(`-${formatZMW(sale.discount)}`, pageW - margin - 14, ty, {
      align: 'right',
    })
    ty += 16
  }
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(13)
  doc.text('TOTAL', margin + 14, ty)
  doc.text(formatZMW(sale.total), pageW - margin - 14, ty, { align: 'right' })
  y += totalsH + 14

  if (typeof options.tender?.cashGiven === 'number') {
    const tenderH = 78
    doc.setFillColor(236, 253, 245)
    doc.setDrawColor(167, 243, 208)
    doc.roundedRect(margin, y, contentW, tenderH, 8, 8, 'FD')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(4, 120, 87)
    doc.text('CASH', margin + 14, y + 18)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(6, 95, 70)
    doc.text('Cash received', margin + 14, y + 38)
    doc.setFont('helvetica', 'bold')
    doc.text(formatZMW(options.tender.cashGiven), pageW - margin - 14, y + 38, {
      align: 'right',
    })
    doc.setFontSize(12)
    doc.setTextColor(4, 120, 87)
    doc.text('Change given', margin + 14, y + 60)
    doc.text(formatZMW(change ?? 0), pageW - margin - 14, y + 60, {
      align: 'right',
    })
    y += tenderH + 24
  } else {
    y += 18
  }

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.setFontSize(10)
  doc.text(`Thank you for shopping with ${name}.`, pageW / 2, y, {
    align: 'center',
  })
  y += 16
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('POWERED BY NEXORA', pageW / 2, y, { align: 'center' })

  const filename = `${name.replace(/[^\w\-]+/g, '_').slice(0, 40)}-Receipt-${receiptCode(sale)}.pdf`
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
