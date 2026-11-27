import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Laptop,
  MousePointerClick,
  Pause,
  ShieldAlert,
  Smartphone,
  Volume2,
} from 'lucide-react'
import {
  GUIDE_CHAPTERS,
  type GuideChapter,
  type GuideDevice,
} from '@/lib/operatorGuide'
import { GUIDE_GLOSSARY } from '@/lib/guideGlossary'
import {
  filterGuideChapters,
  filterGuideGlossary,
  guideAudienceLabel,
} from '@/lib/guideAccess'
import { useAuth } from '@/context/AuthContext'
import {
  primeSpeechVoices,
  speakAloud,
  speechSupported,
  stopSpeaking,
} from '@/lib/speakAloud'

function preferredGuideDevice(): GuideDevice {
  if (typeof navigator === 'undefined') return 'desktop'
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
    ? 'phone'
    : 'desktop'
}

function ScreenShot({
  chapter,
  device,
}: {
  chapter: GuideChapter
  device: GuideDevice
}) {
  const src = chapter.screens[device]
  return (
    <figure className="overflow-hidden rounded-[var(--radius-xl)] border border-line bg-card shadow-[var(--shadow)]">
      <div
        className={`bg-surface ${
          device === 'phone'
            ? 'mx-auto flex max-w-[280px] justify-center py-3 sm:max-w-[320px]'
            : ''
        }`}
      >
        <img
          src={src}
          alt={`${chapter.title} on ${device}`}
          className={`w-full object-cover object-top ${
            device === 'phone'
              ? 'max-h-[520px] rounded-xl border border-line'
              : 'max-h-[420px]'
          }`}
          loading="lazy"
          decoding="async"
        />
      </div>
      <figcaption className="border-t border-line px-3.5 py-2.5 text-xs text-ink-soft">
        Real NEXORA screen · {device === 'phone' ? 'Phone' : 'Laptop'} ·{' '}
        {chapter.title}
      </figcaption>
    </figure>
  )
}

function buildVoiceScript(chapter: GuideChapter): string {
  const words = chapter.wordsOnScreen
    .map((w) => `${w.word} means ${w.means}`)
    .join('. ')
  const clicks = chapter.clicks
    .map((c, i) => `Step ${i + 1}. ${c}`)
    .join(' ')
  return [
    chapter.title,
    chapter.purpose,
    chapter.voice,
    words ? `Words you will see. ${words}` : '',
    clicks ? `Now the clicks. ${clicks}` : '',
    chapter.runningExample
      ? `Example while the shop is running. ${chapter.runningExample}`
      : '',
    chapter.tip ? `Tip. ${chapter.tip}` : '',
  ]
    .filter(Boolean)
    .join('. ')
}

type VoiceNote = { id: string; text: string; tone: 'info' | 'error' }

function useVoiceGuide() {
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const [note, setNote] = useState<VoiceNote | null>(null)
  const supported = speechSupported()

  useEffect(() => {
    primeSpeechVoices()
    return () => {
      stopSpeaking()
    }
  }, [])

  function speak(chapter: GuideChapter, sourceId: string) {
    // Must stay synchronous with the tap — iOS will not speak later.
    primeSpeechVoices()
    try {
      if (!speechSupported()) {
        setSpeakingId(null)
        setNote({
          id: sourceId,
          tone: 'error',
          text: 'Voice isn’t available in this browser. Read the steps below — they match the spoken guide.',
        })
        return
      }
      const result = speakAloud(buildVoiceScript(chapter), {
        onEnd: () => {
          setSpeakingId((current) => (current === chapter.id ? null : current))
          setNote({
            id: sourceId,
            tone: 'info',
            text: 'Finished.',
          })
        },
        onError: (message) => {
          setSpeakingId((current) => (current === chapter.id ? null : current))
          setNote({ id: sourceId, tone: 'error', text: message })
        },
      })
      if (!result.ok) {
        setSpeakingId(null)
        setNote({ id: sourceId, tone: 'error', text: result.reason })
        return
      }
      setSpeakingId(chapter.id)
      setNote({
        id: sourceId,
        tone: 'info',
        text: 'Playing on this phone. If it’s silent, turn off Silent mode and raise the volume.',
      })
    } catch {
      setSpeakingId(null)
      setNote({
        id: sourceId,
        tone: 'error',
        text: 'Voice didn’t start. Tap again.',
      })
    }
  }

  function stop() {
    stopSpeaking()
    setSpeakingId(null)
    setNote((current) =>
      current
        ? { ...current, tone: 'info', text: 'Voice stopped.' }
        : { id: 'listen', tone: 'info', text: 'Voice stopped.' },
    )
  }

  return { speakingId, speak, stop, note, supported }
}

/** Full documentation of the live app UI — screenshots + voice, not people videos. */
export function GuidePage({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const [device, setDevice] = useState<GuideDevice>(preferredGuideDevice)
  const { speakingId, speak, stop, note, supported } = useVoiceGuide()

  const chapters = useMemo(
    () => filterGuideChapters(GUIDE_CHAPTERS, user),
    [user],
  )
  const glossary = useMemo(
    () =>
      filterGuideGlossary(
        GUIDE_GLOSSARY,
        user,
        chapters.map((c) => c.id),
      ),
    [user, chapters],
  )
  const toc = useMemo(
    () => chapters.map((c) => ({ id: c.id, title: c.title, who: c.who })),
    [chapters],
  )
  const audience = guideAudienceLabel(user)

  const [active, setActive] = useState(chapters[0]?.id || 'daily')

  useEffect(() => {
    if (!chapters.some((c) => c.id === active)) {
      setActive(chapters[0]?.id || 'daily')
    }
  }, [chapters, active])

  const activeChapter = useMemo(
    () => chapters.find((c) => c.id === active) || chapters[0],
    [active, chapters],
  )

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash && chapters.some((c) => c.id === hash)) {
      setActive(hash)
      window.setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    }
  }, [chapters])

  const shell = (
    <div
      className={
        embedded
          ? 'space-y-6'
          : 'mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-10'
      }
    >
      {!embedded ? (
        <header className="space-y-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-teal transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            NEXORA
          </Link>
          <p className="nx-eyebrow">Operator guide</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            How to use NEXORA — daily guide
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-ink-soft sm:text-base">
            Written for someone who has never opened the app. Chapters are in
            learning order. Each one explains what the screen is for, what to
            click, and what the words mean. Press{' '}
            <strong className="font-semibold text-ink">Hear this chapter</strong>{' '}
            to listen while you look at the picture.
          </p>
          <p className="text-xs font-medium text-teal">{audience}</p>
        </header>
      ) : (
        <div>
          <p className="nx-eyebrow">Operator guide</p>
          <h2 className="font-display mt-1.5 text-2xl font-bold tracking-tight text-ink">
            How to use — daily guide
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Chapters in order. Start with “Your day, start to finish,” then the
            screens you can open.
          </p>
          <p className="mt-1.5 text-xs font-medium text-teal">{audience}</p>
        </div>
      )}

      <div className="rounded-2xl border border-teal/25 bg-teal/10 px-4 py-3.5 text-sm text-ink sm:px-5">
        <p className="text-xs font-bold uppercase tracking-wider text-teal">
          How to read this guide
        </p>
        <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-ink-soft">
          <li>
            Open <strong className="font-semibold text-ink">Chapter 1</strong>{' '}
            (Your day) — that is the whole loop.
          </li>
          <li>
            Then open only the chapters for screens you can see after login.
          </li>
          <li>
            In each chapter: overview → picture → numbered clicks → word meanings.
          </li>
          <li>
            Word list at the end is an appendix — look up a label anytime.
          </li>
        </ol>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          Show screens as
        </span>
        <button
          type="button"
          onClick={() => setDevice('desktop')}
          className={`nx-chip min-h-10 px-3 ${
            device === 'desktop' ? 'is-active' : ''
          }`}
          aria-pressed={device === 'desktop'}
        >
          <Laptop className="h-4 w-4" aria-hidden />
          Laptop
        </button>
        <button
          type="button"
          onClick={() => setDevice('phone')}
          className={`nx-chip min-h-10 px-3 ${
            device === 'phone' ? 'is-active' : ''
          }`}
          aria-pressed={device === 'phone'}
        >
          <Smartphone className="h-4 w-4" aria-hidden />
          Phone
        </button>
        <a
          href="/docs/NEXORA-Owner-Guide.pdf"
          className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:bg-brand-soft"
        >
          <BookOpen className="h-4 w-4" />
          PDF
        </a>
      </div>

      <nav
        aria-label="Guide contents"
        className="nx-card space-y-3 p-3 sm:p-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal">
              Contents
            </p>
            <p className="mt-0.5 text-sm font-semibold text-ink">
              {toc.length} chapters in learning order
            </p>
          </div>
          <a
            href="#glossary"
            className="text-xs font-semibold text-teal hover:underline"
          >
            Word meanings →
          </a>
        </div>
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {toc.map((item, index) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                onClick={() => setActive(item.id)}
                className={`flex min-h-11 items-start gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  active === item.id
                    ? 'bg-royal text-white'
                    : 'bg-surface text-ink hover:bg-brand-soft'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                    active === item.id
                      ? 'bg-white/20 text-white'
                      : 'bg-royal/10 text-royal'
                  }`}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold leading-snug">
                    {item.title}
                  </span>
                  <span
                    className={`mt-0.5 block text-[11px] ${
                      active === item.id ? 'text-white/75' : 'text-ink-soft'
                    }`}
                  >
                    {item.who}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {activeChapter ? (
        <div className="nx-card space-y-3 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-teal">
            Listening · Chapter{' '}
            {Math.max(
              1,
              chapters.findIndex((c) => c.id === activeChapter.id) + 1,
            )}{' '}
            · {activeChapter.title}
          </p>
          <p className="text-sm leading-relaxed text-ink-soft">
            {activeChapter.voice}
          </p>
          <div className="flex flex-wrap gap-2">
            {speakingId === activeChapter.id ? (
              <button
                type="button"
                onClick={stop}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-white"
              >
                <Pause className="h-4 w-4" />
                Stop voice
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  speak(activeChapter, `listen:${activeChapter.id}`)
                }
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep"
              >
                <Volume2 className="h-4 w-4" />
                Hear this chapter
              </button>
            )}
          </div>
          {note?.id === `listen:${activeChapter.id}` ? (
            <p
              className={`text-xs font-medium ${
                note.tone === 'error' ? 'text-danger' : 'text-ink-soft'
              }`}
              role="status"
            >
              {note.text}
            </p>
          ) : (
            <p className="text-xs text-ink-soft">
              {supported
                ? 'Plays through the phone speaker. Silent mode and a low volume mute it.'
                : 'This browser can’t speak. The steps below are the same script.'}
            </p>
          )}
        </div>
      ) : null}

      <div className="space-y-12 sm:space-y-16">
        {chapters.map((ch, index) => (
          <section
            key={ch.id}
            id={ch.id}
            className="scroll-mt-24 space-y-5 border-t border-line pt-8 first:border-t-0 first:pt-0"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
                  Chapter {index + 1} · {ch.who}
                </p>
                <h3 className="font-display mt-1 text-2xl font-bold tracking-tight text-ink">
                  {ch.title}
                </h3>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
                  {ch.purpose}
                </p>
              </div>
              <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
                <button
                  type="button"
                  onClick={() => {
                    setActive(ch.id)
                    if (speakingId === ch.id) stop()
                    else speak(ch, ch.id)
                  }}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-semibold text-ink hover:bg-brand-soft"
                >
                  {speakingId === ch.id ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                  {speakingId === ch.id ? 'Stop voice' : 'Hear this chapter'}
                </button>
                {note?.id === ch.id ? (
                  <p
                    className={`max-w-xs text-xs font-medium ${
                      note.tone === 'error' ? 'text-danger' : 'text-ink-soft'
                    }`}
                    role="status"
                  >
                    {note.text}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                1 · How this screen works
              </h4>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">
                {ch.voice}
              </p>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-ink-soft">
                2 · Look at the real screen
              </h4>
              <ScreenShot chapter={ch} device={device} />
            </div>

            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink-soft">
                <MousePointerClick className="h-3.5 w-3.5" />
                3 · What to click (in order)
              </h4>
              <ol className="mt-2 space-y-2">
                {ch.clicks.map((step, i) => (
                  <li
                    key={`${ch.id}-click-${i}`}
                    className="flex gap-3 rounded-xl border border-line bg-card px-3.5 py-3 text-sm text-ink"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-royal/10 text-xs font-bold text-royal">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                4 · Words on this screen
              </h4>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {ch.wordsOnScreen.map((w) => (
                  <li
                    key={w.word}
                    className="rounded-xl border border-line bg-card px-3.5 py-3 text-sm"
                  >
                    <p className="font-semibold text-ink">{w.word}</p>
                    <p className="mt-0.5 leading-relaxed text-ink-soft">
                      {w.means}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                5 · Parts of the page
              </h4>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ch.parts.map((p) => (
                  <li
                    key={p.name}
                    className="rounded-xl border border-line bg-card px-3.5 py-3 text-sm"
                  >
                    <p className="font-semibold text-ink">{p.name}</p>
                    <p className="mt-0.5 leading-relaxed text-ink-soft">
                      {p.meaning}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {ch.runningExample ? (
              <div className="rounded-xl border border-teal/25 bg-teal/10 px-4 py-3 text-sm text-ink">
                <p className="text-xs font-bold uppercase tracking-wider text-teal">
                  6 · Example while the shop is running
                </p>
                <p className="mt-1.5 leading-relaxed">{ch.runningExample}</p>
              </div>
            ) : null}

            {ch.theftSignals?.length ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Watch for — something may be off
                </p>
                <ul className="mt-2 space-y-1.5 text-sm text-ink">
                  {ch.theftSignals.map((w) => (
                    <li key={w} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {ch.tip ? (
              <p className="flex gap-2 text-sm text-ink-soft">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                <span>
                  <strong className="font-semibold text-ink">Tip. </strong>
                  {ch.tip}
                </span>
              </p>
            ) : null}
          </section>
        ))}
      </div>

      <section
        id="glossary"
        className="scroll-mt-24 space-y-4 rounded-2xl border border-line bg-card p-4 sm:p-5"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
            Appendix
          </p>
          <h3 className="font-display mt-1 text-xl font-bold tracking-tight text-ink">
            Word meanings
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            Alphabetical-style lookup for labels you see in the app. Read the
            chapters above first — this list is for quick checks.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {glossary.map((g) => (
            <div
              key={g.term}
              className="rounded-xl border border-line bg-surface px-3.5 py-3"
            >
              <p className="font-semibold text-ink">{g.term}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">
                {g.means}
              </p>
              <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wider text-teal">
                {g.where}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="rounded-2xl border border-line bg-card p-5 sm:p-6">
        <p className="font-display text-lg font-semibold text-ink">
          {chapters.some((c) => c.id === 'command')
            ? 'Train a cashier today'
            : 'Practice your day'}
        </p>
        <ul className="mt-3 grid gap-2 text-sm text-ink-soft sm:grid-cols-2">
          {(chapters.some((c) => c.id === 'command')
            ? [
                'Start with “Your day, start to finish” + voice',
                'Open Sell together → Open shift → one cash Complete',
                'Show Command Money leaks / Critical cards',
                'Practice one Void on Ledger with a reason',
                'Leave them with: voids always need a reason',
              ]
            : [
                'Start with “Your day, start to finish” + voice',
                'Open Sell → Open shift → one cash Complete',
                'If Wi‑Fi dies: wait for Queued — do not retype the sale',
                'Ask a manager before voids or big discounts',
                'Close shift and count the drawer at the end',
              ]
          ).map((item) => (
            <li key={item} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {chapters.some((c) => c.id === 'sell') ? (
            <Link
              to="/app/checkout"
              className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep"
            >
              Open Sell
            </Link>
          ) : null}
          {chapters.some((c) => c.id === 'command') ? (
            <Link
              to="/app/dashboard"
              className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-semibold text-ink hover:bg-brand-soft"
            >
              Open Command
            </Link>
          ) : null}
        </div>
      </footer>
    </div>
  )

  if (embedded) return shell

  return (
    <div className="min-h-dvh bg-surface text-ink">
      <div className="border-b border-line bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 font-display text-sm font-bold"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-royal to-teal text-[10px] text-white">
              NX
            </span>
            NEXORA Guide
          </Link>
          <Link
            to="/login"
            className="text-sm font-semibold text-teal hover:underline"
          >
            Sign in to practice
          </Link>
        </div>
      </div>
      {shell}
    </div>
  )
}
