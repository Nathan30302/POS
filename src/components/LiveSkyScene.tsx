import type { CSSProperties } from 'react'

/** Cinematic live sky: clouds, birds, plane, kite, city silhouette. Pure CSS/SVG. */
export function LiveSkyScene({ variant = 'night' }: { variant?: 'night' | 'dusk' }) {
  const night = variant === 'night'

  return (
    <div
      className={`live-sky pointer-events-none absolute inset-0 overflow-hidden ${
        night ? 'live-sky-night' : 'live-sky-dusk'
      }`}
      aria-hidden
    >
      <div className="live-sky-wash absolute inset-0" />
      <div className="live-stars absolute inset-0" />

      <div className="live-cloud live-cloud-a" />
      <div className="live-cloud live-cloud-b" />
      <div className="live-cloud live-cloud-c" />

      <svg className="live-birds absolute inset-0 h-full w-full" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice">
        <g className="bird-flock flock-1">
          <path className="bird" d="M0 0 q8 -6 16 0 q-8 4 -16 0" />
          <path className="bird" d="M28 8 q7 -5 14 0 q-7 3 -14 0" />
          <path className="bird" d="M18 -12 q6 -4 12 0 q-6 3 -12 0" />
        </g>
        <g className="bird-flock flock-2">
          <path className="bird" d="M0 0 q10 -7 20 0 q-10 5 -20 0" />
          <path className="bird" d="M32 10 q8 -5 16 0 q-8 4 -16 0" />
          <path className="bird" d="M14 -14 q7 -5 14 0 q-7 3 -14 0" />
          <path className="bird" d="M44 -4 q6 -4 12 0 q-6 3 -12 0" />
        </g>
        <g className="bird-flock flock-3">
          <path className="bird" d="M0 0 q9 -6 18 0 q-9 4 -18 0" />
          <path className="bird" d="M24 6 q7 -5 14 0 q-7 3 -14 0" />
        </g>
      </svg>

      <div className="live-plane">
        <div className="live-plane-body" />
        <div className="live-plane-trail" />
      </div>

      <div className="live-kite">
        <div className="live-kite-diamond" />
        <div className="live-kite-tail" />
      </div>

      <svg
        className="live-city absolute bottom-0 left-0 w-full"
        viewBox="0 0 1200 180"
        preserveAspectRatio="none"
      >
        <path
          fill="currentColor"
          className="text-black/50"
          d="M0 180 V110 H40 V70 H70 V110 H110 V50 H160 V110 H190 V80 H230 V40 H280 V90 H320 V60 H360 V120 H410 V75 H450 V45 H500 V100 H540 V70 H590 V35 H640 V95 H690 V55 H740 V85 H790 V40 H850 V100 H900 V65 H950 V90 H1000 V50 H1050 V110 H1100 V80 H1140 V120 H1200 V180 Z"
        />
        <g className="city-lights">
          {Array.from({ length: 28 }).map((_, i) => (
            <rect
              key={i}
              className="city-window"
              x={40 + i * 40 + (i % 3) * 6}
              y={70 + (i % 5) * 12}
              width="4"
              height="6"
              rx="0.5"
              style={{ animationDelay: `${(i % 7) * 0.45}s` }}
            />
          ))}
        </g>
      </svg>

      <div className="live-haze absolute inset-x-0 bottom-0 h-40" />
    </div>
  )
}

export function LiveAmbient() {
  return (
    <div className="live-ambient pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="ambient-orb ambient-orb-a" />
      <div className="ambient-orb ambient-orb-b" />
      <div className="ambient-orb ambient-orb-c" />
      <div className="ambient-dust">
        {Array.from({ length: 28 }).map((_, i) => (
          <span key={i} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
    </div>
  )
}
