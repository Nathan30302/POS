import { useEffect, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { usableImageUrl } from '@/lib/productPhoto'

const CATEGORY_TONE: Record<string, string> = {
  Writing: 'from-sky-500/35 to-blue-800/55',
  Paper: 'from-amber-400/35 to-orange-800/50',
  Filing: 'from-slate-400/35 to-slate-800/55',
  'Art Supplies': 'from-rose-400/35 to-orange-800/50',
  Office: 'from-teal-400/35 to-emerald-900/55',
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || '')
    .join('')
}

type Props = {
  src?: string | null
  name: string
  category?: string
  /** Shown on the empty state, e.g. "Add photo". */
  hint?: string
  className?: string
  imgClassName?: string
}

/** Product picture, or a labelled empty state when the URL is missing or broken. */
export function ProductPhoto({
  src,
  name,
  category,
  hint,
  className = '',
  imgClassName = '',
}: Props) {
  const url = usableImageUrl(src)
  const [broken, setBroken] = useState(false)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    setBroken(false)
    setLoaded(false)
  }, [url])

  const tone = CATEGORY_TONE[category || ''] || 'from-royal/30 to-teal/45'
  const show = Boolean(url) && !broken
  const waiting = show && !loaded
  const showHint = Boolean(hint) && !waiting

  return (
    <div className={`relative overflow-hidden bg-surface ${className}`}>
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br ${tone} px-3 ${
          show && loaded ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold text-white">
          {initials(name) || 'NX'}
        </span>
        {showHint && hint ? (
          <span className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white">
            <ImagePlus className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {hint}
          </span>
        ) : category ? (
          <span className="mt-2 max-w-full truncate px-2 text-[10px] font-semibold uppercase tracking-wider text-white/80">
            {category}
          </span>
        ) : null}
      </div>
      {show ? (
        <img
          src={url}
          alt=""
          className={`relative h-full w-full object-cover transition-opacity duration-200 ${
            loaded ? 'opacity-100' : 'opacity-0'
          } ${imgClassName}`}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setBroken(true)}
        />
      ) : null}
    </div>
  )
}
