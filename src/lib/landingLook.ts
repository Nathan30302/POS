const LANDING_KEY = 'nexora-landing-look'

/** Accent chip used on the public landing CTA / highlights. */
export type LandingAccent = 'royal' | 'teal' | 'gold' | 'forest' | 'slate'

/** Headline voice — copy + weight feel, not a full page builder. */
export type LandingTone = 'bold' | 'calm' | 'premium'

/** Hero atmosphere behind the brand. */
export type LandingBackground = 'video' | 'gradient' | 'minimal'

export type LandingLook = {
  accent: LandingAccent
  tone: LandingTone
  background: LandingBackground
}

export const DEFAULT_LANDING_LOOK: LandingLook = {
  accent: 'teal',
  tone: 'premium',
  background: 'video',
}

export const LANDING_ACCENT_OPTIONS: Array<{
  value: LandingAccent
  label: string
  hex: string
}> = [
  { value: 'royal', label: 'Royal blue', hex: '#3563E9' },
  { value: 'teal', label: 'Shop teal', hex: '#13B8A6' },
  { value: 'gold', label: 'Warm gold', hex: '#C9A227' },
  { value: 'forest', label: 'Forest', hex: '#3D9B6E' },
  { value: 'slate', label: 'Slate mint', hex: '#7DD3C0' },
]

export const LANDING_TONE_OPTIONS: Array<{
  value: LandingTone
  label: string
  blurb: string
}> = [
  {
    value: 'bold',
    label: 'Bold OS',
    blurb: 'Big brand · sharp command line',
  },
  {
    value: 'calm',
    label: 'Calm counter',
    blurb: 'Softer headline · quieter pitch',
  },
  {
    value: 'premium',
    label: 'Premium desk',
    blurb: 'Refined · growth-studio voice',
  },
]

export const LANDING_BG_OPTIONS: Array<{
  value: LandingBackground
  label: string
  blurb: string
}> = [
  {
    value: 'video',
    label: 'Shop floor video',
    blurb: 'Live retail footage behind the hero',
  },
  {
    value: 'gradient',
    label: 'Accent wash',
    blurb: 'No video · branded gradient field',
  },
  {
    value: 'minimal',
    label: 'Minimal ink',
    blurb: 'Quiet dark plane · type first',
  },
]

const ACCENTS = new Set<string>(LANDING_ACCENT_OPTIONS.map((o) => o.value))
const TONES = new Set<string>(LANDING_TONE_OPTIONS.map((o) => o.value))
const BACKGROUNDS = new Set<string>(LANDING_BG_OPTIONS.map((o) => o.value))

export function normalizeLandingLook(raw: unknown): LandingLook {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_LANDING_LOOK }
  const o = raw as Record<string, unknown>
  return {
    accent: ACCENTS.has(String(o.accent))
      ? (o.accent as LandingAccent)
      : DEFAULT_LANDING_LOOK.accent,
    tone: TONES.has(String(o.tone))
      ? (o.tone as LandingTone)
      : DEFAULT_LANDING_LOOK.tone,
    background: BACKGROUNDS.has(String(o.background))
      ? (o.background as LandingBackground)
      : DEFAULT_LANDING_LOOK.background,
  }
}

export function getLandingLook(): LandingLook {
  try {
    const raw = localStorage.getItem(LANDING_KEY)
    if (!raw) return { ...DEFAULT_LANDING_LOOK }
    return normalizeLandingLook(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_LANDING_LOOK }
  }
}

export function setLandingLook(look: LandingLook): LandingLook {
  const next = normalizeLandingLook(look)
  localStorage.setItem(LANDING_KEY, JSON.stringify(next))
  return next
}

/** CSS-friendly accent hex for inline styles on LandingPage. */
export function landingAccentHex(accent: LandingAccent): string {
  return (
    LANDING_ACCENT_OPTIONS.find((o) => o.value === accent)?.hex ??
    LANDING_ACCENT_OPTIONS[0].hex
  )
}

export function landingHeadline(tone: LandingTone): {
  eyebrow: string
  headline: string
  support: string
  whyEyebrow: string
  whyTitle: string
} {
  if (tone === 'calm') {
    return {
      eyebrow: 'Shop OS · growth + integrity',
      headline: 'A fast till. Clear books.',
      support:
        'Cashiers keep the line moving. Owners see stock, voids, and each branch.',
      whyEyebrow: 'Why NEXORA',
      whyTitle: 'Accountability without slowing the counter.',
    }
  }
  if (tone === 'premium') {
    return {
      eyebrow: 'Shop OS · growth + integrity',
      headline: 'Every counter, one command.',
      support:
        'Sell, stock integrity, and trust signals across the shops you run.',
      whyEyebrow: 'Beyond the till',
      whyTitle: 'Hold every branch to the same standard.',
    }
  }
  return {
    eyebrow: 'Shop OS · growth + integrity',
    headline: 'Sell the rush. See every leak.',
    support:
      'One workspace for the till, the stockroom, and every branch you own.',
    whyEyebrow: 'Beyond the till',
    whyTitle: 'Your shops. Your team. A record of the day.',
  }
}
