import { useId } from 'react'

/** Geometric N — royal into shop teal. Shared by the landing lockup and auth chrome. */
export function NexoraMark({ className }: { className?: string }) {
  const gradId = `nexora-mark-${useId().replace(/:/g, '')}`
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="6"
          y1="4"
          x2="58"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#3563E9" />
          <stop offset="0.48" stopColor="#2A6AE0" />
          <stop offset="1" stopColor="#13B8A6" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradId})`}
        d="M6 58V6h13.2L46.8 39.4V6H58v52H44.8L17.2 24.6V58H6z"
      />
    </svg>
  )
}
