/** Punchy counter beeps via Web Audio (no sound files). */

let ctx: AudioContext | null = null

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(
  freq: number,
  durationMs: number,
  gain = 0.12,
  type: OscillatorType = 'square',
) {
  const audio = getCtx()
  if (!audio) return
  const osc = audio.createOscillator()
  const amp = audio.createGain()
  osc.type = type
  osc.frequency.value = freq
  osc.connect(amp)
  amp.connect(audio.destination)
  const now = audio.currentTime
  amp.gain.setValueAtTime(gain, now)
  amp.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000)
  osc.start(now)
  osc.stop(now + durationMs / 1000 + 0.03)
}

/** Call once on tap so beeps aren’t blocked by the browser. */
export function unlockAudio() {
  const audio = getCtx()
  if (!audio) return
  // Tiny silent blip to fully unlock on iOS
  tone(40, 10, 0.0001, 'sine')
}

/** Sharp ShopRite-style till “TING” — instant and loud */
export function playScanBeep() {
  tone(1800, 40, 0.28, 'square')
  window.setTimeout(() => tone(2400, 70, 0.22, 'square'), 32)
}

/** Bigger chime after payment */
export function playSuccessChime() {
  tone(660, 80, 0.1, 'sine')
  window.setTimeout(() => tone(880, 90, 0.11, 'sine'), 70)
  window.setTimeout(() => tone(1175, 160, 0.12, 'sine'), 150)
}

/** Clear error buzz */
export function playErrorBuzz() {
  tone(180, 120, 0.14, 'sawtooth')
  window.setTimeout(() => tone(140, 160, 0.12, 'sawtooth'), 100)
}

/** Soft connect confirmation when phone links */
export function playLinkBeep() {
  tone(520, 60, 0.08, 'sine')
  window.setTimeout(() => tone(780, 90, 0.09, 'sine'), 70)
}
