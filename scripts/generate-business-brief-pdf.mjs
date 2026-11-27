/**
 * NEXORA for business — short one-pager PDF for owners/managers.
 * Run: node scripts/generate-business-brief-pdf.mjs
 */
import { jsPDF } from 'jspdf'
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const publicDir = join(root, 'public', 'docs')
const distDir = join(root, 'dist', 'docs')
const fileName = 'NEXORA-for-business.pdf'
const publicPath = join(publicDir, fileName)

mkdirSync(publicDir, { recursive: true })

const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
const pageW = doc.internal.pageSize.getWidth()
const pageH = doc.internal.pageSize.getHeight()
const M = 54
const maxW = pageW - M * 2
const CONTENT_BOTTOM = pageH - 48
let y = M

const C = {
  ink: [15, 23, 42],
  soft: [71, 85, 105],
  muted: [148, 163, 184],
  teal: [13, 148, 136],
  royal: [37, 99, 235],
  royalDeep: [30, 64, 175],
  line: [226, 232, 240],
  wash: [240, 253, 250],
  softBlue: [239, 246, 255],
  white: [255, 255, 255],
}

function ensure(need) {
  if (y + need > CONTENT_BOTTOM) {
    doc.addPage()
    y = M
  }
}

function rule() {
  ensure(14)
  doc.setDrawColor(...C.line)
  doc.setLineWidth(0.6)
  doc.line(M, y, pageW - M, y)
  y += 14
}

function h2(text) {
  ensure(28)
  y += 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...C.royalDeep)
  doc.text(text, M, y)
  y += 16
}

function body(text, size = 10) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(size)
  doc.setTextColor(...C.ink)
  const leading = size + 3.2
  const lines = doc.splitTextToSize(text, maxW)
  for (const line of lines) {
    ensure(leading)
    doc.text(line, M, y)
    y += leading
  }
  y += 6
}

function soft(text) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...C.soft)
  const leading = 13
  const lines = doc.splitTextToSize(text, maxW)
  for (const line of lines) {
    ensure(leading)
    doc.text(line, M, y)
    y += leading
  }
  y += 6
}

function bullet(title, text) {
  ensure(28)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...C.ink)
  doc.text(title, M, y)
  const tw = doc.getTextWidth(title + ' ')
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.soft)
  const rest = doc.splitTextToSize(text, maxW - tw)
  if (rest.length) {
    doc.text(rest[0], M + tw, y)
    y += 13.5
    for (let i = 1; i < rest.length; i++) {
      ensure(13.5)
      doc.text(rest[i], M, y)
      y += 13.5
    }
  } else {
    y += 13.5
  }
  y += 3
}

function step(n, text) {
  ensure(16)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...C.teal)
  const label = `${n}.`
  doc.text(label, M, y)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.ink)
  const lines = doc.splitTextToSize(text, maxW - 22)
  doc.text(lines[0], M + 18, y)
  y += 13.5
  for (let i = 1; i < lines.length; i++) {
    ensure(13.5)
    doc.text(lines[i], M + 18, y)
    y += 13.5
  }
  y += 2
}

// ── Cover band ──────────────────────────────────────────────
doc.setFillColor(...C.softBlue)
doc.rect(0, 0, pageW, 108, 'F')
doc.setFillColor(...C.teal)
doc.rect(0, 108, pageW, 3, 'F')

doc.setFont('helvetica', 'bold')
doc.setFontSize(11)
doc.setTextColor(...C.teal)
doc.text('NEXORA', M, 42)

doc.setFont('helvetica', 'bold')
doc.setFontSize(22)
doc.setTextColor(...C.ink)
doc.text('NEXORA for business owners', M, 68)

doc.setFont('helvetica', 'normal')
doc.setFontSize(10.5)
doc.setTextColor(...C.soft)
doc.text('A short introduction to the shop operating system', M, 88)

y = 132

h2('What NEXORA is')
body(
  'NEXORA is a shop operating system. It brings your till, stock, and owner desk into one place so the counter and the back office stay aligned.',
)
body(
  'You sell on Sell. Stock updates as you sell. Owners and managers use Command to see what is moving — and what needs attention. Receipts carry your shop name, not a generic label.',
)

h2('Who it is for')
body(
  'NEXORA is built for busy counters: retail shops, pharmacies, grocery stores, and multi-branch businesses that need the till to work when the day is loud and the network is not always kind.',
)
body(
  'If you run one shop or several, and you care that sales, stock, and staff access stay under control, this is for you.',
)

h2('How it helps')
bullet('Sales and stock stay in sync.', 'When an item leaves the counter, the shelf count moves with it.')
bullet('Receipts with your shop name.', 'Customers see your business on every receipt — phone and address when you add them.')
bullet('Roles for staff.', 'Cashiers can sell. Managers get stock, voids, and discounts only when you allow it.')
bullet('Command for leaks and trust.', 'A clear owner desk for sales, stock pressure, and signals that something may be off.')
bullet('Phone till and offline resilience.', 'Sell from a phone or tablet; the till can keep working when the connection drops.')
bullet('Multi-branch ready.', 'Run more than one location under the same business, with one way of selling and checking in.')

h2('How you use it (day to day)')
step(1, 'Create a shop — Sign up and register your business.')
step(2, 'Get approved — A NEXORA admin reviews and activates the shop before the till goes live.')
step(3, 'Set your name — Put your shop name (and contact details) on receipts in Settings.')
step(4, 'Add products — Build your catalogue so the till knows prices and stock.')
step(5, 'Sell — Open a shift → scan or pick items → take payment → Complete the sale.')
step(6, 'Check Command — See how the day is going and spot issues early.')
step(7, 'Close the shift — End cleanly so cash and sales match what happened on the floor.')
y += 4
soft(
  'Training lives in the product: open How to use anytime for a full walkthrough of the real screens.',
)

rule()
h2('Getting started')
body(
  'Create a shop, sign in when you are ready, or open How to use in the app for the click-by-click guide.',
)
soft('NEXORA — Shop OS for counters that need to move fast and stay honest.')

// Footer
doc.setDrawColor(...C.line)
doc.setLineWidth(0.4)
doc.line(M, pageH - 36, pageW - M, pageH - 36)
doc.setFont('helvetica', 'normal')
doc.setFontSize(8)
doc.setTextColor(...C.muted)
doc.text('NEXORA Shop OS  ·  For business owners', M, pageH - 22)
doc.text('1', pageW - M, pageH - 22, { align: 'right' })

const buf = Buffer.from(doc.output('arraybuffer'))
writeFileSync(publicPath, buf)
console.log('Wrote', publicPath, `(${buf.length} bytes)`)

if (existsSync(join(root, 'dist'))) {
  mkdirSync(distDir, { recursive: true })
  copyFileSync(publicPath, join(distDir, fileName))
  console.log('Copied to', join(distDir, fileName))
}
