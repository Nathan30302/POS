import type { Product } from '@/types/database'

export function normalizeBarcode(raw: string) {
  return raw.trim().replace(/\s+/g, '')
}

export type ProductIndex = {
  byId: Map<string, Product>
  byCode: Map<string, Product>
}

function indexCode(map: Map<string, Product>, key: string, product: Product) {
  const k = key.trim()
  if (!k) return
  map.set(k, product)
  map.set(k.toLowerCase(), product)
  if (/^\d+$/.test(k)) {
    const stripped = k.replace(/^0+/, '') || '0'
    map.set(stripped, product)
    if (k.length === 12) map.set(`0${k}`, product)
    if (k.length === 13 && k.startsWith('0')) map.set(k.slice(1), product)
  }
}

/** Build O(1) barcode / SKU / id lookup for Sell. */
export function buildProductIndex(products: Product[]): ProductIndex {
  const byId = new Map<string, Product>()
  const byCode = new Map<string, Product>()
  for (const product of products) {
    byId.set(product.id, product)
    if (product.barcode) indexCode(byCode, normalizeBarcode(product.barcode), product)
    if (product.sku) indexCode(byCode, product.sku, product)
  }
  return { byId, byCode }
}

function softMatch(code: string, products: Product[]): Product | null {
  if (code.length < 6) return null
  const soft = products.filter((p) => {
    const barcode = (p.barcode ?? '').trim()
    if (barcode.length < 6) return false
    return barcode.endsWith(code) || code.endsWith(barcode)
  })
  return soft.length === 1 ? soft[0] : null
}

export function findProductByCode(
  raw: string,
  productsOrIndex: Product[] | ProductIndex,
): Product | null {
  const code = normalizeBarcode(raw)
  if (!code) return null

  if (!Array.isArray(productsOrIndex)) {
    const { byCode, byId } = productsOrIndex
    const hit =
      byCode.get(code) ||
      byCode.get(code.toLowerCase()) ||
      byId.get(code)
    if (hit) return hit
    if (/^\d+$/.test(code)) {
      const stripped = code.replace(/^0+/, '') || '0'
      const fromStrip = byCode.get(stripped)
      if (fromStrip) return fromStrip
      if (code.length === 12) {
        const padded = byCode.get(`0${code}`)
        if (padded) return padded
      }
      if (code.length === 13 && code.startsWith('0')) {
        const unpadded = byCode.get(code.slice(1))
        if (unpadded) return unpadded
      }
    }
    // Soft match only over indexed values (unique barcodes)
    return softMatch(code, [...byId.values()])
  }

  const products = productsOrIndex
  const candidates = new Set<string>([code])
  if (/^\d+$/.test(code)) {
    candidates.add(code.replace(/^0+/, '') || '0')
    if (code.length === 12) candidates.add(`0${code}`)
    if (code.length === 13 && code.startsWith('0')) candidates.add(code.slice(1))
  }

  for (const candidate of candidates) {
    const hit = products.find((p) => {
      const barcode = (p.barcode ?? '').trim()
      const sku = (p.sku ?? '').trim()
      return (
        barcode === candidate ||
        barcode.toLowerCase() === candidate.toLowerCase() ||
        sku.toLowerCase() === candidate.toLowerCase()
      )
    })
    if (hit) return hit
  }

  const soft = softMatch(code, products)
  if (soft) return soft

  const nameHits = products.filter(
    (p) => p.name.toLowerCase() === code.toLowerCase(),
  )
  return nameHits.length === 1 ? nameHits[0] : null
}
