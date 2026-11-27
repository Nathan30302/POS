import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

type Props = {
  value: number
  /** Absolute threshold treated as flat (default 0.5). */
  flatAt?: number
  suffix?: string
  className?: string
}

export function DeltaBadge({
  value,
  flatAt = 0.5,
  suffix = '%',
  className = '',
}: Props) {
  if (value > flatAt) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 ${className}`}
      >
        <TrendingUp className="h-3.5 w-3.5" />
        +{value}
        {suffix}
      </span>
    )
  }
  if (value < -flatAt) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-600 dark:text-red-400 ${className}`}
      >
        <TrendingDown className="h-3.5 w-3.5" />
        {value}
        {suffix}
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-bold text-ink-soft ${className}`}
    >
      <Minus className="h-3.5 w-3.5" />
      flat
    </span>
  )
}
