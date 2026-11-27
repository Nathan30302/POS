const THEME_KEY = 'nexora-theme'
const AMBIENT_KEY = 'nexora-ambient'
const DENSITY_KEY = 'nexora-density'

/**
 * Counter skins (exactly 6, visually distinct).
 * Shell cycle: light → dark → live-city.
 * Full gallery lives in Settings Look & feel.
 */
export type ThemeMode =
  | 'light'
  | 'dark'
  | 'live-city'
  | 'live-streets'
  | 'live-sky'
  | 'live-market'
  | 'forest'
  | 'midnight'
  | 'coastal'
  | 'ember'

export type DensityMode = 'comfortable' | 'compact'
export type ThemeGroup = 'counter' | 'live'
export type LiveAmbientVariant = 'sky' | 'market' | 'city' | 'streets' | 'floor'

/** Themes that sit on the dark palette (Tailwind `dark:` + base vars). */
const DARK_BASE: ReadonlySet<ThemeMode> = new Set([
  'dark',
  'live-city',
  'live-streets',
  'live-sky',
  'live-market',
  'forest',
  'midnight',
  'ember',
])

const LIVE_THEMES: ReadonlySet<ThemeMode> = new Set([
  'live-city',
  'live-streets',
  'live-sky',
  'live-market',
])

const VIDEO_LIVE_THEMES: ReadonlySet<ThemeMode> = new Set([
  'live-city',
  'live-streets',
])

const SHOP_THEME_CLASS: Record<
  Exclude<
    ThemeMode,
    'light' | 'dark' | 'live-city' | 'live-streets' | 'live-sky' | 'live-market'
  >,
  string
> = {
  forest: 'theme-forest',
  midnight: 'theme-midnight',
  coastal: 'theme-coastal',
  ember: 'theme-ember',
}

const ALL_SHOP_CLASSES = Object.values(SHOP_THEME_CLASS)

export type ThemeOption = {
  value: ThemeMode
  label: string
  blurb: string
  /** Tailwind gradient stops (also kept for scanning) */
  swatch: string
  /** Full CSS background — Settings picker uses this so swatches never go blank */
  swatchCss: string
  accent: string
  /** CSS for the accent pill (color or gradient) */
  accentCss: string
  group: ThemeGroup
  /** Mini card fill in the picker preview (Tailwind) */
  cardTone: string
  /** CSS background for the mini card */
  cardCss: string
  livePulse?: boolean
  /** Still/poster for video live themes in Settings */
  previewSrc?: string
  videoSrc?: string
}

/** Video clip keys for Live City / Live Streets atmospheres. */
export type LiveVideoClip = 'city' | 'streets'

/**
 * Central registry for Live video atmospheres.
 * Swap looks by replacing files under `public/themes/` (same filenames)
 * or by editing paths here — see `public/themes/CREDITS.txt`.
 */
export const LIVE_VIDEO_CLIPS: Record<
  LiveVideoClip,
  {
    src: string
    poster: string
    /** Pexels CDN if local file missing (LAN / first paint). */
    fallback: string
    label: string
    /** Scrim strength 0–1 (higher = darker / more readable UI). */
    dim: number
  }
> = {
  city: {
    src: '/themes/live-city.mp4',
    poster: '/themes/live-city.jpg',
    // Dubai skyscrapers + highway — Mixkit #28641
    fallback: 'https://assets.mixkit.co/videos/28641/28641-720.mp4',
    label: 'Live City',
    dim: 0.68,
  },
  streets: {
    src: '/themes/live-streets.mp4',
    poster: '/themes/live-streets.jpg',
    // Johannesburg CBD skyline — Pexels #33637719
    fallback:
      'https://videos.pexels.com/video-files/33637719/14294796_3840_2160_24fps.mp4',
    label: 'Live Streets',
    dim: 0.62,
  },
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    value: 'light',
    label: 'Light',
    blurb: 'Bright counter · clean cards',
    swatch: 'from-[#e8eefc] via-[#f5f7fb] to-[#dce6fa]',
    swatchCss: 'linear-gradient(135deg, #e8eefc 0%, #f5f7fb 45%, #dce6fa 100%)',
    accent: 'bg-[#3563e9]',
    accentCss: '#3563e9',
    cardTone: 'bg-white/90',
    cardCss: 'rgba(255,255,255,0.9)',
    group: 'counter',
  },
  {
    value: 'dark',
    label: 'Dark',
    blurb: 'Calm night · low glare',
    swatch: 'from-[#0b1224] via-[#121a2f] to-[#1a2748]',
    swatchCss: 'linear-gradient(135deg, #0b1224 0%, #121a2f 45%, #1a2748 100%)',
    accent: 'bg-[#4c7dff]',
    accentCss: '#4c7dff',
    cardTone: 'bg-[#121a2f]/85',
    cardCss: 'rgba(18,26,47,0.85)',
    group: 'counter',
  },
  {
    value: 'forest',
    label: 'Forest',
    blurb: 'Deep moss wash · retail green',
    swatch: 'from-[#06241a] via-[#0d3d2c] to-[#145c3f]',
    swatchCss: 'linear-gradient(135deg, #06241a 0%, #0d3d2c 45%, #145c3f 100%)',
    accent: 'bg-[#3d9b6e]',
    accentCss: '#3d9b6e',
    cardTone: 'bg-[#0f2a1e]/90',
    cardCss: 'rgba(15,42,30,0.9)',
    group: 'counter',
  },
  {
    value: 'ember',
    label: 'Ember',
    blurb: 'Warm orange floor · amber glow',
    swatch: 'from-[#2a1208] via-[#4a220e] to-[#c45a1a]',
    swatchCss: 'linear-gradient(135deg, #2a1208 0%, #4a220e 45%, #c45a1a 100%)',
    accent: 'bg-[#f97316]',
    accentCss: '#f97316',
    cardTone: 'bg-[#2a1810]/88',
    cardCss: 'rgba(42,24,16,0.88)',
    group: 'counter',
  },
  {
    value: 'coastal',
    label: 'Coastal',
    blurb: 'Sea-blue wash · clear teal',
    swatch: 'from-[#c8e8f0] via-[#e6f4f8] to-[#7ec8d8]',
    swatchCss: 'linear-gradient(135deg, #c8e8f0 0%, #e6f4f8 45%, #7ec8d8 100%)',
    accent: 'bg-[#0d9488]',
    accentCss: '#0d9488',
    cardTone: 'bg-white/85',
    cardCss: 'rgba(255,255,255,0.85)',
    group: 'counter',
  },
  {
    value: 'midnight',
    label: 'Midnight gold',
    blurb: 'Ink night · warm gold glow',
    swatch: 'from-[#08060c] via-[#16120a] to-[#2a2110]',
    swatchCss: 'linear-gradient(135deg, #08060c 0%, #16120a 45%, #2a2110 100%)',
    accent: 'bg-[#c9a227]',
    accentCss: '#c9a227',
    cardTone: 'bg-[#16141c]/90',
    cardCss: 'rgba(22,20,28,0.9)',
    group: 'counter',
  },
  {
    value: 'live-city',
    label: 'Live City',
    blurb: 'Dubai skyline · highway loop',
    swatch: 'from-[#050a14] via-[#0c1a32] to-[#1e3a5f]',
    swatchCss: 'linear-gradient(135deg, #050a14 0%, #0c1a32 45%, #1e3a5f 100%)',
    accent: 'bg-gradient-to-r from-[#60a5fa] to-[#22d3ee]',
    accentCss: 'linear-gradient(90deg, #60a5fa, #22d3ee)',
    cardTone: 'bg-[#0a1628]/88',
    cardCss: 'rgba(10,22,40,0.88)',
    group: 'live',
    livePulse: true,
    previewSrc: LIVE_VIDEO_CLIPS.city.poster,
    videoSrc: LIVE_VIDEO_CLIPS.city.src,
  },
  {
    value: 'live-streets',
    label: 'Live Streets',
    blurb: 'Johannesburg · buildings & streets',
    swatch: 'from-[#1a120c] via-[#2a2218] to-[#3d3428]',
    swatchCss: 'linear-gradient(135deg, #1a120c 0%, #2a2218 45%, #3d3428 100%)',
    accent: 'bg-gradient-to-r from-[#fbbf24] to-[#f97316]',
    accentCss: 'linear-gradient(90deg, #fbbf24, #f97316)',
    cardTone: 'bg-[#1c1610]/88',
    cardCss: 'rgba(28,22,16,0.88)',
    group: 'live',
    livePulse: true,
    previewSrc: LIVE_VIDEO_CLIPS.streets.poster,
    videoSrc: LIVE_VIDEO_CLIPS.streets.src,
  },
  {
    value: 'live-sky',
    label: 'Live Sky',
    blurb: 'Real night sky · stars drift',
    swatch: 'from-[#040812] via-[#0a1428] to-[#1a2850]',
    swatchCss: 'linear-gradient(135deg, #040812 0%, #0a1428 45%, #1a2850 100%)',
    accent: 'bg-gradient-to-r from-[#93c5fd] to-[#38bdf8]',
    accentCss: 'linear-gradient(90deg, #93c5fd, #38bdf8)',
    cardTone: 'bg-[#0c1528]/85',
    cardCss: 'rgba(12,21,40,0.85)',
    group: 'live',
    livePulse: true,
  },
  {
    value: 'live-market',
    label: 'Live Market',
    blurb: 'Warm shop floor · soft bokeh',
    swatch: 'from-[#1a0e08] via-[#3d2212] to-[#7a3d18]',
    swatchCss: 'linear-gradient(135deg, #1a0e08 0%, #3d2212 45%, #7a3d18 100%)',
    accent: 'bg-gradient-to-r from-[#f59e0b] to-[#fb923c]',
    accentCss: 'linear-gradient(90deg, #f59e0b, #fb923c)',
    cardTone: 'bg-[#241610]/88',
    cardCss: 'rgba(36,22,16,0.88)',
    group: 'live',
    livePulse: true,
  },
]

/** 6 counter skins for Settings Look & feel */
export const COUNTER_THEME_OPTIONS = THEME_OPTIONS.filter((t) => t.group === 'counter')
/** @deprecated use COUNTER_THEME_OPTIONS */
export const COUNTER_THEMES = COUNTER_THEME_OPTIONS

/** 4 live atmospheres for Settings Look & feel */
export const LIVE_THEME_OPTIONS = THEME_OPTIONS.filter((t) => t.group === 'live')
/** @deprecated use LIVE_THEME_OPTIONS — list alias (not the internal Set) */
export const LIVE_ATMOSPHERES = LIVE_THEME_OPTIONS

const VALID_THEMES = new Set<string>(THEME_OPTIONS.map((t) => t.value))

/** Map retired theme ids to the closest current skin. */
const LEGACY_THEME_MAP: Record<string, ThemeMode> = {
  live: 'live-city',
  'live-floor': 'live-city',
  slate: 'dark',
  paper: 'light',
  system: 'live-city',
}

function migrateTheme(raw: string | null): ThemeMode {
  if (raw && VALID_THEMES.has(raw)) return raw as ThemeMode
  if (raw && raw in LEGACY_THEME_MAP) return LEGACY_THEME_MAP[raw]
  return 'light'
}

export function getThemePreference(): ThemeMode {
  return migrateTheme(localStorage.getItem(THEME_KEY))
}

export function getThemeLabel(pref: ThemeMode = getThemePreference()): string {
  return THEME_OPTIONS.find((t) => t.value === pref)?.label ?? 'Theme'
}

/**
 * Resolve to light/dark base for icons and Tailwind `dark:`.
 * Live and shop night skins count as dark.
 */
export function resolveTheme(
  pref: ThemeMode = getThemePreference(),
): 'light' | 'dark' {
  return DARK_BASE.has(pref) ? 'dark' : 'light'
}

/** Resolved light/dark for icons — Live and night shop skins count as dark. */
export function getTheme(): 'light' | 'dark' {
  return resolveTheme()
}

export function isLiveTheme(pref: ThemeMode = getThemePreference()) {
  return LIVE_THEMES.has(pref)
}

export function isVideoLiveTheme(pref: ThemeMode = getThemePreference()) {
  return VIDEO_LIVE_THEMES.has(pref)
}

export function isShopTheme(pref: ThemeMode = getThemePreference()) {
  return pref in SHOP_THEME_CLASS
}

export function getLiveAmbientVariant(
  pref: ThemeMode = getThemePreference(),
): LiveAmbientVariant {
  switch (pref) {
    case 'live-sky':
      return 'sky'
    case 'live-market':
      return 'market'
    case 'live-city':
      return 'city'
    case 'live-streets':
      return 'streets'
    default:
      return 'floor'
  }
}

/**
 * Apply theme mode to <html>:
 * - `dark` class when the skin needs a dark base
 * - `live-theme` for any Live atmosphere (motion-on)
 * - `theme-*` class for shop skins
 */
export function applyTheme(mode: ThemeMode = getThemePreference()) {
  const pref = migrateTheme(mode)
  const resolved = resolveTheme(pref)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved === 'dark' ? 'dark' : 'light'
  root.classList.toggle('live-theme', isLiveTheme(pref))
  for (const cls of ALL_SHOP_CLASSES) {
    root.classList.remove(cls)
  }
  // Drop retired shop classes if still present from older sessions
  root.classList.remove('theme-slate', 'theme-paper')
  if (isShopTheme(pref)) {
    const shopClass = SHOP_THEME_CLASS[pref as keyof typeof SHOP_THEME_CLASS]
    if (shopClass) root.classList.add(shopClass)
  }
  root.dataset.theme = pref
  localStorage.setItem(THEME_KEY, pref)
}

export function setThemePreference(mode: ThemeMode) {
  localStorage.setItem(THEME_KEY, mode)
  applyTheme(mode)
  // Live atmospheres always keep motion on
  if (isLiveTheme(mode)) {
    localStorage.setItem(AMBIENT_KEY, '1')
    document.documentElement.classList.remove('ambient-off')
  }
  return mode
}

/**
 * Shell cycle: Light → Dark → Live City → Light.
 * Shop + other live skins jump back to Light (full gallery is in Settings).
 */
export function toggleTheme() {
  const current = getThemePreference()
  const next: ThemeMode =
    current === 'light' ? 'dark' : current === 'dark' ? 'live-city' : 'light'
  setThemePreference(next)
  return resolveTheme(next)
}

export function getAmbientEnabled() {
  if (isLiveTheme()) return true
  const stored = localStorage.getItem(AMBIENT_KEY)
  if (stored === '0') return false
  return true
}

export function setAmbientEnabled(on: boolean) {
  // Live atmospheres always keep motion
  if (isLiveTheme()) {
    localStorage.setItem(AMBIENT_KEY, '1')
    document.documentElement.classList.remove('ambient-off')
    return true
  }
  localStorage.setItem(AMBIENT_KEY, on ? '1' : '0')
  document.documentElement.classList.toggle('ambient-off', !on)
  return on
}

export function applyAmbient() {
  document.documentElement.classList.toggle('ambient-off', !getAmbientEnabled())
}

export function getDensity(): DensityMode {
  return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable'
}

export function setDensity(mode: DensityMode) {
  localStorage.setItem(DENSITY_KEY, mode)
  document.documentElement.classList.toggle('density-compact', mode === 'compact')
  return mode
}

export function applyDensity() {
  document.documentElement.classList.toggle(
    'density-compact',
    getDensity() === 'compact',
  )
}

export function applyAllPreferences() {
  applyTheme()
  applyAmbient()
  applyDensity()
}
