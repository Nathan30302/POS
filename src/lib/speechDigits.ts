/** Spoken barcode / price helpers for inventory voice fill. */

const WORD_TO_DIGIT: Record<string, string> = {
  zero: '0',
  oh: '0',
  o: '0',
  nought: '0',
  one: '1',
  won: '1',
  two: '2',
  to: '2',
  too: '2',
  three: '3',
  tree: '3',
  free: '3',
  four: '4',
  for: '4',
  fore: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  ate: '8',
  nine: '9',
  niner: '9',
  double: '',
  triple: '',
}

/**
 * "six zero zero…" / "600 100 1001" / "barcode 6001001001001"
 */
export function spokenToDigits(raw: string) {
  const cleaned = raw
    .toLowerCase()
    .replace(/barcode|bar code|code|number|is|equals|please/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return ''

  const digitRun = cleaned.replace(/\s+/g, '').match(/\d{6,}/)
  if (digitRun) return digitRun[0]

  // Spaced digits like "6 0 0 1 0 0"
  const spaced = cleaned.match(/(?:\d\s*){6,}/)
  if (spaced) return spaced[0].replace(/\s+/g, '')

  const parts = cleaned.split(' ')
  let out = ''
  let repeat = 1

  for (const part of parts) {
    if (part === 'double') {
      repeat = 2
      continue
    }
    if (part === 'triple') {
      repeat = 3
      continue
    }
    if (/^\d+$/.test(part)) {
      out += part.repeat(Math.max(1, repeat))
      repeat = 1
      continue
    }
    const digit = WORD_TO_DIGIT[part]
    if (digit !== undefined && digit !== '') {
      out += digit.repeat(Math.max(1, repeat))
      repeat = 1
    }
  }

  return out.replace(/\D/g, '')
}

export function tidySpokenName(raw: string) {
  const text = raw
    .replace(
      /^(product\s+name\s+(is\s+)?|name\s+(is\s+)?|it's\s+(a\s+)?|product\s+|item\s+)/i,
      '',
    )
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  return text.replace(/\b\w/g, (c) => c.toUpperCase())
}

const SMALL: Record<string, number> = {
  zero: 0,
  oh: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fourty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
}

/**
 * Spoken money → number.
 * "fifteen", "12.50", "twenty five kwacha", "rate thirty", "one twenty five".
 */
export function spokenToMoney(raw: string): number | null {
  let cleaned = raw
    .toLowerCase()
    .replace(/,/g, '')
    .replace(
      /(?:selling\s+)?(?:price|cost|rate|amount|kwacha|zmw|kw|ngwee|dollars?|bucks?|cents?|pounds?)/g,
      ' ',
    )
    .replace(/\bat\b|\bis\b|\bequals?\b|\bplease\b|\bkwacha\b/g, ' ')
    .replace(/[^a-z0-9.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return null

  // "12 point 50" / "12.50"
  const pointWords = cleaned.match(
    /(\d+)\s*(?:point|dot)\s*(\d{1,2})\b/,
  )
  if (pointWords) {
    const n = Number(`${pointWords[1]}.${pointWords[2]}`)
    return Number.isFinite(n) ? n : null
  }

  const decimal = cleaned.match(/\b(\d+\.\d{1,2})\b/)
  if (decimal) {
    const n = Number(decimal[1])
    return Number.isFinite(n) ? n : null
  }

  // Pure numeric utterance
  if (/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : null
  }

  // Leading number with filler: "15 only"
  const leadingNum = cleaned.match(/^(\d+(?:\.\d{1,2})?)\b/)
  if (leadingNum && cleaned.split(' ').length <= 4) {
    const n = Number(leadingNum[1])
    if (Number.isFinite(n)) return n
  }

  // Word numbers — support "point five" after words
  const pointIdx = cleaned.split(' ').findIndex((p) => p === 'point' || p === 'dot')
  let wholePart = cleaned
  let frac: number | null = null
  if (pointIdx >= 0) {
    const bits = cleaned.split(' ')
    wholePart = bits.slice(0, pointIdx).join(' ')
    const after = bits.slice(pointIdx + 1).join(' ')
    if (/^\d{1,2}$/.test(after.trim())) {
      frac = Number(after.trim())
    } else {
      const f = wordsToInt(after)
      if (f !== null && f < 100) frac = f
    }
  }

  const whole = wordsToInt(wholePart)
  if (whole === null && frac === null) return null
  if (frac !== null) {
    const base = whole ?? 0
    const fracStr = String(frac).padStart(2, '0').slice(0, 2)
    return Number(`${base}.${fracStr}`)
  }
  return whole
}

function wordsToInt(raw: string): number | null {
  const parts = raw
    .toLowerCase()
    .replace(/\band\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
  if (!parts.length) return null

  let total = 0
  let current = 0
  let saw = false
  for (const part of parts) {
    if (part === 'hundred') {
      current = (current || 1) * 100
      saw = true
      continue
    }
    if (part === 'thousand') {
      current = (current || 1) * 1000
      total += current
      current = 0
      saw = true
      continue
    }
    const n = SMALL[part]
    if (n !== undefined) {
      current += n
      saw = true
      continue
    }
    if (/^\d+$/.test(part)) {
      current += Number(part)
      saw = true
    }
  }
  total += current
  return saw ? total : null
}

export type SpokenProductParts = {
  name?: string
  barcode?: string
  price?: number
  category?: string
  stock?: number
}

/**
 * Free-form product dictation, e.g.
 * "Black gel pen, selling price fifteen, barcode six zero zero…"
 */
export function parseSpokenProduct(raw: string): SpokenProductParts {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (!text) return {}

  const out: SpokenProductParts = {}
  const lower = text.toLowerCase()

  const priceMatch = text.match(
    /(?:selling\s+)?(?:price|rate|costs?|sell(?:s|ing)?\s+for|sells?\s+at|for|at)\s+([^,.;]+)/i,
  )
  if (priceMatch) {
    const money = spokenToMoney(priceMatch[1])
    if (money !== null) out.price = money
  } else {
    const alone = spokenToMoney(text)
    if (alone !== null && alone > 0 && text.split(/\s+/).length <= 8) {
      out.price = alone
    }
  }

  const barcodeMatch = text.match(
    /(?:barcode|bar\s*code|code)\s+(?:is\s+)?([^,.;]+)/i,
  )
  if (barcodeMatch) {
    const digits = spokenToDigits(barcodeMatch[1])
    if (digits) out.barcode = digits
  }

  const stockMatch = text.match(
    /(?:stock|quantity|qty)\s+(?:is\s+|of\s+)?([^,.;]+)/i,
  )
  if (stockMatch) {
    const qty = spokenToMoney(stockMatch[1])
    if (qty !== null) out.stock = Math.round(qty)
  }

  const categoryMatch = text.match(
    /(?:category|section)\s+(?:is\s+)?([a-z]+)/i,
  )
  if (categoryMatch) {
    out.category =
      categoryMatch[1].charAt(0).toUpperCase() + categoryMatch[1].slice(1)
  }

  let nameChunk = text
    .replace(
      /(?:selling\s+)?(?:price|rate|costs?|sell(?:s|ing)?\s+for|sells?\s+at|for|at)\s+[^,.;]+/gi,
      ' ',
    )
    .replace(/(?:barcode|bar\s*code|code)\s+(?:is\s+)?[^,.;]+/gi, ' ')
    .replace(/(?:stock|quantity|qty)\s+(?:is\s+|of\s+)?[^,.;]+/gi, ' ')
    .replace(/(?:category|section)\s+(?:is\s+)?[a-z]+/gi, ' ')
    .replace(/[,.;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (nameChunk && !/^\d+(\.\d+)?$/.test(nameChunk)) {
    nameChunk = nameChunk
      .replace(/^(it'?s\s+a\s+|description\s+(is\s+)?|product\s+|item\s+)/i, '')
      .trim()
    const name = tidySpokenName(nameChunk)
    if (name && !/^(price|barcode|stock|rate)$/i.test(name)) out.name = name
  }

  if (!out.barcode) {
    const digits = spokenToDigits(lower)
    if (digits.length >= 8) out.barcode = digits
  }

  return out
}
