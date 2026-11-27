import { useEffect, useRef, useState } from 'react'

type Clip = 'shop-floor' | 'checkout'

const CLIPS: Record<
  Clip,
  { src: string; poster: string; label: string }
> = {
  'shop-floor': {
    src: '/media/supermarket-floor-pexels.mp4?v=pexels-busy-aisle-39240097',
    poster: '/media/supermarket-floor-pexels.jpg?v=pexels-busy-aisle-39240097',
    label: 'Supermarket floor',
  },
  checkout: {
    src: '/media/supermarket-checkout-pexels.mp4?v=pexels-till-1',
    poster: '/media/supermarket-checkout-pexels.jpg?v=pexels-till-1',
    label: 'Supermarket checkout',
  },
}

/** Live retail background — poster first, video only while on-screen. */
export function RealBusinessVideo({
  clip = 'shop-floor',
  dim = 0.55,
  showLabel = false,
  scrim = 'dim',
}: {
  clip?: Clip
  dim?: number
  showLabel?: boolean
  /** cinematic: page supplies its own scrim so the floor stays visible */
  scrim?: 'dim' | 'cinematic'
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [ready, setReady] = useState(false)
  const [inView, setInView] = useState(true)
  /** Defer mp4 until after first paint so poster + fonts win the network */
  const [armed, setArmed] = useState(false)
  const asset = CLIPS[clip]

  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio > 0.08),
      { rootMargin: '80px', threshold: [0, 0.08, 0.25] },
    )
    io.observe(root)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const w = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number
      cancelIdleCallback?: (id: number) => void
    }
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(() => setArmed(true), { timeout: 900 })
      return () => w.cancelIdleCallback?.(id)
    }
    const t = window.setTimeout(() => setArmed(true), 280)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.muted = true
    el.defaultMuted = true
    el.playsInline = true

    const play = () => {
      if (!inView || document.visibilityState === 'hidden') {
        el.pause()
        return
      }
      void el.play().then(() => setReady(true)).catch(() => undefined)
    }

    const onVis = () => play()
    play()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      el.pause()
    }
  }, [clip, inView])

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <img
        src={asset.poster}
        alt=""
        decoding="async"
        fetchPriority="high"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          ready && inView && armed ? 'opacity-0' : 'opacity-100'
        }`}
      />
      {inView && armed ? (
        <video
          ref={videoRef}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            ready ? 'opacity-100' : 'opacity-0'
          }`}
          src={asset.src}
          poster={asset.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
        />
      ) : null}
      {scrim === 'dim' ? (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, rgba(7,13,28,${dim * 0.85}) 0%, rgba(7,13,28,${dim}) 45%, rgba(7,13,28,${Math.min(0.92, dim + 0.25)}) 100%)`,
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(7,13,28,0.45)_100%)]" />
        </>
      ) : null}
      {showLabel ? (
        <p className="absolute bottom-4 left-4 z-[1] rounded-lg border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70 backdrop-blur">
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {asset.label}
        </p>
      ) : null}
    </div>
  )
}
