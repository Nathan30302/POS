/**
 * NEXORA Owner Guide PDF — professional illustrated manual (~50 pages).
 * Run: node scripts/generate-owner-guide-pdf.mjs
 *
 * Builds HD JPEGs from public/docs/guide-screens/*.png into guide-screens-pdf/.
 */
import { jsPDF } from 'jspdf'
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  unlinkSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const rawScreensDir = join(root, 'public', 'docs', 'guide-screens')
const screensDir = join(root, 'public', 'docs', 'guide-screens-pdf')
const outPath = join(root, 'docs', 'NEXORA-Owner-Guide.pdf')
const publicPath = join(root, 'public', 'docs', 'NEXORA-Owner-Guide.pdf')

/** Always rebuild HD JPEGs at native resolution, quality 92. */
function rebuildHdScreens() {
  mkdirSync(screensDir, { recursive: true })
  if (!existsSync(rawScreensDir)) return
  for (const file of readdirSync(screensDir)) {
    if (file.endsWith('.jpg')) unlinkSync(join(screensDir, file))
  }
  for (const file of readdirSync(rawScreensDir)) {
    if (!file.endsWith('.png')) continue
    const src = join(rawScreensDir, file)
    const out = join(screensDir, file.replace(/\.png$/i, '.jpg'))
    try {
      execFileSync(
        'sips',
        ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', src, '--out', out],
        { stdio: 'ignore' },
      )
    } catch {
      console.warn('sips failed for', file)
    }
  }
}

rebuildHdScreens()

const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
const pageW = doc.internal.pageSize.getWidth()
const pageH = doc.internal.pageSize.getHeight()
const M = 52
const maxW = pageW - M * 2
const FOOTER_Y = pageH - 28
const CONTENT_BOTTOM = pageH - 52
let y = M
let skipHeaderOnce = false
let runningPart = ''
let runningSection = ''

const C = {
  ink: [15, 23, 42],
  soft: [100, 116, 139],
  muted: [148, 163, 184],
  teal: [13, 148, 136],
  royal: [37, 99, 235],
  royalDeep: [30, 64, 175],
  line: [226, 232, 240],
  wash: [240, 253, 250],
  softBlue: [239, 246, 255],
  amberWash: [255, 251, 235],
  amber: [180, 83, 9],
  white: [255, 255, 255],
  surface: [248, 250, 252],
  card: [255, 255, 255],
}

const imageCache = new Map()
const tocEntries = [] // { title, page, level }

function imgUrl(name) {
  if (imageCache.has(name)) return imageCache.get(name)
  const path = join(screensDir, name)
  if (!existsSync(path)) return null
  const url = `data:image/jpeg;base64,${readFileSync(path).toString('base64')}`
  imageCache.set(name, url)
  return url
}

function pageNum() {
  return doc.getNumberOfPages()
}

function markToc(title, level = 1) {
  tocEntries.push({ title, page: pageNum(), level })
}

function setRunning(part, section = '') {
  runningPart = part
  runningSection = section
  // Refresh header if this page was opened before the label was set
  if (!skipHeaderOnce && doc.getNumberOfPages() > 1) {
    drawHeader()
  }
}

function drawHeader() {
  if (skipHeaderOnce) return
  if (!runningPart) return
  doc.setFillColor(...C.white)
  doc.rect(0, 0, pageW, 36, 'F')
  doc.setDrawColor(...C.line)
  doc.setLineWidth(0.5)
  doc.line(M, 34, pageW - M, 34)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...C.royal)
  doc.text('NEXORA', M, 22)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.muted)
  const right = runningSection
    ? `${runningPart}  ·  ${runningSection}`
    : runningPart
  doc.text(right, pageW - M, 22, { align: 'right' })
}

function drawFooterAll() {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    // Skip cover (page 1) heavy footer
    doc.setDrawColor(...C.line)
    doc.setLineWidth(0.4)
    doc.line(M, FOOTER_Y - 10, pageW - M, FOOTER_Y - 10)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...C.muted)
    if (i === 1) {
      doc.text('NEXORA Shop OS  ·  Owner & Operator Guide', M, FOOTER_Y)
    } else {
      doc.text('NEXORA Shop OS  ·  How to use', M, FOOTER_Y)
      doc.text(`${i}`, pageW - M, FOOTER_Y, { align: 'right' })
    }
  }
}

function ensure(need) {
  if (y + need > CONTENT_BOTTOM) {
    doc.addPage()
    drawHeader()
    y = 52
  }
}

function newPage() {
  doc.addPage()
  drawHeader()
  y = 52
}

function rule() {
  ensure(18)
  doc.setDrawColor(...C.line)
  doc.setLineWidth(0.6)
  doc.line(M, y, pageW - M, y)
  y += 16
}

function h1(text) {
  ensure(40)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...C.ink)
  const lines = doc.splitTextToSize(text, maxW)
  for (const line of lines) {
    ensure(28)
    doc.text(line, M, y)
    y += 26
  }
  y += 8
}

function h2(text) {
  ensure(36)
  y += 4
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...C.royalDeep)
  doc.text(text, M, y)
  y += 18
}

function h3(text) {
  ensure(28)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...C.teal)
  doc.text(text, M, y)
  y += 15
}

function body(text, size = 10) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(size)
  doc.setTextColor(...C.ink)
  const leading = size + 3.5
  const lines = doc.splitTextToSize(text, maxW)
  for (const line of lines) {
    ensure(leading)
    doc.text(line, M, y)
    y += leading
  }
  y += 5
}

function soft(text) {
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9.5)
  doc.setTextColor(...C.soft)
  const lines = doc.splitTextToSize(text, maxW)
  for (const line of lines) {
    ensure(13)
    doc.text(line, M, y)
    y += 13
  }
  y += 4
}

function bullet(text) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...C.ink)
  const lines = doc.splitTextToSize(text, maxW - 18)
  ensure(lines.length * 13 + 2)
  doc.setFillColor(...C.teal)
  doc.circle(M + 4, y - 3, 2.2, 'F')
  doc.text(lines[0], M + 14, y)
  y += 13
  for (let i = 1; i < lines.length; i++) {
    ensure(13)
    doc.text(lines[i], M + 14, y)
    y += 13
  }
}

function numbered(n, text) {
  const lines = doc.splitTextToSize(text, maxW - 28)
  ensure(Math.max(22, lines.length * 13 + 4))
  // Number badge
  doc.setFillColor(...C.softBlue)
  doc.roundedRect(M, y - 11, 18, 18, 4, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...C.royal)
  doc.text(String(n), M + 9, y + 1, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...C.ink)
  doc.text(lines[0], M + 26, y)
  y += 14
  for (let i = 1; i < lines.length; i++) {
    ensure(13)
    doc.text(lines[i], M + 26, y)
    y += 13
  }
  y += 2
}

function callout(text, tone = 'teal') {
  const pad = 12
  const lines = doc.splitTextToSize(text, maxW - pad * 2)
  const boxH = lines.length * 13 + pad * 2
  ensure(boxH + 10)
  if (tone === 'amber') {
    doc.setFillColor(...C.amberWash)
    doc.setDrawColor(...C.amber)
  } else if (tone === 'blue') {
    doc.setFillColor(...C.softBlue)
    doc.setDrawColor(...C.royal)
  } else {
    doc.setFillColor(...C.wash)
    doc.setDrawColor(...C.teal)
  }
  doc.setLineWidth(1)
  doc.roundedRect(M, y - 8, maxW, boxH, 6, 6, 'FD')
  // Left accent
  doc.setFillColor(...(tone === 'amber' ? C.amber : tone === 'blue' ? C.royal : C.teal))
  doc.rect(M, y - 8, 3.5, boxH, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...C.ink)
  let ty = y + 4
  for (const line of lines) {
    doc.text(line, M + pad, ty)
    ty += 13
  }
  y += boxH + 12
}

function labelChip(text) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...C.teal)
  ensure(14)
  doc.text(text.toUpperCase(), M, y)
  y += 14
}

/** Framed screenshot — desktop full width */
function shotDesktop(file, caption) {
  const url = imgUrl(file)
  if (!url) {
    body(`[Missing: ${file}]`)
    return
  }
  const props = doc.getImageProperties(url)
  const framePad = 8
  const imgW = maxW - framePad * 2
  const imgH = Math.min(360, imgW * (props.height / props.width))
  const frameH = imgH + framePad * 2 + 22
  ensure(frameH + 8)
  if (y + frameH > CONTENT_BOTTOM) {
    newPage()
  }
  // Frame
  doc.setFillColor(...C.surface)
  doc.setDrawColor(...C.line)
  doc.setLineWidth(0.8)
  doc.roundedRect(M, y, maxW, frameH, 8, 8, 'FD')
  doc.addImage(url, 'JPEG', M + framePad, y + framePad, imgW, imgH, undefined, 'FAST')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...C.soft)
  doc.text(caption || 'Laptop · real NEXORA screen', M + framePad, y + framePad + imgH + 14)
  y += frameH + 14
}

/** Framed phone screenshot — centered */
function shotPhone(file, caption) {
  const url = imgUrl(file)
  if (!url) {
    body(`[Missing: ${file}]`)
    return
  }
  const props = doc.getImageProperties(url)
  const phoneW = 200
  const phoneH = Math.min(340, phoneW * (props.height / props.width))
  const framePad = 10
  const frameW = phoneW + framePad * 2
  const frameH = phoneH + framePad * 2 + 20
  ensure(frameH + 8)
  if (y + frameH > CONTENT_BOTTOM) newPage()
  const x = M + (maxW - frameW) / 2
  doc.setFillColor(...C.surface)
  doc.setDrawColor(...C.line)
  doc.setLineWidth(0.8)
  doc.roundedRect(x, y, frameW, frameH, 10, 10, 'FD')
  doc.addImage(url, 'JPEG', x + framePad, y + framePad, phoneW, phoneH, undefined, 'FAST')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...C.soft)
  doc.text(caption || 'Phone · real NEXORA screen', pageW / 2, y + framePad + phoneH + 14, {
    align: 'center',
  })
  y += frameH + 14
}

/** Section divider page */
function partDivider(partCode, title, subtitle) {
  doc.addPage()
  skipHeaderOnce = true
  setRunning(partCode, title)
  // Soft top band
  doc.setFillColor(...C.royalDeep)
  doc.rect(0, 0, pageW, pageH, 'F')
  // Accent strip
  doc.setFillColor(...C.teal)
  doc.rect(0, 0, 8, pageH, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(148, 183, 255)
  doc.text(partCode.toUpperCase(), M + 12, 200)
  doc.setFontSize(28)
  doc.setTextColor(...C.white)
  doc.text(title, M + 12, 240)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(191, 219, 254)
  const subLines = doc.splitTextToSize(subtitle, maxW - 20)
  let sy = 270
  for (const line of subLines) {
    doc.text(line, M + 12, sy)
    sy += 18
  }
  skipHeaderOnce = false
  y = M
  markToc(`${partCode} — ${title}`, 0)
}

function wordRow(term, means) {
  ensure(36)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...C.ink)
  doc.text(term, M, y)
  y += 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...C.soft)
  const lines = doc.splitTextToSize(means, maxW)
  for (const line of lines) {
    ensure(12)
    doc.text(line, M, y)
    y += 12
  }
  y += 8
  doc.setDrawColor(...C.line)
  doc.setLineWidth(0.4)
  doc.line(M, y - 4, pageW - M, y - 4)
}

// ——— Content data ———

const GLOSSARY = [
  ['Sell', 'The till / checkout. Add products, take money, finish sales. Most of a cashier’s day happens here.', 'Sidebar · phone bottom bar'],
  ['Opening float', 'Cash already in the drawer before the first customer. Example: K 100 of notes and coins.', 'Sell → shift card'],
  ['Open shift', 'Starts a cash session after you type the opening float. End-of-day count then has a target.', 'Sell'],
  ['Close shift', 'Ends the cash session. Count the drawer and enter that amount. Shorts show on Command.', 'Sell'],
  ['Complete', 'Finish the sale: payment recorded, stock drops, receipt created with your shop name.', 'Sell · cart'],
  ['Exact / Cash Received', 'Exact = paid the total with no change. Cash Received = notes handed over (change on receipt).', 'Sell · cart'],
  ['Discount', 'Reduce the price. Large discounts need permission and a written reason.', 'Sell · cart'],
  ['Void', 'Cancel a finished sale and put stock back. Always write a reason. May need Manager PIN.', 'Ledger'],
  ['Manager PIN', 'Short code only managers know — approves voids or large discounts.', 'When asked'],
  ['Command', 'Owner desk: revenue, Money leaks, Trust, branch comparison. Check once a day.', 'Sidebar'],
  ['Revenue MTD', 'Month-to-date sales money — from the 1st until now.', 'Command'],
  ['Gross profit MTD', 'Sales minus cost of goods this month — before rent and other expenses.', 'Command'],
  ['Live today', 'Sales and tickets since midnight today only.', 'Command'],
  ['Money leaks', 'Warnings that profit is escaping: below-cost sales, voids, discounts, shrink.', 'Command · Pulse'],
  ['Critical', 'Highest urgency leak — act today (example: selling below cost).', 'Money leaks'],
  ['Trust', 'Flags cashiers or branches with unusual void/discount patterns — soft theft alarm.', 'Command'],
  ['Void %', 'Share of sales cancelled. High % for one person vs others needs a look.', 'Command · Trust'],
  ['Pulse', 'Advisor: health score, reorder ideas, Ask questions about your shop.', 'Sidebar'],
  ['Ledger', 'Past sales diary — search, reprint, or void with a reason.', 'Sidebar'],
  ['Receive', 'Add stock when a delivery arrives so the computer matches the shelf.', 'Inventory'],
  ['Low stock', 'Quantity at or under your warning level — time to reorder.', 'Inventory'],
  ['Queued / offline', 'Sale saved on the device when Wi‑Fi died. Syncs later — do not re-type it.', 'Sell'],
  ['Audit', 'Who did what, when — voids, receives, PIN attempts. Hard to erase.', 'Sidebar'],
  ['Credit sale', 'Customer pays later. Needs permission and a customer with a credit limit.', 'Sell'],
  ['Branch', 'One physical shop. “All branches” is Head Office view.', 'Settings · account'],
  ['Role / Permission', 'Role = job title. Permission = specific power (sell, void, discounts…).', 'Team'],
]

const MODULES = [
  {
    id: 'sell',
    title: 'Sell (the till)',
    who: 'Cashiers · Owners',
    purpose:
      'Add products, take money, finish the sale. Prices come from the server — cashiers cannot invent a cheaper price at the till.',
    desktop: 'sell-desktop.jpg',
    phone: 'sell-phone.jpg',
    words: [
      ['No open shift / CLOSED', 'Cash session not started yet.'],
      ['Opening float', 'Starting cash in the drawer.'],
      ['Open shift', 'Starts tracking this cash session.'],
      ['Link phone / QR', 'Phone opens Sell for camera scanning.'],
      ['Subtotal / Discount / Total', 'Line prices, reduction, amount to collect.'],
      ['Cash Received / Exact', 'Notes given · or paid exactly.'],
      ['Complete', 'Finish sale and create receipt.'],
      ['Cash / MoMo / Card / Credit', 'How the customer is paying.'],
    ],
    clicks: [
      'Sidebar → Sell (highlighted when active). On phones, use the bottom bar.',
      'If closed: type Opening float → tap Open shift.',
      'Search box → scan barcode or type name → Enter. Or tap a product tile (hold for +5).',
      'Optional: type customer phone for loyalty or credit.',
      'Cart → choose Cash, MoMo, Card, Credit, or Other.',
      'If Cash: tap Exact or type Cash Received.',
      'Tap Complete → print or share the receipt (your shop name on top).',
      'If Wi‑Fi dies: let the sale queue. Do not re-type it when the network returns.',
    ],
    example:
      '3 pens in cart → Cash → Exact → Complete → stock drops, receipt shows your shop name.',
    tips: [
      'Big discounts need permission + a written reason.',
      'Never invent prices at the till — change them in Inventory.',
    ],
    theft: [
      'Skipping Open shift so drawer cash is never checked',
      'Heavy discounts without reasons',
    ],
  },
  {
    id: 'command',
    title: 'Command (owner desk)',
    who: 'Owners · Admins',
    purpose:
      'See if the shop is healthy: money in, leaks out, who looks risky. Check once every day.',
    desktop: 'command-desktop.jpg',
    phone: 'command-phone.jpg',
    words: [
      ['Revenue MTD', 'Sales money so far this month.'],
      ['Gross profit MTD', 'Sales minus cost of goods.'],
      ['Live today', 'Only today’s sales.'],
      ['Money leaks / Critical', 'Profit risks — Critical = act today.'],
      ['Trust', 'Odd void or discount patterns.'],
      ['Void % / Discount %', 'Cancellation and price-cut share.'],
    ],
    clicks: [
      'Sidebar → Command.',
      'Choose Today / 7 days / 30 days.',
      'Read the four KPI cards at the top.',
      'Open Money leaks → any Critical card.',
      'Open Trust → tap a flagged cashier → review Ledger.',
      'Multi-branch: compare Main vs other branch cards.',
    ],
    example:
      'Critical “Selling below cost — ALOA (−25%)” → fix sell price or find who discounted.',
    tips: ['Make Command a daily habit, not a month-end surprise.'],
    theft: [
      'Critical selling below cost',
      'One cashier always highest void %',
      'Shifts closing short on cash',
    ],
  },
  {
    id: 'inventory',
    title: 'Inventory',
    who: 'Stock staff · Managers',
    purpose: 'What is on the shelf in the computer. Receive deliveries and fix low stock.',
    desktop: 'inventory-desktop.jpg',
    phone: 'inventory-phone.jpg',
    words: [
      ['Stock at cost / selling', 'Value at purchase cost vs list price.'],
      ['SKU', 'Your internal product code.'],
      ['Receive', 'Add stock from a delivery.'],
      ['Low stock', 'At or under warning level.'],
      ['History', 'Every receive and sale movement.'],
    ],
    clicks: [
      'Sidebar → Inventory → search name, barcode, or SKU.',
      'Or Add product → name, sell price, cost, barcode → save.',
      'Open product → Receive → quantity → confirm.',
      'Check low-stock filter; use Pulse for reorder ideas.',
    ],
    example: 'Receive 24 pens → stock rises → History shows RECEIVE.',
    tips: ['Wrong sell price here becomes a Money leak on Command.'],
    theft: ['Receives with no delivery story', 'Stock falling with few sales'],
  },
  {
    id: 'ledger',
    title: 'Ledger',
    who: 'Managers · Owners',
    purpose: 'Find an old sale, reprint a receipt, or void a mistake with a reason.',
    desktop: 'ledger-desktop.jpg',
    phone: 'ledger-phone.jpg',
    words: [
      ['Today / 7 / 30 days', 'Which sales appear.'],
      ['Search', 'Find by cashier, note, or amount.'],
      ['Void', 'Cancel a finished sale.'],
      ['Manager PIN', 'Approval for sensitive voids.'],
      ['Reprint', 'Another copy of the receipt.'],
    ],
    clicks: [
      'Sidebar → Ledger → date chip (start with Today).',
      'Optional: search cashier or filter payment type.',
      'Tap a sale → review lines → Reprint if needed.',
      'If wrong: Void → clear reason → confirm (+ PIN if asked).',
    ],
    example: 'Lost receipt → Ledger → Today → open sale → Reprint.',
    tips: ['Never void “to fix stock” without a real mistake — Audit keeps the trail.'],
    theft: ['Many voids by one cashier the same afternoon', 'Void right after a large cash sale'],
  },
  {
    id: 'pulse',
    title: 'Pulse',
    who: 'Owners · Managers',
    purpose: 'Early warnings and advice — health, reorders, ask-your-shop questions.',
    desktop: 'pulse-desktop.jpg',
    phone: 'pulse-phone.jpg',
    words: [
      ['Health', 'Overall shop condition.'],
      ['Refresh Pulse', 'Reload latest signals.'],
      ['Reorder', 'What looks like it needs buying.'],
      ['Ask', 'Plain-English questions about your data.'],
    ],
    clicks: [
      'Sidebar → Pulse → Refresh Pulse.',
      'Read health and leak cards.',
      'Open reorder suggestions before Purchasing.',
      'Try Ask: “What sold best this week?”',
    ],
    example: 'Reorder lists pens → you buy with a clear list instead of guessing.',
    tips: ['Pulse is advice — verify on Inventory and Command.'],
    theft: [],
  },
  {
    id: 'customers',
    title: 'Customers',
    who: 'Cashiers · Managers',
    purpose: 'Save regulars for loyalty and credit. Look up by phone on Sell before Complete.',
    desktop: 'customers-desktop.jpg',
    phone: 'customers-phone.jpg',
    words: [
      ['Credit outstanding', 'Total still owed.'],
      ['Overdue', 'Unpaid longer than your rule.'],
      ['Loyalty points', 'Rewards for repeat buyers.'],
      ['Credit limit', 'Maximum the customer may owe.'],
    ],
    clicks: [
      'Customers → Add customer → name + phone → save.',
      'Set credit limit only if you sell on account.',
      'On Sell: type that phone before Complete.',
      'Weekly: check Overdue → collect or pause credit.',
    ],
    example: 'Regular’s phone on Sell → loyalty applies → Complete.',
    tips: ['Do not keep raising credit if overdue is climbing.'],
    theft: ['Credit sales to fake phones'],
  },
  {
    id: 'team',
    title: 'Team',
    who: 'Owners · Admins',
    purpose: 'Who can sign in and what they may do. Least privilege keeps the shop honest.',
    desktop: 'team-desktop.jpg',
    phone: 'team-phone.jpg',
    words: [
      ['Role', 'Owner, Admin, Cashier — default powers.'],
      ['Permission', 'Specific power: sell, ledger, discounts…'],
      ['Manager PIN', 'Code for voids / big discounts.'],
      ['Invite', 'Create login access for staff.'],
    ],
    clicks: [
      'Team → invite staff with their own email.',
      'Pick role → review permissions (cashiers often Sell only).',
      'Set or rotate Manager PIN.',
      'When someone leaves: remove access the same day.',
    ],
    example: 'New cashier: Sell only — cannot approve their own voids.',
    tips: ['Shared logins destroy Trust — one person, one account.'],
    theft: ['Cashiers with void + discount + receive all at once'],
  },
  {
    id: 'expenses',
    title: 'Expenses',
    who: 'Owners · Accountants',
    purpose: 'Record money that left the shop that was not a customer refund.',
    desktop: 'expenses-desktop.jpg',
    phone: 'expenses-phone.jpg',
    words: [
      ['Record expense', 'Add a cost entry.'],
      ['Category', 'Rent, transport, airtime, wages…'],
      ['Export CSV', 'File for your accountant.'],
    ],
    clicks: [
      'Expenses → Record expense → amount, category, note → save.',
      'Optional: Export CSV.',
    ],
    example: 'Transport K 150 · category Transport · note “Collect pens.”',
    tips: ['Expenses do not replace Inventory Receive.'],
    theft: ['Repeated vague expenses by one person'],
  },
  {
    id: 'audit',
    title: 'Audit',
    who: 'Owners · Admins',
    purpose: 'The diary: who voided, received stock, or tried a PIN. Start here when Trust looks strange.',
    desktop: 'audit-desktop.jpg',
    phone: 'audit-phone.jpg',
    words: [
      ['Event / action', 'One logged thing that happened.'],
      ['Actor', 'Which signed-in user did it.'],
      ['Time', 'When — match to the dispute window.'],
    ],
    clicks: [
      'From Trust → Audit → scroll to the time of the problem.',
      'Note actor and action → open related Ledger sale.',
      'If offline day: also check Conflicts.',
    ],
    example:
      'Trust flags Grace → Audit shows three voids 14:00–14:20 → review with Ledger.',
    tips: ['Do not give every cashier Audit permission.'],
    theft: ['Void clusters', 'PIN failures then a successful void'],
  },
  {
    id: 'settings',
    title: 'Settings',
    who: 'Owners · Admins',
    purpose: 'Shop name on receipts, MoMo numbers, branches, and How to use.',
    desktop: 'settings-desktop.jpg',
    phone: 'settings-phone.jpg',
    words: [
      ['Business name', 'Prints on every receipt.'],
      ['MoMo numbers', 'Shown on Sell for mobile money.'],
      ['Branches', 'Other physical locations.'],
      ['How to use', 'In-app guide with voice.'],
    ],
    clicks: [
      'Settings → edit Business name → Save → test a receipt.',
      'Add MoMo numbers if you use mobile money.',
      'Create Branches if you have more than one counter.',
      'Open How to use to train staff.',
    ],
    example: 'Rename to “Blessing Pharmacy” → next receipt shows that name.',
    tips: ['Demo receipts show the demo shop name — create YOUR shop for real use.'],
    theft: [],
  },
]

// ===================== BUILD =====================

// —— Cover ——
doc.setFillColor(...C.royalDeep)
doc.rect(0, 0, pageW, pageH, 'F')
doc.setFillColor(...C.teal)
doc.rect(0, 0, 10, pageH, 'F')
doc.setFillColor(15, 23, 42)
doc.rect(0, pageH - 140, pageW, 140, 'F')

doc.setFont('helvetica', 'bold')
doc.setFontSize(12)
doc.setTextColor(147, 197, 253)
doc.text('NEXORA SHOP OS', M + 8, 160)
doc.setFontSize(36)
doc.setTextColor(...C.white)
doc.text('Owner & Operator', M + 8, 210)
doc.text('Guide', M + 8, 252)
doc.setFont('helvetica', 'normal')
doc.setFontSize(12)
doc.setTextColor(191, 219, 254)
doc.text('Daily clicks  ·  Word meanings  ·  HD screens  ·  Theft signals', M + 8, 290)

doc.setFontSize(10)
doc.setTextColor(148, 163, 184)
doc.text('For shop owners, managers, and cashiers', M + 8, pageH - 90)
doc.text(`Illustrated edition  ·  ${new Date().toISOString().slice(0, 10)}`, M + 8, pageH - 70)
doc.text('Also in-app:  /guide   or   Settings → How to use', M + 8, pageH - 50)

// —— How to read ——
setRunning('Front matter', 'How to read')
newPage()
markToc('How to read this guide', 1)
labelChip('Welcome')
h1('How to read this guide')
body(
  'This manual is designed to sit next to the till or on a manager’s phone. It uses real pictures of NEXORA, plain word meanings, and numbered clicks — not vague overviews.',
)
h3('Four parts')
bullet('Part A — Big idea and one full day, click by click.')
bullet('Part B — Dictionary of words you see on screen.')
bullet('Part C — Every main screen: HD laptop + phone, words, steps, examples.')
bullet('Part D — Accounts, security, training script, FAQ, checklists.')
h3('Train someone today')
numbered(1, 'Read Part A together (10 minutes).')
numbered(2, 'Open Settings → How to use → play Voice on “Your day”.')
numbered(3, 'Do one Open shift → Complete → Close shift on Sell.')
numbered(4, 'Show Command → Money leaks once so they respect the diary.')
callout(
  'Screenshots in this PDF are real NEXORA captures at full resolution. Your numbers will differ — the buttons and words are the same.',
  'blue',
)

// —— TOC (pages filled in later visually as list without exact nums first; we'll print with recorded pages after a second approach)
// For single-pass: write TOC now with placeholders, OR build TOC page at end by inserting.
// Simpler professional approach: write TOC after content using a reserved page — jsPDF can't easily insert.
// We'll write TOC now listing sections (no page nums), then a "quick find" at end.
// Better: record tocEntries as we go, then add TOC as page 3 by building content first into a temp... 
// Practical approach: put Contents after how-to-read with section names only; page numbers in running headers.

setRunning('Front matter', 'Contents')
newPage()
markToc('Contents', 1)
labelChip('Contents')
h1('Contents')
const tocPreview = [
  ['Part A', 'Big idea & your day (read first)'],
  ['', 'A1 The big idea'],
  ['', 'A2 Your day — start to finish'],
  ['', 'A3 Morning, midday, evening'],
  ['Part B', 'Word meanings (appendix-style dictionary)'],
  ['Part C', 'Screens in learning order'],
  ['', 'C1 Sell · C2 Inventory · C3 Ledger · C4 Command'],
  ['', 'C5 Pulse · C6 Customers · C7 Team · C8 Expenses'],
  ['', 'C9 Audit · C10 Settings'],
  ['Part D', 'Accounts, security, training, FAQ'],
  ['', 'D1–D2 Accounts & signup'],
  ['', 'D3–D4 Shop types & security'],
  ['', 'D5 Training · D6 FAQ · D7 Reviews · D8 Checklist'],
]
for (const [left, right] of tocPreview) {
  ensure(22)
  if (left) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...C.royalDeep)
    doc.text(left, M, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...C.ink)
    doc.text(right, M + 70, y)
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...C.soft)
    doc.text(right, M + 70, y)
  }
  y += 20
}
y += 8
callout('Tip: use the PDF search (Ctrl/Cmd + F) for words like “Open shift” or “Void”.', 'blue')

// ——— PART A ———
partDivider('Part A', 'Big idea & your day', 'What NEXORA is, and exactly what to click from morning open to evening close.')

newPage()
setRunning('Part A', 'The big idea')
markToc('A1. The big idea', 1)
labelChip('A1')
h1('The big idea')
body(
  'Imagine your shop as a small house. NEXORA is not only a cash register — it is a shop operating system.',
)
const rooms = [
  ['Sell', 'Front door — customers pay here'],
  ['Inventory', 'Storeroom on screen'],
  ['Command', 'Owner’s desk — “how is my shop?”'],
  ['Pulse', 'Wise friend — what to worry about'],
  ['Ledger', 'Sales diary — reprint or void'],
  ['Audit / Trust', 'Diary that is hard to erase'],
  ['Team', 'Who has the keys'],
]
for (const [name, meaning] of rooms) {
  ensure(24)
  doc.setFillColor(...C.surface)
  doc.roundedRect(M, y - 12, maxW, 22, 4, 4, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...C.ink)
  doc.text(name, M + 10, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.soft)
  doc.text(meaning, M + 130, y)
  y += 26
}
y += 6
callout(
  'A basic POS often only remembers “someone paid.” NEXORA also remembers who, when, why (voids and big discounts), and what that means for your money.',
)

newPage()
setRunning('Part A', 'Your day')
markToc('A2. Your day — start to finish', 1)
labelChip('A2')
h1('Your day — start to finish')
body('Follow these numbers on a normal day. Every new cashier should master this before Inventory or Pulse.')

h3('Morning')
numbered(1, 'Login → email + password → Sign in.')
numbered(2, 'Tap Sell (sidebar on laptop, bottom bar on phone).')
numbered(3, 'If you use cash: type Opening float (example 100) → tap Open shift.')
numbered(4, 'Owner (optional): Command → glance at Money leaks from yesterday.')

h3('During the day')
numbered(5, 'Scan or search a product → it appears in the cart.')
numbered(6, 'Tap Cash (or MoMo / Card / Credit) → tap Complete.')
numbered(7, 'Show the receipt with YOUR shop name.')
numbered(8, 'If Wi‑Fi dies: sale can queue. Do not type the same sale again when it syncs.')

h3('Problems & evening')
numbered(9, 'Wrong sale? Ledger → open sale → Void → write a reason (+ PIN if asked).')
numbered(10, 'Sell → Close shift → enter counted cash.')
numbered(11, 'Owner: Command → Money leaks / Trust.')

callout(
  'Opening float = cash in the drawer before the first customer. Open shift = start the session. Close shift = end-of-day count vs expected cash.',
)

newPage()
setRunning('Part A', 'Day detail')
markToc('A3. Morning, midday, evening', 1)
labelChip('A3')
h1('Morning, midday, evening')
h3('Morning habits')
bullet('Sign in with YOUR account — never share the owner password.')
bullet('Count the float yourself before typing it.')
bullet('Do not type a fake float or sell while CLOSED “to open later.”')
h3('Midday — speed & offline')
bullet('USB barcode gun → Sell search → Enter after a full code.')
bullet('Hold a catalogue tile for +5. Link a phone via QR to scan while another takes cash.')
bullet('Offline: queue the sale. Never write it on paper AND type it again later.')
h3('Evening close')
numbered(1, 'Finish open carts. Count drawer: notes + coins.')
numbered(2, 'Close shift → enter counted amount honestly.')
numbered(3, 'If short: note it — do not “fix” with random voids.')
numbered(4, 'Owner: Command → Trust / leaks. Sign out on shared devices.')
callout(
  'Short closes are a signal. Investigate with Ledger + Audit — never hide them.',
  'amber',
)

// ——— PART B ———
partDivider(
  'Part B',
  'Word meanings',
  'When you see these labels in the app, this is what they mean. Read a page whenever a new word confuses you.',
)

newPage()
setRunning('Part B', 'Dictionary')
markToc('B. Dictionary', 1)
labelChip('Dictionary')
h1('What the words mean')
body('Plain English for the labels on Sell, Command, Ledger, and the rest.')

for (let i = 0; i < GLOSSARY.length; i++) {
  const [term, means, where] = GLOSSARY[i]
  if (i > 0 && i % 9 === 0) {
    newPage()
    setRunning('Part B', 'Dictionary')
    labelChip('Dictionary · continued')
    h1('What the words mean')
  }
  ensure(48)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...C.ink)
  doc.text(term, M, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...C.teal)
  doc.text(where, pageW - M, y, { align: 'right' })
  y += 13
  doc.setFontSize(9.5)
  doc.setTextColor(...C.soft)
  const lines = doc.splitTextToSize(means, maxW)
  for (const line of lines) {
    ensure(12)
    doc.text(line, M, y)
    y += 12
  }
  y += 10
  doc.setDrawColor(...C.line)
  doc.setLineWidth(0.4)
  doc.line(M, y - 5, pageW - M, y - 5)
}

// ——— PART C ———
partDivider(
  'Part C',
  'Screens',
  'Each module: what it is for, HD laptop screen, phone screen, words on screen, numbered clicks, example, and theft signals.',
)

newPage()
setRunning('Part C', 'Overview')
markToc('C. Screens overview', 1)
labelChip('Part C')
h1('How to use each screen chapter')
body(
  'Every chapter follows the same layout so you can skim fast:',
)
numbered(1, 'Purpose — who it is for and what job it does.')
numbered(2, 'Laptop photo — full HD capture of the real UI.')
numbered(3, 'Phone photo — same screen on a handset.')
numbered(4, 'Words on screen — labels → plain meanings.')
numbered(5, 'What to click — numbered steps for a first week.')
callout('Your products and numbers will look different. The buttons and words match production NEXORA.', 'blue')

const MODULE_ORDER = [
  'sell',
  'inventory',
  'ledger',
  'command',
  'pulse',
  'customers',
  'expenses',
  'team',
  'audit',
  'settings',
]
const ORDERED_MODULES = [
  ...MODULE_ORDER.map((id) => MODULES.find((m) => m.id === id)).filter(Boolean),
  ...MODULES.filter((m) => !MODULE_ORDER.includes(m.id)),
]

for (const mod of ORDERED_MODULES) {
  // Intro + desktop
  newPage()
  setRunning('Part C', mod.title)
  markToc(`C · ${mod.title}`, 1)
  labelChip(mod.who)
  h1(mod.title)
  body(mod.purpose)
  shotDesktop(mod.desktop, `Laptop · ${mod.title}`)

  // Phone + words
  newPage()
  setRunning('Part C', mod.title)
  labelChip(mod.title)
  h2('Phone screen')
  shotPhone(mod.phone, `Phone · ${mod.title}`)
  h2('Words on this screen')
  for (const [w, m] of mod.words) {
    wordRow(w, m)
  }

  // Clicks
  newPage()
  setRunning('Part C', mod.title)
  labelChip(mod.title)
  h1('What to click')
  body('Do these in order the first week. After that, muscle memory takes over.')
  mod.clicks.forEach((c, i) => numbered(i + 1, c))
  callout(`Example: ${mod.example}`)
  if (mod.tips?.length) {
    h3('Tips')
    for (const t of mod.tips) bullet(t)
  }
  if (mod.theft?.length) {
    h3('Something is off')
    callout(mod.theft.map((t) => `• ${t}`).join('   '), 'amber')
  }
}

// ——— PART D ———
partDivider(
  'Part D',
  'Accounts & security',
  'Signup, approval, shop types, three locks against theft, training, FAQ, and checklists.',
)

newPage()
setRunning('Part D', 'Accounts')
markToc('D1. Two kinds of accounts', 1)
labelChip('D1')
h1('Two kinds of accounts')
h3('Shop account')
body(
  'Owner, cashier, or manager. After platform approval you run THAT shop only — Sell, stock, customers.',
)
h3('Platform admin')
body(
  'NEXORA staff. Land on /platform. Approve or reject shops, suspend, change plans, record payments.',
)
callout(
  'Picture: shop owners live in one house. Platform admins are the city office that stamps permits — and can lock a house if needed.',
  'blue',
)

newPage()
setRunning('Part D', 'Signup')
markToc('D2. Signup, approval, login', 1)
labelChip('D2')
h1('Signup, approval, and login')
numbered(1, 'Create shop (/signup) — shop name prints on receipts.')
numbered(2, 'Submit → PENDING APPROVAL (you are not logged in yet).')
numbered(3, 'Platform admin Approves → TRIAL → you can Sign in.')
numbered(4, 'Or Reject → CANCELLED.')
numbered(5, 'After approval: /login with the same email and password.')
callout(
  'Always create YOUR shop for real use. Demo login is only for trying the product — demo receipts show the demo shop name.',
)

newPage()
setRunning('Part D', 'Shop types')
markToc('D3. Shop types', 1)
labelChip('D3')
h1('Shop types & receipts')
bullet('Retail / stationery — lean menus: Sell, stock, customers, Pulse.')
bullet('Pharmacy — lots, expiry, FEFO, Rx notes on Sell.')
bullet('Grocery — perishable lots & expiry without full pharmacy Rx.')
body('Shop type is chosen at signup and can be adjusted in Settings.')
h3('Whose name is on the receipt?')
bullet('Settings → Business profile → Business name.')
bullet('“Mama Grace Grocery” at signup → that name on every receipt.')
bullet('Demo account shows the demo shop name — expected for demo only.')

newPage()
setRunning('Part D', 'Security')
markToc('D4. Three security locks', 1)
labelChip('D4')
h1('Security — three locks')
body('NEXORA cannot stop every thief alone. It makes theft louder and slower.')
h3('1 · Permission')
body('Not everyone can void, discount heavily, or open Audit. Set this on Team. Cashiers often need Sell only.')
h3('2 · Reason')
body('Voids and large discounts leave a sentence in the diary. “Mistake” × 40 is itself a signal.')
h3('3 · Pattern')
body('Trust and Money leaks notice odd rates. Tap through to Ledger and Audit.')
callout('Shared logins destroy all three locks. Every person needs their own email and password.', 'amber')

h3('Investigation playbook')
numbered(1, 'Open the Critical or Trust card — note person, SKU, or branch.')
numbered(2, 'Ledger → that cashier / day → every void and discount.')
numbered(3, 'Audit → same time window → actor and PIN failures.')
numbered(4, 'Inventory History on affected SKUs.')
numbered(5, 'Talk with facts. Adjust permissions if patterns repeat.')

newPage()
setRunning('Part D', 'Training')
markToc('D5. Train a cashier', 1)
labelChip('D5')
h1('Train a cashier in 10 minutes')
numbered(1, 'How to use → “Your day” → play Voice.')
numbered(2, 'Sign in with their Team account (Sell permission).')
numbered(3, 'Opening float → Open shift.')
numbered(4, 'Two items → Exact → Complete → show receipt.')
numbered(5, 'Show Command Money leaks once.')
numbered(6, 'Explain Void needs a reason + maybe PIN.')
numbered(7, 'Rule: never void without calling the owner — the system remembers.')
numbered(8, 'Practice Close shift with a counted amount.')

h3('Training checklist')
bullet('[ ] Finds Sell on laptop and phone')
bullet('[ ] Explains Opening float in their own words')
bullet('[ ] Opens shift without help')
bullet('[ ] Completes cash and one other tender')
bullet('[ ] Knows offline = queue, do not double-enter')
bullet('[ ] Knows Void needs reason')
bullet('[ ] Closes shift and counts drawer')

newPage()
setRunning('Part D', 'FAQ')
markToc('D6. FAQ', 1)
labelChip('D6')
h1('FAQ & troubleshooting')
h3('Login says pending / blocked')
body('Shop not approved yet, or suspended. Wait for platform Approve — do not keep creating accounts.')
h3('Wrong shop name on receipt')
body('Demo account, or Settings → Business name is wrong. Fix → Save → test Complete.')
h3('Complete disabled')
body('Cart is empty. Scan or tap a product first.')
h3('Cannot void')
body('Missing permission, or Manager PIN required. Ask the owner.')
h3('Critical selling below cost')
body('Sell price under healthy margin. Fix in Inventory or find who discounted.')
h3('Queued offline sale')
body('When online, it syncs. Never re-type it. Check Conflicts if two devices fought over stock.')
h3('Voice guide silent')
body('Use a modern browser, unmute the device, tap Voice guide again.')

newPage()
setRunning('Part D', 'Reviews')
markToc('D7. Owner reviews', 1)
labelChip('D7')
h1('Owner reviews')
h3('Daily — 2 minutes')
bullet('Command → Live today.')
bullet('Any new Critical? Open it.')
bullet('Any Trust flag from yesterday? Note the name.')
h3('Weekly — 30 minutes')
numbered(1, 'Command → 7 days → KPIs and Money leaks.')
numbered(2, 'Every Critical from the week — fixed or still open?')
numbered(3, 'Trust → repeat names → Ledger + Audit.')
numbered(4, 'Inventory low stock + odd History receives.')
numbered(5, 'Customers overdue → collect or pause.')
numbered(6, 'Team → remove leavers; confirm least privilege.')
numbered(7, 'Close-shift shorts — pattern by day or cashier?')
callout('Thirty honest minutes a week beats month-end panic.', 'blue')

newPage()
setRunning('Part D', 'Checklist')
markToc('D8. Final checklist', 1)
labelChip('D8')
h1('Final checklist')
bullet('Signup = PENDING; login blocked until Approve')
bullet('Approve → TRIAL; receipt shows shop name')
bullet('Sell: Open shift → Complete → stock drops')
bullet('Void always has a reason (+ PIN when required)')
bullet('Close shift every evening')
bullet('Command shows leaks / Trust; Audit has the diary')
bullet('Offline queue — do not re-type the sale')
bullet('Individual logins — no shared owner password on the till')
bullet('Cashiers trained on Part A + Sell first')

y += 10
h2('Till quick reference')
bullet('Sell: Float → Open shift → scan → tender → Complete')
bullet('Mistake: Ledger → sale → Void → reason')
bullet('Delivery: Inventory → product → Receive')
bullet('Alarm: Command → Critical / Trust → Audit')
bullet('End of day: Close shift → count → owner glance')

rule()
soft('NEXORA Shop OS — sell fast, see clearly, keep the shop honest.')
soft('Voice + live pictures in the app: /guide or Settings → How to use.')

// Closing page
newPage()
setRunning('Part D', 'Close')
labelChip('Thank you')
h1('Keep this guide close')
body(
  'You now have the same map your staff see in the app. The length is intentional — nothing important hides behind a vague “see Settings.”',
)
body('If you only remember four habits:')
numbered(1, 'Individual logins — always.')
numbered(2, 'Open shift / Close shift — every cash day.')
numbered(3, 'Voids need reasons — read Trust weekly.')
numbered(4, 'Business name correct in Settings — every receipt is your billboard.')
callout(
  'For spoken walkthroughs beside this PDF, open /guide or Settings → How to use on a phone.',
  'blue',
)
y += 20
doc.setFont('helvetica', 'bold')
doc.setFontSize(12)
doc.setTextColor(...C.royalDeep)
doc.text('NEXORA Shop OS', M, y)
y += 16
doc.setFont('helvetica', 'normal')
doc.setFontSize(10)
doc.setTextColor(...C.soft)
doc.text('Sell fast. See clearly. Keep the shop honest.', M, y)

drawFooterAll()

mkdirSync(dirname(outPath), { recursive: true })
mkdirSync(dirname(publicPath), { recursive: true })
const buf = Buffer.from(doc.output('arraybuffer'))
writeFileSync(outPath, buf)
writeFileSync(publicPath, buf)
const pages = doc.getNumberOfPages()
console.log('Wrote', outPath, `(${(buf.length / 1024 / 1024).toFixed(2)} MB, ${pages} pages)`)
console.log('Wrote', publicPath)
console.log('TOC entries:', tocEntries.length)
