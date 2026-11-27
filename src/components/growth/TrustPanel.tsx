import { Link } from 'react-router-dom'
import { Building2, ShieldAlert, ShieldCheck, UserRound } from 'lucide-react'
import { formatZMW } from '@/lib/money'

export type CashierTrustItem = {
  userId: string
  fullName: string
  tickets: number
  revenue: number
  discountTotal: number
  discountShare: number
  voidCount: number
  voidValue: number
  voidRate: number
  highDiscountTickets: number
  quickVoidCount?: number
  flag: 'ok' | 'watch' | 'alert'
  flagReason: string | null
}

export type BranchHealthItem = {
  branchId: string | null
  branchName: string
  tickets: number
  revenue: number
  discountTotal: number
  discountShare: number
  voidCount: number
  voidValue: number
  voidRate: number
  openConflicts: number
  flag: 'ok' | 'watch' | 'alert'
  flagReason: string | null
}

function FlagPill({ flag }: { flag: 'ok' | 'watch' | 'alert' }) {
  const cls =
    flag === 'alert'
      ? 'bg-red-500/15 text-danger'
      : flag === 'watch'
        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${cls}`}
    >
      {flag}
    </span>
  )
}

type Props = {
  cashiers?: CashierTrustItem[]
  branches?: BranchHealthItem[]
  openConflicts?: number
  compact?: boolean
}

export function TrustPanel({
  cashiers = [],
  branches = [],
  openConflicts = 0,
  compact = false,
}: Props) {
  const flagged = cashiers.filter((c) => c.flag !== 'ok')
  const branchFlagged = branches.filter((b) => b.flag !== 'ok')
  const topCashiers = (flagged.length ? flagged : cashiers).slice(
    0,
    compact ? 4 : 6,
  )
  const topBranches = branches.slice(0, compact ? 4 : 6)
  const clean = flagged.length === 0 && branchFlagged.length === 0

  return (
    <section className="nx-card overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-royal">
            Integrity
          </p>
          <h3 className="nx-section-title mt-0.5 flex items-center gap-2">
            {clean ? (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-amber-600" />
            )}
            Trust signals
          </h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            Voids soon after sale, high void rates, heavy discounts — 30 days.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/audit"
            className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-royal hover:bg-royal/5"
          >
            Audit
          </Link>
          {openConflicts > 0 ? (
            <Link
              to="/app/conflicts"
              className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200"
            >
              {openConflicts} conflict{openConflicts === 1 ? '' : 's'}
            </Link>
          ) : null}
        </div>
      </div>

      <div
        className={`grid gap-0 ${
          topBranches.length > 1 ? 'lg:grid-cols-2' : ''
        }`}
      >
        <div className="border-b border-line p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-soft">
            <UserRound className="h-3.5 w-3.5" />
            Cashiers
          </p>
          {topCashiers.length === 0 ? (
            <p className="text-sm text-ink-soft">No sales tagged yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {topCashiers.map((c) => (
                <li
                  key={c.userId}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-line/70 bg-surface/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{c.fullName}</p>
                      <FlagPill flag={c.flag} />
                    </div>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {c.tickets} sales · {formatZMW(c.revenue)}
                      {c.voidCount > 0
                        ? ` · ${c.voidCount} void${c.voidCount === 1 ? '' : 's'}`
                        : ''}
                      {(c.quickVoidCount || 0) > 0
                        ? ` · ${c.quickVoidCount} quick`
                        : ''}
                      {c.discountTotal > 0
                        ? ` · disc ${(c.discountShare * 100).toFixed(0)}%`
                        : ''}
                    </p>
                    {c.flagReason ? (
                      <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                        {c.flagReason}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    to={`/app/sales?soldById=${encodeURIComponent(c.userId)}`}
                    className="shrink-0 text-xs font-semibold text-royal hover:underline"
                  >
                    Ledger
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {topBranches.length > 0 ? (
          <div className="p-4 sm:p-5">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              <Building2 className="h-3.5 w-3.5" />
              Branches
            </p>
            <ul className="space-y-2.5">
              {topBranches.map((b) => (
                <li
                  key={b.branchId || 'none'}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-line/70 bg-surface/40 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ink">{b.branchName}</p>
                      <FlagPill flag={b.flag} />
                    </div>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {b.tickets} sales · {formatZMW(b.revenue)}
                      {b.voidCount > 0 ? ` · ${b.voidCount} voids` : ''}
                      {b.openConflicts > 0
                        ? ` · ${b.openConflicts} conflicts`
                        : ''}
                    </p>
                    {b.flagReason ? (
                      <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                        {b.flagReason}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  )
}
