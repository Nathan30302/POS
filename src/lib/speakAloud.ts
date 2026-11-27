/**
 * Phone-safe speechSynthesis.
 *
 * iOS Safari only starts speech inside the tap, drops utterances that are not
 * retained, ignores speak() right after cancel() on some versions, and pauses
 * the synth without firing onend. Android Chrome drops a speak() issued in the
 * same turn as cancel(). Chunks stay short so iOS does not cut a sentence off.
 */

export function speechSupported() {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  )
}

let voicesPrimed = false

/** Load the voice list. On iOS it stays empty until a user gesture. */
export function primeSpeechVoices() {
  if (!speechSupported() || voicesPrimed) return
  voicesPrimed = true
  const synth = window.speechSynthesis
  const load = () => {
    try {
      synth.getVoices()
    } catch {
      // ignore
    }
  }
  load()
  synth.addEventListener('voiceschanged', load)
}

export function chunkSpeech(text: string, max = 110): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  const chunks: string[] = []
  let buf = ''
  for (const word of clean.split(' ')) {
    if (!word) continue
    if (word.length > max) {
      if (buf) chunks.push(buf)
      for (let i = 0; i < word.length; i += max) {
        chunks.push(word.slice(i, i + max))
      }
      buf = ''
      continue
    }
    const next = buf ? `${buf} ${word}` : word
    const sentenceDone = /[.!?]$/.test(buf) && next.length > 70
    if (buf && (next.length > max || sentenceDone)) {
      chunks.push(buf)
      buf = word
    } else {
      buf = next
    }
  }
  if (buf) chunks.push(buf)
  return chunks
}

const NATURAL_VOICE =
  /samantha|daniel|karen|moira|serena|allison|ava\b|susan|martha|arthur|gordon|google uk english female|google us english|microsoft (aria|jenny|libby|guy|sonia)/i

function pickVoice(): SpeechSynthesisVoice | null {
  let voices: SpeechSynthesisVoice[] = []
  try {
    voices = window.speechSynthesis.getVoices()
  } catch {
    return null
  }
  if (!voices.length) return null
  const english = voices.filter(
    (v) => /^en([-_]|$)/i.test(v.lang) || /english/i.test(v.name),
  )
  const pool = english.length ? english : voices
  const local = pool.filter((v) => v.localService)
  const prefer = local.length ? local : pool
  const named = prefer.find((v) => NATURAL_VOICE.test(v.name))
  if (named) return named
  return (
    prefer.find((v) => /en-GB/i.test(v.lang)) ||
    prefer.find((v) => /en-US/i.test(v.lang)) ||
    prefer.find((v) => /^en/i.test(v.lang)) ||
    prefer[0] ||
    null
  )
}

function fallbackLang() {
  const nav = typeof navigator !== 'undefined' ? navigator.language : ''
  return /^en/i.test(nav) ? nav : 'en-US'
}

function isIos() {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

type Handlers = {
  onEnd?: () => void
  onError?: (message: string) => void
}

type Session = {
  id: number
  chunks: string[]
  index: number
  token: number
  heard: boolean
  chunkStarted: number
  handlers: Handlers
}

let session: Session | null = null
let sessionSeq = 0
let chunkToken = 0
/** Safari garbage-collects utterances that aren’t referenced. */
let retained: SpeechSynthesisUtterance[] = []
let keepAlive = 0

function hold(utter: SpeechSynthesisUtterance) {
  retained.push(utter)
  const bag = window as Window & { __nexoraSpeech?: SpeechSynthesisUtterance[] }
  bag.__nexoraSpeech = retained
}

function messageFor(code: string) {
  if (code === 'not-allowed') {
    return 'This phone blocked voice. Tap Play again. On iPhone, turn the Silent switch off and raise the volume.'
  }
  if (code === 'audio-busy') {
    return 'Audio is busy. Close other sound and tap Play again.'
  }
  return 'No sound yet. On iPhone, flip the Silent switch off (side, above the volume buttons), raise the volume, and tap Play again.'
}

function clearKeepAlive() {
  if (!keepAlive) return
  window.clearInterval(keepAlive)
  keepAlive = 0
}

function finish(sess: Session, kind: 'end' | 'error', message?: string) {
  if (!session || session.id !== sess.id) return
  session = null
  clearKeepAlive()
  retained = []
  const bag = window as Window & { __nexoraSpeech?: SpeechSynthesisUtterance[] }
  bag.__nexoraSpeech = []
  if (kind === 'error') {
    try {
      window.speechSynthesis.cancel()
    } catch {
      // ignore
    }
  }
  if (kind === 'end') sess.handlers.onEnd?.()
  else if (message) sess.handlers.onError?.(message)
}

export function stopSpeaking() {
  session = null
  chunkToken += 1
  clearKeepAlive()
  retained = []
  const bag = window as Window & { __nexoraSpeech?: SpeechSynthesisUtterance[] }
  bag.__nexoraSpeech = []
  try {
    window.speechSynthesis?.cancel()
  } catch {
    // ignore
  }
}

function speakChunk(sess: Session, index: number) {
  if (!session || session.id !== sess.id) return
  const text = sess.chunks[index]
  if (!text) {
    finish(sess, 'end')
    return
  }
  const token = ++chunkToken
  sess.index = index
  sess.token = token
  sess.chunkStarted = Date.now()
  const synth = window.speechSynthesis
  const utter = new SpeechSynthesisUtterance(text)
  hold(utter)
  utter.rate = 0.96
  utter.pitch = 1
  utter.volume = 1
  const voice = pickVoice()
  utter.lang = voice?.lang || fallbackLang()
  if (voice) utter.voice = voice
  const alive = () => session && session.id === sess.id && sess.token === token
  utter.onstart = () => {
    if (!alive()) return
    sess.heard = true
  }
  utter.onboundary = () => {
    if (!alive()) return
    sess.heard = true
  }
  utter.onend = () => {
    if (!alive()) return
    try {
      synth.resume()
    } catch {
      // ignore
    }
    speakChunk(sess, index + 1)
  }
  utter.onerror = (ev) => {
    if (!alive()) return
    const code = ev.error || ''
    if (code === 'canceled' || code === 'interrupted') return
    finish(sess, 'error', messageFor(code))
  }
  try {
    if (synth.paused) synth.resume()
    synth.resume()
    synth.speak(utter)
    // iOS often queues the line and stays paused unless nudged inside the tap.
    if (isIos()) {
      synth.pause()
      synth.resume()
    }
  } catch {
    finish(sess, 'error', messageFor(''))
  }
}

function armKeepAlive(sess: Session) {
  clearKeepAlive()
  keepAlive = window.setInterval(() => {
    if (!session || session.id !== sess.id) {
      clearKeepAlive()
      return
    }
    const synth = window.speechSynthesis
    try {
      if (synth.paused || synth.speaking) synth.resume()
    } catch {
      // ignore
    }
    const text = sess.chunks[sess.index] || ''
    const budget = Math.min(12000, 1600 + text.length * 75)
    if (
      sess.chunkStarted &&
      Date.now() - sess.chunkStarted > budget &&
      sess.token === chunkToken
    ) {
      speakChunk(sess, sess.index + 1)
    }
  }, 350)
}

export function speakAloud(
  text: string,
  handlers: Handlers = {},
): { ok: true } | { ok: false; reason: string } {
  if (!speechSupported()) {
    return {
      ok: false,
      reason: 'Voice isn’t available in this browser. Read the steps on the page.',
    }
  }
  const chunks = chunkSpeech(text)
  if (!chunks.length) {
    return { ok: false, reason: 'Nothing to read on this page.' }
  }

  const synth = window.speechSynthesis
  primeSpeechVoices()
  try {
    synth.getVoices()
  } catch {
    // ignore
  }
  try {
    synth.resume()
  } catch {
    // ignore
  }

  const id = ++sessionSeq
  const sess: Session = {
    id,
    chunks,
    index: 0,
    token: 0,
    heard: false,
    chunkStarted: 0,
    handlers,
  }
  const busy = Boolean(synth.speaking || synth.pending || session)
  session = sess
  retained = []

  const begin = () => {
    if (!session || session.id !== id) return
    speakChunk(sess, 0)
    armKeepAlive(sess)
  }

  // First speak() stays in the tap (required on iOS). Delay only when we
  // must cancel something already queued — Chrome otherwise eats the new line.
  if (busy) {
    try {
      synth.cancel()
    } catch {
      // ignore
    }
    if (isIos()) begin()
    else window.setTimeout(begin, 80)
  } else {
    begin()
  }

  return { ok: true }
}
