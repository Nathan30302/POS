import { BrowserMultiFormatReader } from '@zxing/browser'
import {
  BarcodeFormat,
  DecodeHintType,
} from '@zxing/library'

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

const NATIVE_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'codabar',
  'qr_code',
]

function zxingHints() {
  const hints = new Map()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODABAR,
    BarcodeFormat.ITF,
    BarcodeFormat.QR_CODE,
  ])
  // Soft decode first — TRY_HARDER is slow on phones
  hints.set(DecodeHintType.TRY_HARDER, false)
  return hints
}

async function detectNative(source: ImageBitmapSource): Promise<string | null> {
  if (!window.BarcodeDetector) return null
  try {
    const detector = new window.BarcodeDetector({ formats: NATIVE_FORMATS })
    const codes = await detector.detect(source)
    return codes[0]?.rawValue?.trim() || null
  } catch {
    return null
  }
}

async function detectZxingFromUrl(url: string): Promise<string | null> {
  try {
    const reader = new BrowserMultiFormatReader(zxingHints())
    const result = await reader.decodeFromImageUrl(url)
    return result?.getText()?.trim() || null
  } catch {
    return null
  }
}

async function fileToImage(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.decoding = 'async'
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Image load failed'))
    img.src = url
  })
  return { img, url }
}

type Variant = {
  label: string
  canvas: HTMLCanvasElement
}

function toGrayThreshold(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  low = 105,
  high = 165,
) {
  const image = ctx.getImageData(0, 0, cw, ch)
  const data = image.data
  for (let i = 0; i < data.length; i += 4) {
    const g = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    const v = g < low ? 0 : g > high ? 255 : g
    data[i] = data[i + 1] = data[i + 2] = v
  }
  ctx.putImageData(image, 0, 0)
}

function buildVariants(img: HTMLImageElement): Variant[] {
  const variants: Variant[] = []
  const maxSide = 1800
  const nw = img.naturalWidth
  const nh = img.naturalHeight
  const scale = Math.min(1, maxSide / Math.max(nw, nh))
  // Upscale tiny camera snaps so ZXing has more pixels on thin bars
  const up = Math.max(nw, nh) < 900 ? Math.min(1.8, 1100 / Math.max(nw, nh)) : 1
  const w = Math.max(1, Math.round(nw * scale * up))
  const h = Math.max(1, Math.round(nh * scale * up))

  function draw(
    label: string,
    fn: (ctx: CanvasRenderingContext2D, cw: number, ch: number) => void,
    cw = w,
    ch = h,
  ) {
    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    fn(ctx, cw, ch)
    variants.push({ label, canvas })
  }

  // Full frame
  draw('full', (ctx, cw, ch) => {
    ctx.drawImage(img, 0, 0, cw, ch)
  })

  // Center crop (barcode usually in the middle of a phone photo)
  draw('center', (ctx, cw, ch) => {
    const sw = nw * 0.72
    const sh = nh * 0.45
    const sx = (nw - sw) / 2
    const sy = (nh - sh) / 2
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch)
  })

  // Wide horizontal strip — typical 1D barcode orientation
  const stripW = Math.max(1, Math.round(w * 0.95))
  const stripH = Math.max(1, Math.round(h * 0.32))
  draw(
    'strip',
    (ctx, cw, ch) => {
      const sw = nw * 0.92
      const sh = nh * 0.28
      const sx = (nw - sw) / 2
      const sy = (nh - sh) / 2
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch)
    },
    stripW,
    stripH,
  )

  // Slightly lower strip (phones often tilt down)
  draw(
    'strip-low',
    (ctx, cw, ch) => {
      const sw = nw * 0.9
      const sh = nh * 0.26
      const sx = (nw - sw) / 2
      const sy = nh * 0.42
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch)
    },
    stripW,
    stripH,
  )

  // High contrast grayscale
  draw('contrast', (ctx, cw, ch) => {
    ctx.drawImage(img, 0, 0, cw, ch)
    toGrayThreshold(ctx, cw, ch)
  })

  // Harder threshold for faded ink / plastic wrap glare
  draw('threshold', (ctx, cw, ch) => {
    ctx.drawImage(img, 0, 0, cw, ch)
    toGrayThreshold(ctx, cw, ch, 95, 145)
  })

  // Inverted (some printed labels / screenshots)
  draw('invert', (ctx, cw, ch) => {
    ctx.drawImage(img, 0, 0, cw, ch)
    const image = ctx.getImageData(0, 0, cw, ch)
    const data = image.data
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i]
      data[i + 1] = 255 - data[i + 1]
      data[i + 2] = 255 - data[i + 2]
    }
    ctx.putImageData(image, 0, 0)
  })

  return variants
}

/**
 * Decode a barcode from a phone camera photo.
 * Tries several image variants so shop lighting / angle still works.
 */
export async function decodeBarcodeFromFile(file: File): Promise<string | null> {
  // Fast path: native detector on the file/bitmap
  try {
    const bitmap = await createImageBitmap(file)
    try {
      const hit = await detectNative(bitmap)
      if (hit) return hit
    } finally {
      bitmap.close?.()
    }
  } catch {
    // continue
  }

  let img: HTMLImageElement
  let url: string
  try {
    ;({ img, url } = await fileToImage(file))
  } catch {
    return null
  }

  try {
    const direct = await detectZxingFromUrl(url)
    if (direct) return direct

    const variants = buildVariants(img)
    for (const variant of variants) {
      const nativeHit = await detectNative(variant.canvas)
      if (nativeHit) return nativeHit

      const dataUrl = variant.canvas.toDataURL('image/jpeg', 0.92)
      const zxingHit = await detectZxingFromUrl(dataUrl)
      if (zxingHit) return zxingHit
    }
  } finally {
    URL.revokeObjectURL(url)
  }

  return null
}
