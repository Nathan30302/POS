import { Building2, CarFront, Check, Sparkles, Store, Sun, Moon, Trees, Waves } from 'lucide-react'
import type { ThemeMode, ThemeOption } from '@/lib/theme'

const THEME_ICONS: Partial<Record<ThemeMode, typeof Sun>> = {
  light: Sun,
  dark: Moon,
  forest: Trees,
  midnight: Moon,
  coastal: Waves,
  ember: Sparkles,
  'live-sky': Sparkles,
  'live-market': Store,
  'live-city': Building2,
  'live-streets': CarFront,
}

/** Theme swatch card used by Settings appearance. */
export function SettingsThemePickCard({
  option,
  selected,
  onSelect,
}: {
  option: ThemeOption
  selected: boolean
  onSelect: () => void
}) {
  const Icon = THEME_ICONS[option.value] ?? Sparkles
  const hasVideo = Boolean(option.videoSrc && option.previewSrc)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group overflow-hidden rounded-2xl border text-left transition duration-200 active:scale-[0.98] ${
        selected
          ? 'border-royal shadow-lg shadow-royal/15 ring-2 ring-royal/40'
          : 'border-line hover:border-royal/45 hover:shadow-md'
      }`}
    >
      <div
        className="relative h-28 overflow-hidden sm:h-32"
        style={{ background: option.swatchCss }}
      >
        {hasVideo ? (
          <>
            <img
              src={option.previewSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <video
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-focus-visible:opacity-100"
              src={option.videoSrc}
              poster={option.previewSrc}
              muted
              loop
              playsInline
              preload="metadata"
              onMouseEnter={(e) => {
                void e.currentTarget.play().catch(() => undefined)
              }}
              onMouseLeave={(e) => {
                e.currentTarget.pause()
                e.currentTarget.currentTime = 0
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-black/10" />
          </>
        ) : null}
        <div
          className="absolute bottom-3 left-3 right-10 rounded-xl border border-white/20 p-2.5 shadow-md backdrop-blur-[2px]"
          style={{ background: option.cardCss }}
        >
          <div className="mb-1.5 h-1.5 w-10 rounded-full bg-[#888]/40" />
          <div className="h-1 w-16 rounded-full bg-[#888]/25" />
        </div>
        <span
          className="absolute bottom-3 right-3 h-3.5 w-9 rounded-full shadow-sm"
          style={{ background: option.accentCss }}
        />
        {option.livePulse ? (
          <span className="live-pulse-dot absolute left-3 top-3 z-[1] h-2.5 w-2.5 rounded-full bg-teal shadow-[0_0_8px_rgba(45,212,191,0.7)]" />
        ) : null}
        {selected ? (
          <span className="absolute right-2.5 top-2.5 z-[1] flex h-6 w-6 items-center justify-center rounded-full bg-royal text-white shadow-md">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        ) : null}
      </div>
      <div className="space-y-1 bg-card px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Icon className="h-3.5 w-3.5 shrink-0 text-royal" />
          {option.label}
        </p>
        <p className="text-[11px] leading-snug text-ink-soft">{option.blurb}</p>
      </div>
    </button>
  )
}
