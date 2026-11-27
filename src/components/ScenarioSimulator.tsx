import { useMemo, useState } from 'react'
import { Calculator } from 'lucide-react'
import { formatZMW } from '@/lib/money'

type Props = {
  baselineRevenue30: number
  /** Gross margin as a ratio (0–1), matching Pulse `margin30`. */
  baselineMargin30: number
  avgTicket30: number
}

export function ScenarioSimulator({
  baselineRevenue30,
  baselineMargin30,
  avgTicket30,
}: Props) {
  const [pricePct, setPricePct] = useState(0)
  const [volumePct, setVolumePct] = useState(0)
  const [costPct, setCostPct] = useState(0)
  const [discountPct, setDiscountPct] = useState(0)

  const marginRatio = Math.max(0, Math.min(1, baselineMargin30))
  const baselineMarginPct = marginRatio * 100

  const result = useMemo(() => {
    const rev =
      baselineRevenue30 *
      (1 + pricePct / 100) *
      (1 + volumePct / 100) *
      (1 - discountPct / 100)
    // margin30 is already a ratio (e.g. 0.32), not a percent
    const baseCostShare = Math.max(0, 1 - marginRatio)
    const costShare = Math.min(
      0.95,
      Math.max(0.05, baseCostShare * (1 + costPct / 100)),
    )
    const profit = rev * (1 - costShare)
    const margin = rev > 0 ? (profit / rev) * 100 : 0
    const ticket =
      avgTicket30 * (1 + pricePct / 100) * (1 - discountPct / 100)
    const deltaRev = rev - baselineRevenue30
    const baseProfit = baselineRevenue30 * marginRatio
    const deltaProfit = profit - baseProfit
    return { rev, profit, margin, ticket, deltaRev, deltaProfit }
  }, [
    baselineRevenue30,
    marginRatio,
    avgTicket30,
    pricePct,
    volumePct,
    costPct,
    discountPct,
  ])

  return (
    <section className="nx-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-royal/10 text-royal">
          <Calculator className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-royal">
            Scenario coach
          </p>
          <h3 className="font-display text-lg font-semibold text-ink">
            What if we change price, volume, or cost?
          </h3>
          <p className="mt-1 text-sm text-ink-soft">
            Local estimate from your last 30-day Pulse — not a live forecast.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {(
          [
            {
              label: 'Price change',
              value: pricePct,
              set: setPricePct,
              min: -20,
              max: 30,
            },
            {
              label: 'Volume change',
              value: volumePct,
              set: setVolumePct,
              min: -30,
              max: 40,
            },
            {
              label: 'Cost change',
              value: costPct,
              set: setCostPct,
              min: -15,
              max: 25,
            },
            {
              label: 'Extra discount',
              value: discountPct,
              set: setDiscountPct,
              min: 0,
              max: 20,
            },
          ] as const
        ).map((row) => (
          <label key={row.label} className="block space-y-1.5">
            <span className="flex justify-between text-xs font-semibold text-ink">
              {row.label}
              <span className="tabular-nums text-royal">
                {row.value > 0 ? '+' : ''}
                {row.value}%
              </span>
            </span>
            <input
              type="range"
              min={row.min}
              max={row.max}
              step={1}
              value={row.value}
              onChange={(e) => row.set(Number(e.target.value))}
              className="w-full accent-[#3563E9]"
            />
          </label>
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-surface px-3 py-3">
          <p className="text-[11px] text-ink-soft">Projected revenue</p>
          <p className="font-display text-lg font-bold text-ink">
            {formatZMW(result.rev)}
          </p>
          <p className="text-[11px] text-ink-soft">
            {result.deltaRev >= 0 ? '+' : ''}
            {formatZMW(result.deltaRev)} vs baseline
          </p>
        </div>
        <div className="rounded-xl bg-surface px-3 py-3">
          <p className="text-[11px] text-ink-soft">Projected profit</p>
          <p className="font-display text-lg font-bold text-ink">
            {formatZMW(result.profit)}
          </p>
          <p className="text-[11px] text-ink-soft">
            {result.deltaProfit >= 0 ? '+' : ''}
            {formatZMW(result.deltaProfit)} vs baseline
          </p>
        </div>
        <div className="rounded-xl bg-surface px-3 py-3">
          <p className="text-[11px] text-ink-soft">Margin</p>
          <p className="font-display text-lg font-bold text-ink">
            {result.margin.toFixed(1)}%
          </p>
          <p className="text-[11px] text-ink-soft">
            was {baselineMarginPct.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl bg-surface px-3 py-3">
          <p className="text-[11px] text-ink-soft">Avg ticket</p>
          <p className="font-display text-lg font-bold text-ink">
            {formatZMW(result.ticket)}
          </p>
          <p className="text-[11px] text-ink-soft">
            was {formatZMW(avgTicket30)}
          </p>
        </div>
      </div>
    </section>
  )
}
