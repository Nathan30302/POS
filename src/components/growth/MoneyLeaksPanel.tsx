import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatZMW } from '@/lib/money'
import { LeakCard, type MoneyLeakItem } from './LeakCard'

type Props = {
  leaks: MoneyLeakItem[]
  /** Sum of estimated leak amounts when provided by API. */
  leakRiskAmount?: number
  /** Compact nested layout (e.g. Command side column). */
  compact?: boolean
  /** Extra footer link target. */
  moreHref?: string
  moreLabel?: string
  className?: string
}

export function MoneyLeaksPanel({
  leaks,
  leakRiskAmount,
  compact = false,
  moreHref = '/app/insights',
  moreLabel = 'Open Pulse',
  className = '',
}: Props) {
  const risk =
    leakRiskAmount ??
    leaks.reduce((s, l) => s + (typeof l.amount === 'number' ? l.amount : 0), 0)
  const critical = leaks.filter((l) => l.severity === 'critical').length

  return (
    <section className={`nx-card overflow-hidden p-0 ${className}`}>
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-300">
                Profit shield
              </p>
              <h3 className="font-display text-lg font-bold text-ink">
                Money leaks
              </h3>
              <p className="mt-0.5 text-xs text-ink-soft">
                Profit + integrity risks — discounts, voids, stock drops, thin
                margins
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-bold tabular-nums text-ink">
              {risk > 0 ? formatZMW(risk) : '—'}
            </p>
            <p className="text-[11px] text-ink-soft">
              {leaks.length === 0
                ? 'No leaks flagged'
                : `${leaks.length} signal${leaks.length === 1 ? '' : 's'}${
                    critical > 0 ? ` · ${critical} critical` : ''
                  }`}
            </p>
          </div>
        </div>
      </div>

      <div className={`space-y-2.5 ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'}`}>
        {leaks.length === 0 ? (
          <p className="rounded-xl bg-emerald-500/10 px-4 py-6 text-center text-sm text-ink-soft">
            Shield looks clean. Keep ringing sales — Pulse will flag new leaks
            as patterns appear.
          </p>
        ) : (
          leaks.map((leak) => (
            <LeakCard key={leak.id} leak={leak} compact={compact} />
          ))
        )}
      </div>

      {moreHref ? (
        <div className="border-t border-line px-5 py-3 text-right sm:px-6">
          <Link
            to={moreHref}
            className="text-xs font-semibold text-royal hover:underline"
          >
            {moreLabel} →
          </Link>
        </div>
      ) : null}
    </section>
  )
}
