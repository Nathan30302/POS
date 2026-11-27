import { Flame, Snowflake, TrendingDown, TrendingUp } from 'lucide-react'

type Props = {
  name: string
  recentQty: number
  priorQty: number
  changePct: number
  direction: 'up' | 'down'
}

export function MomentumRow({
  name,
  recentQty,
  priorQty,
  changePct,
  direction,
}: Props) {
  const up = direction === 'up'
  const Icon = up ? TrendingUp : TrendingDown
  const Mood = up ? Flame : Snowflake
  const pct = Number.isFinite(changePct) ? Math.round(changePct) : 0

  return (
    <li
      className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm ${
        up
          ? 'bg-emerald-500/10'
          : 'bg-amber-500/10'
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Mood
          className={`h-3.5 w-3.5 shrink-0 ${
            up ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'
          }`}
        />
        <span className="truncate font-medium text-ink">{name}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-[11px] tabular-nums text-ink-soft">
          {priorQty}→{recentQty}
        </span>
        <span
          className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            up
              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-500/20 text-amber-800 dark:text-amber-200'
          }`}
        >
          <Icon className="h-3 w-3" />
          {pct > 0 ? '+' : ''}
          {pct}%
        </span>
      </span>
    </li>
  )
}
