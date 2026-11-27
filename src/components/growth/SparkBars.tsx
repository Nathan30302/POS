type SparkPoint = {
  key: string
  label: string
  value: number
  title?: string
}

type Props = {
  points: SparkPoint[]
  heightClass?: string
  minBarPct?: number
  formatValue?: (value: number) => string
  className?: string
}

export function SparkBars({
  points,
  heightClass = 'h-44',
  minBarPct = 6,
  formatValue,
  className = '',
}: Props) {
  const max = Math.max(1, ...points.map((p) => p.value))

  return (
    <div className={`flex items-end gap-2 sm:gap-3 ${heightClass} ${className}`}>
      {points.map((p) => {
        const pct = Math.max(minBarPct, Math.round((p.value / max) * 100))
        const tip =
          p.title ||
          (formatValue ? `${p.label}: ${formatValue(p.value)}` : `${p.label}: ${p.value}`)
        return (
          <div
            key={p.key}
            className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-2"
          >
            <div className="relative flex min-h-0 flex-1 items-end">
              <div
                className="w-full rounded-t-xl bg-gradient-to-t from-royal to-teal shadow-sm shadow-royal/20 transition group-hover:brightness-110"
                style={{ height: `${pct}%` }}
                title={tip}
              />
            </div>
            <span className="truncate text-center text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
              {p.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
