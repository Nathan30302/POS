import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote } from 'lucide-react'
import { api } from '@/lib/api'
import { formatZMW } from '@/lib/money'
import type { CashShift } from '@/components/ShiftDrawerPanel'

export function ManagerShiftsCard() {
  const [shifts, setShifts] = useState<CashShift[]>([])

  useEffect(() => {
    let cancelled = false
    void api<{ shifts: CashShift[] }>('/shifts?limit=8')
      .then((data) => {
        if (!cancelled) setShifts(data.shifts)
      })
      .catch(() => {
        if (!cancelled) setShifts([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  const openCount = shifts.filter((s) => s.status === 'OPEN').length
  const shortages = shifts.filter(
    (s) => s.discrepancy != null && s.discrepancy < -1,
  )

  return (
    <section className="nx-card overflow-hidden p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-royal">
            Till
          </p>
          <h3 className="nx-section-title mt-0.5 flex items-center gap-2">
            <Banknote className="h-5 w-5 text-teal" />
            Cashier shifts
          </h3>
          <p className="mt-0.5 text-xs text-ink-soft">
            {openCount} open · declared vs expected on close
          </p>
        </div>
        <Link
          to="/app/audit?action=shift."
          className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold text-royal hover:bg-royal/5"
        >
          Shift audit
        </Link>
      </div>
      <ul className="divide-y divide-line">
        {shifts.length === 0 ? (
          <li className="px-4 py-5 text-sm text-ink-soft sm:px-5">
            No shifts yet — cashiers open a drawer on Sell.
          </li>
        ) : (
          shifts.slice(0, 6).map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-5"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {s.openedBy?.fullName || 'Cashier'}
                  {s.status === 'OPEN' ? (
                    <span className="ml-2 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
                      open
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-ink-soft">
                  Float {formatZMW(s.openingFloat)}
                  {s.expectedCash != null
                    ? ` · expected ${formatZMW(s.expectedCash)}`
                    : ''}
                  {s.declaredCash != null
                    ? ` · declared ${formatZMW(s.declaredCash)}`
                    : ''}
                </p>
              </div>
              {s.discrepancy != null && Math.abs(s.discrepancy) >= 1 ? (
                <span
                  className={`text-xs font-semibold ${
                    s.discrepancy < 0 ? 'text-danger' : 'text-amber-700'
                  }`}
                >
                  Δ {formatZMW(s.discrepancy)}
                </span>
              ) : s.status === 'CLOSED' ? (
                <span className="text-xs text-emerald-700 dark:text-emerald-300">
                  Balanced
                </span>
              ) : null}
            </li>
          ))
        )}
      </ul>
      {shortages.length > 0 ? (
        <p className="border-t border-line bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-900 dark:text-amber-100 sm:px-5">
          {shortages.length} recent shortage
          {shortages.length === 1 ? '' : 's'} — check Audit & alerts.
        </p>
      ) : null}
    </section>
  )
}
