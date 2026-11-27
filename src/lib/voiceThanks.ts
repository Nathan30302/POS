/** Optional spoken thank-you after a completed sale (Settings module). */

import { speakAloud, speechSupported } from '@/lib/speakAloud'

const ENABLED_KEY = 'nexora-voice-thanks'
const PHRASE_KEY = 'nexora-voice-thanks-phrase'

export const DEFAULT_THANKS_PHRASE = 'Thank you for shopping with us.'

export function getVoiceThanksEnabled() {
  return localStorage.getItem(ENABLED_KEY) === '1'
}

export function setVoiceThanksEnabled(on: boolean) {
  localStorage.setItem(ENABLED_KEY, on ? '1' : '0')
  return on
}

export function getVoiceThanksPhrase() {
  const stored = localStorage.getItem(PHRASE_KEY)?.trim()
  return stored || DEFAULT_THANKS_PHRASE
}

export function setVoiceThanksPhrase(phrase: string) {
  const next = phrase.trim() || DEFAULT_THANKS_PHRASE
  localStorage.setItem(PHRASE_KEY, next)
  return next
}

export function voiceThanksSupported() {
  return speechSupported()
}

/** Speak the configured thank-you line (no-op if module is off). */
export function speakSaleThanks() {
  if (!getVoiceThanksEnabled() || !voiceThanksSupported()) return
  speakAloud(getVoiceThanksPhrase())
}

/** Preview from Settings — must run inside the Preview tap. */
export function previewSaleThanks() {
  if (!voiceThanksSupported()) return false
  return speakAloud(getVoiceThanksPhrase()).ok
}
