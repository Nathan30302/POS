import { useCallback, useEffect, useRef, useState } from 'react'

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionEventLike = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function speechDictationSupported() {
  return Boolean(getSpeechRecognition())
}

type Options = {
  lang?: string
  /** Keep mic open until stop (better for long product descriptions). */
  continuous?: boolean
  onFinal: (transcript: string) => void
}

type ResultRow = ArrayLike<{ transcript: string; confidence?: number }> & {
  isFinal: boolean
  length: number
  0: { transcript: string; confidence?: number }
}

/**
 * Browser speech dictation (Chrome / Edge / Safari).
 * Tap mic → speak → final transcript is returned.
 */
export function useSpeechDictation({
  lang = 'en-GB',
  continuous = false,
  onFinal,
}: Options) {
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal
  const continuousRef = useRef(continuous)
  continuousRef.current = continuous
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const supported = speechDictationSupported()

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop()
    } catch {
      // ignore
    }
    recognitionRef.current = null
    setListening(false)
  }, [])

  const start = useCallback((opts?: { continuous?: boolean }) => {
    const Ctor = getSpeechRecognition()
    if (!Ctor) {
      setError('Voice not supported in this browser. Use Chrome on phone or laptop.')
      return
    }

    setError('')
    setInterim('')
    stop()

    const recognition = new Ctor()
    recognition.lang = lang
    recognition.continuous = opts?.continuous ?? continuousRef.current
    recognition.interimResults = true
    recognition.maxAlternatives = 3

    recognition.onresult = (event) => {
      let finalText = ''
      let live = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const row = event.results[i] as unknown as ResultRow
        // Pick highest-confidence alternative when available
        let best = row[0]?.transcript || ''
        let bestConf = row[0]?.confidence ?? 0
        for (let a = 1; a < row.length; a += 1) {
          const alt = row[a]
          const conf = alt?.confidence ?? 0
          if (conf > bestConf && alt?.transcript) {
            best = alt.transcript
            bestConf = conf
          }
        }
        if (row.isFinal) finalText += best
        else live += best
      }
      if (live) setInterim(live)
      if (finalText.trim()) {
        setInterim('')
        onFinalRef.current(finalText.trim())
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') {
        setListening(false)
        return
      }
      setError(
        event.error === 'not-allowed'
          ? 'Microphone blocked — allow mic access and try again.'
          : `Voice error: ${event.error}`,
      )
      setListening(false)
    }

    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setListening(true)
    } catch {
      setError('Could not start microphone. Tap again.')
      setListening(false)
    }
  }, [lang, stop])

  useEffect(() => () => stop(), [stop])

  return {
    supported,
    listening,
    interim,
    error,
    start,
    stop,
    toggle: () => (listening ? stop() : start()),
  }
}
