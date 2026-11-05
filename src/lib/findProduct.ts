import { localDb } from '@/lib/localDb'
import type { Product } from '@/types/database'

/** Normalize scanner quirks: spaces, leading zeros, UPC/EAN variants. */
export function normalizeBarcode(raw: string) {
  return raw.trim().replace(/\s+/g, '')
}

export function findProductByCode(
  raw: string,
  products: Product[],
): Product | null {
  const code = normalizeBarcode(raw)
  if (!code) return null

  const direct = localDb.findByBarcode(code)
  if (direct) return direct

  const candidates = new Set<string>([code])
  if (/^\d+$/.test(code)) {
    candidates.add(code.replace(/^0+/, '') || '0')
    if (code.length === 12) candidates.add(`0${code}`) // UPC-A → EAN-13
    if (code.length === 13 && code.startsWith('0')) candidates.add(code.slice(1))
  }

  for (const candidate of candidates) {
    const hit = products.find(
      (p) =>
        p.barcode === candidate ||
        p.sku?.toLowerCase() === candidate.toLowerCase(),
    )
    if (hit) return hit
  }

  // Exact name only if unique
  const nameHits = products.filter(
    (p) => p.name.toLowerCase() === code.toLowerCase(),
  )
  if (nameHits.length === 1) return nameHits[0]

  return null
}
