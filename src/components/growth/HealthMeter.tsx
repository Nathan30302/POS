import { HeartPulse } from 'lucide-react'

type Props = {
  score: number
  size?: 'sm' | 'md' | 'lg'
  label?: string
  hint?: string
  className?: string
}

const sizes = {
  sm: { box: 'h-20 w-20', r: 34, stroke: 7, score: 'text-xl', label: 'text-[9px]' },
  md: { box: 'h-28 w-28', r: 42, stroke: 8, score: 'text-3xl', label: 'text-[10px]' },
  lg: { box: 'h-32 w-32', r: 46, stroke: 9, score: 'text-4xl', label: 'text-[11px]' },
} as const

function scoreTone(score: number) {
  if (score >= 80) return { stroke: '#13b8a6', copy: 'Strong' }
  if (score >= 60) return { stroke: '#3563e9', copy: 'Steady' }
  if (score >= 40) return { stroke: '#d97706', copy: 'Needs care' }
  return { stroke: '#dc2626', copy: 'At risk' }
}

export function HealthMeter({
  score,
  size = 'md',
  label = 'Health',
  hint,
  className = '',
}: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const s = sizes[size]
  const c = 2 * Math.PI * s.r
  const offset = c - (clamped / 100) * c
  const tone = scoreTone(clamped)

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className={`relative ${s.box}`}>
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={s.r}
            fill="none"
            stroke="currentColor"
            strokeWidth={s.stroke}
            className="text-line"
          />
          <circle
            cx="50"
            cy="50"
            r={s.r}
            fill="none"
            stroke={tone.stroke}
            strokeWidth={s.stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className={`font-display font-bold text-ink ${s.score}`}>{clamped}</p>
          <p
            className={`font-semibold uppercase tracking-wider text-ink-soft ${s.label}`}
          >
            {label}
          </p>
        </div>
      </div>
      {(hint || tone.copy) && (
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
            <HeartPulse className="h-4 w-4 text-teal" />
            {tone.copy}
          </p>
          {hint ? (
            <p className="mt-1 max-w-[14rem] text-xs leading-relaxed text-ink-soft">
              {hint}
            </p>
          ) : (
            <p className="mt-1 text-xs text-ink-soft">
              Shop health from sales, stock, and margin signals.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
