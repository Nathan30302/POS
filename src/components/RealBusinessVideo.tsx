import { useEffect, useRef, useState } from 'react'

type Clip = 'shop-floor' | 'checkout'

const CLIPS: Record<
  Clip,
  { src: string; poster: string; label: string }
> = {
  'shop-floor': {
    src: '/media/shop-floor.mp4',
    poster: '/media/shop-floor.jpg',
    label: 'Live shop floor',
  },
  checkout: {
    src: '/media/checkout-live.mp4',
    poster: '/media/checkout-live.jpg',
    label: 'Live checkout',
  },
}

/** Real filmed shop / commerce footage (not CGI). Muted looping background. */
export function RealBusinessVideo({
  clip = 'shop-floor',
  dim = 0.55,
}: {
  clip?: Clip
  dim?: number
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [ready, setReady] = useState(false)
  const asset = CLIPS[clip]

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.muted = true
    el.defaultMuted = true
    el.playsInline = true
    const play = () => {
      void el.play().then(() => setReady(true)).catch(() => undefined)
    }
    play()
    const onVis = () => {
      if (document.visibilityState === 'visible') play()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [clip])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <img
        src={asset.poster}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          ready ? 'opacity-0' : 'opacity-100'
        }`}
      />
      <video
        ref={videoRef}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
          ready ? 'opacity-100' : 'opacity-0'
        }`}
        src={asset.src}
        poster={asset.poster}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg, rgba(7,13,28,${dim * 0.85}) 0%, rgba(7,13,28,${dim}) 45%, rgba(7,13,28,${Math.min(0.92, dim + 0.25)}) 100%)`,
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(7,13,28,0.45)_100%)]" />
      <p className="absolute bottom-4 left-4 z-[1] rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70 backdrop-blur">
        <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
        {asset.label} · real footage
      </p>
    </div>
  )
}
