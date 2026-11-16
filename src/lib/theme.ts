const THEME_KEY = 'nexora-theme'
const AMBIENT_KEY = 'nexora-ambient'
const DENSITY_KEY = 'nexora-density'

export type ThemeMode = 'light' | 'dark' | 'system'
export type DensityMode = 'comfortable' | 'compact'

export function getThemePreference(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  return 'system'
}

export function resolveTheme(pref: ThemeMode = getThemePreference()): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return pref
}

/** @deprecated use getThemePreference / resolveTheme */
export function getTheme(): 'light' | 'dark' {
  return resolveTheme()
}

export function applyTheme(mode: ThemeMode | 'light' | 'dark' = getThemePreference()) {
  const pref = mode === 'light' || mode === 'dark' || mode === 'system' ? mode : 'system'
  const resolved = resolveTheme(pref === 'light' || pref === 'dark' || pref === 'system' ? pref : 'system')
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  if (pref === 'light' || pref === 'dark' || pref === 'system') {
    localStorage.setItem(THEME_KEY, pref)
  }
}

export function setThemePreference(mode: ThemeMode) {
  localStorage.setItem(THEME_KEY, mode)
  applyTheme(mode)
  return mode
}

export function toggleTheme() {
  const next = resolveTheme() === 'dark' ? 'light' : 'dark'
  setThemePreference(next)
  return next
}

export function getAmbientEnabled() {
  const stored = localStorage.getItem(AMBIENT_KEY)
  if (stored === '0') return false
  return true
}

export function setAmbientEnabled(on: boolean) {
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
