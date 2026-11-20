import JsBarcode from 'jsbarcode'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

const DEMO_CODE = '6001001001002'

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>
}

declare global {
  interface Window {
    BarcodeDetector?: new (options?: {
      formats?: string[]
    }) => BarcodeDetectorLike
  }
}

function buildDemoCanvas() {
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 200
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  JsBarcode(canvas, DEMO_CODE, {
    format: 'CODE128',
    width: 2,
    height: 110,
    displayValue: false,
    margin: 24,
    background: '#ffffff',
    lineColor: '#000000',
  })
  return canvas
}

/**
 * Times a warm decode of a synthetic barcode in this browser.
 * Cold BarcodeDetector can take >1s once; after warm-up it should be <<1s.
 */
export async function runScanSelfTest(): Promise<{
  ok: boolean
  engine: string
  ms: number
  coldMs: number
  code: string
}> {
  const canvas = buildDemoCanvas()

  if (window.BarcodeDetector) {
    try {
      const detector = new window.BarcodeDetector({
        formats: ['code_128', 'ean_13', 'ean_8', 'upc_a'],
      })
      const cold0 = performance.now()
      await detector.detect(canvas)
      const coldMs = performance.now() - cold0

      const t0 = performance.now()
      const codes = await detector.detect(canvas)
      const ms = performance.now() - t0
      const code = codes[0]?.rawValue?.trim() || ''
      return {
        ok: code === DEMO_CODE && ms < 1000,
        engine: 'BarcodeDetector',
        ms,
        coldMs,
        code,
      }
    } catch {
      // fall through to ZXing
    }
  }

  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.EAN_13,
  ])
  hints.set(DecodeHintType.TRY_HARDER, false)
  const reader = new BrowserMultiFormatReader(hints)
  // warm
  try {
    reader.decodeFromCanvas(canvas)
  } catch {
    // ignore
  }
  const t0 = performance.now()
  const result = reader.decodeFromCanvas(canvas)
  const ms = performance.now() - t0
  const code = result.getText().trim()
  return {
    ok: code === DEMO_CODE && ms < 1000,
    engine: 'ZXing',
    ms,
    coldMs: ms,
    code,
  }
}
