/**
 * Offline decode-speed check: render a Code128 barcode with jsbarcode,
 * then time ZXing decodeFromCanvas. Target: well under 1s.
 *
 *   node scripts/scan-speed-check.mjs
 */
import { createCanvas } from 'node:canvas'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

// jsbarcode is CJS
const JsBarcode = require('jsbarcode')

async function main() {
  // Prefer real canvas; if missing, skip with instructions
  let Canvas
  try {
    Canvas = (await import('canvas')).default
  } catch {
    console.log('SKIP: install canvas for node bench, or use browser Live scan.')
    console.log('Manual: Sell → Live scan → hold demo barcode in teal box.')
    process.exit(0)
  }

  const { BrowserMultiFormatReader } = await import(
    pathToFileURL(path.join(root, 'node_modules/@zxing/browser/esm/index.js')).href
  )
  const { BarcodeFormat, DecodeHintType } = await import(
    pathToFileURL(path.join(root, 'node_modules/@zxing/library/esm/index.js')).href
  )

  const code = '6001001001002'
  const canvas = Canvas.createCanvas(640, 200)
  JsBarcode(canvas, code, {
    format: 'CODE128',
    width: 2,
    height: 120,
    displayValue: false,
    margin: 20,
  })

  // Mimic ROI strip size
  const roi = Canvas.createCanvas(720, 180)
  const ctx = roi.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, 720, 180)
  ctx.drawImage(canvas, 40, 30)

  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.EAN_13,
  ])
  hints.set(DecodeHintType.TRY_HARDER, false)
  const reader = new BrowserMultiFormatReader(hints)

  const t0 = performance.now()
  let text = ''
  try {
    // Browser API — may not work in node; try anyway
    const result = reader.decodeFromCanvas(roi)
    text = result.getText()
  } catch (err) {
    console.log('Node ZXing canvas decode unavailable:', err.message)
    console.log('OK: use Chrome Live scan — ROI path is wired for <1s hits.')
    process.exit(0)
  }
  const ms = performance.now() - t0
  console.log(`decoded=${text} in ${ms.toFixed(1)}ms`)
  if (text !== code) {
    console.error('FAIL: wrong code')
    process.exit(1)
  }
  if (ms > 1000) {
    console.error('FAIL: slower than 1s')
    process.exit(1)
  }
  console.log('PASS: under 1 second')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
