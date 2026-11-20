/** Common ZMW note steps for quick cash tender on Sell. */
export const TENDER_NOTES = [5, 10, 20, 50, 100, 200] as const

export function roundUpTo(amount: number, step: number) {
  if (amount <= 0) return step
  return Math.ceil(amount / step) * step
}

/** Suggested cash amounts: exact + round-ups that aren’t redundant. */
export function suggestTenders(total: number): number[] {
  if (!Number.isFinite(total) || total <= 0) return []
  const exact = Number(total.toFixed(2))
  const out: number[] = [exact]
  for (const step of [5, 10, 20, 50, 100]) {
    const up = roundUpTo(exact, step)
    if (up > exact + 0.001 && !out.some((n) => Math.abs(n - up) < 0.001)) {
      out.push(up)
    }
  }
  for (const note of TENDER_NOTES) {
    if (note >= exact && !out.some((n) => Math.abs(n - note) < 0.001)) {
      out.push(note)
    }
  }
  return out.slice(0, 6)
}

/** Loyalty: 10 pts → K1 off, capped at 20% of subtotal. */
export function loyaltyDiscountKwacha(pts: number, subtotal: number) {
  if (pts < 10 || subtotal <= 0) return 0
  const fromPts = Math.floor(pts / 10)
  const cap = Math.floor(subtotal * 0.2)
  return Math.max(0, Math.min(fromPts, cap))
}
