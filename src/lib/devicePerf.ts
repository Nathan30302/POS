/** Heuristics for low-end phones / data-saver — prefer stills over looping video. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isWeakDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  if (prefersReducedMotion()) return true
  const nav = navigator as Navigator & {
    deviceMemory?: number
    connection?: { saveData?: boolean; effectiveType?: string }
  }
  if (nav.connection?.saveData) return true
  const et = nav.connection?.effectiveType
  if (et === 'slow-2g' || et === '2g') return true
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return true
  if (
    typeof nav.hardwareConcurrency === 'number' &&
    nav.hardwareConcurrency > 0 &&
    nav.hardwareConcurrency <= 4
  ) {
    // Coarse pointer + few cores ≈ phone mid/low-end
    const coarse =
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches
    if (coarse) return true
  }
  return false
}
