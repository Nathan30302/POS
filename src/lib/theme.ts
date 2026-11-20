const THEME_KEY = 'nexora-theme'
const AMBIENT_KEY = 'nexora-ambient'
const DENSITY_KEY = 'nexora-density'

/** Three distinct looks — Live is the motion-heavy floor skin. */
export type ThemeMode = 'light' | 'dark' | 'live'
export type DensityMode = 'comfortable' | 'compact'

function migrateTheme(raw: string | null): ThemeMode {
  if (raw === 'light' || raw === 'dark' || raw === 'live') return raw
  // Old "system" often looked identical to Light or Dark on the user's machine
  if (raw === 'system') return 'live'
  return 'light'
}

export function getThemePreference(): ThemeMode {
  return migrateTheme(localStorage.getItem(THEME_KEY))
}

export function resolveTheme(
  pref: ThemeMode = getThemePreference(),
): 'light' | 'dark' {
  // Live rides on the dark palette + live-theme motion classes
  return pref === 'light' ? 'light' : 'dark'
}

/** Resolved light/dark for icons — Live counts as dark. */
export function getTheme(): 'light' | 'dark' {
  return resolveTheme()
}

export function isLiveTheme(pref: ThemeMode = getThemePreference()) {
  return pref === 'live'
}

export function applyTheme(mode: ThemeMode = getThemePreference()) {
  const pref = migrateTheme(mode)
  const resolved = resolveTheme(pref)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.classList.toggle('live-theme', pref === 'live')
  localStorage.setItem(THEME_KEY, pref)
}

export function setThemePreference(mode: ThemeMode) {
  localStorage.setItem(THEME_KEY, mode)
  applyTheme(mode)
  // Live implies atmosphere on — that’s the point of the skin
  if (mode === 'live') {
    localStorage.setItem(AMBIENT_KEY, '1')
    document.documentElement.classList.remove('ambient-off')
  }
  return mode
}

/** Cycles Light → Dark → Live → Light so the header control hits every skin. */
export function toggleTheme() {
  const current = getThemePreference()
  const next: ThemeMode =
    current === 'light' ? 'dark' : current === 'dark' ? 'live' : 'light'
  setThemePreference(next)
  return resolveTheme(next)
}

export function getAmbientEnabled() {
  if (getThemePreference() === 'live') return true
  const stored = localStorage.getItem(AMBIENT_KEY)
  if (stored === '0') return false
  return true
}

export function setAmbientEnabled(on: boolean) {
  // Live theme always keeps atmosphere
  if (getThemePreference() === 'live') {
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
