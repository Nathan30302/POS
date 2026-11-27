import { useEffect, useRef, useState } from 'react'
import {
  LIVE_VIDEO_CLIPS,
  type LiveVideoClip,
} from '@/lib/theme'

export type { LiveVideoClip }

/**
 * Full-bleed looping video behind app chrome for Live City / Live Streets.
 * Assets: `LIVE_VIDEO_CLIPS` in `src/lib/theme.ts` → files under `/public/themes/`.
 * Dark scrim keeps `bg-card` / Sell UI readable.
 */
export function LiveVideoAtmosphere({
  clip,
  dim,
}: {
  clip: LiveVideoClip
  /** Override scrim strength (0–1). Higher = darker / more readable. */
  dim?: number
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [ready, setReady] = useState(false)
  const asset = LIVE_VIDEO_CLIPS[clip]
  const [src, setSrc] = useState(asset.src)
  const scrim = dim ?? asset.dim

  useEffect(() => {
    setReady(false)
    setSrc(asset.src)
  }, [clip, asset.src])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.muted = true
    el.defaultMuted = true
    el.playsInline = true
    const play = () => {
      void el
        .play()
        .then(() => setReady(true))
        .catch(() => undefined)
    }
    play()
    const onVis = () => {
      if (document.visibilityState === 'visible') play()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [src])

  return (
    <div
      className="live-video-atmosphere pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <img
        src={asset.poster}
        alt=""
        className={`absolute inset-0 h-full w-full scale-105 object-cover transition-opacity duration-700 ${
          ready ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full scale-105 object-cover transition-opacity duration-700 ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
        src={src}
        poster={asset.poster}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onError={() => {
          if (src !== asset.fallback) setSrc(asset.fallback)
        }}
      />
      {/* Readable scrim — keeps Sell / cards clear over moving film */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgba(4,8,18,${scrim * 0.88}) 0%, rgba(4,8,18,${scrim}) 42%, rgba(4,8,18,${Math.min(0.94, scrim + 0.22)}) 100%)`,
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(4,8,18,0.5)_100%)]" />
    </div>
  )
}
