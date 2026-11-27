/**
 * Lightweight predictive helpers from completed-sale series.
 * Not ML — transparent trend + moving average for Command / Pulse.
 */

export type DayPoint = { date: string; revenue: number; tickets?: number }

export type RevenueForecast = {
  days: number
  projectedRevenue: number
  daily: Array<{ date: string; projected: number }>
  method: 'weighted_ma' | 'insufficient_data'
  confidence: 'low' | 'medium' | 'high'
  note: string
  avgDaily7: number
  trendPct: number
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}

/** Weighted 7-day MA with mild linear tilt from first vs second half. */
export function forecastRevenue(
  series: DayPoint[],
  horizonDays = 7,
): RevenueForecast {
  const cleaned = series
    .map((p) => ({
      date: p.date,
      revenue: Number.isFinite(p.revenue) ? Math.max(0, p.revenue) : 0,
    }))
    .filter((p) => p.date)

  if (cleaned.length < 3) {
    return {
      days: horizonDays,
      projectedRevenue: 0,
      daily: [],
      method: 'insufficient_data',
      confidence: 'low',
      note: 'Need at least 3 days of sales history for a forecast.',
      avgDaily7: 0,
      trendPct: 0,
    }
  }

  const last7 = cleaned.slice(-7)
  const weights = last7.map((_, i) => i + 1)
  const wSum = weights.reduce((a, b) => a + b, 0)
  const avg =
    last7.reduce((s, p, i) => s + p.revenue * weights[i], 0) / wSum

  const mid = Math.floor(last7.length / 2)
  const first = last7.slice(0, mid)
  const second = last7.slice(mid)
  const avgFirst =
    first.reduce((s, p) => s + p.revenue, 0) / Math.max(1, first.length)
  const avgSecond =
    second.reduce((s, p) => s + p.revenue, 0) / Math.max(1, second.length)
  const trendPct =
    avgFirst > 0
      ? Number((((avgSecond - avgFirst) / avgFirst) * 100).toFixed(1))
      : avgSecond > 0
        ? 100
        : 0

  // Cap daily tilt so a spike day doesn't explode the week
  const dailyTilt = Math.max(-0.08, Math.min(0.08, trendPct / 100 / 7))
  const daily: Array<{ date: string; projected: number }> = []
  const anchor = cleaned[cleaned.length - 1]?.date
    ? new Date(cleaned[cleaned.length - 1].date + 'T12:00:00Z')
    : new Date()

  let total = 0
  for (let i = 1; i <= horizonDays; i++) {
    const d = new Date(anchor)
    d.setUTCDate(d.getUTCDate() + i)
    const projected = Number(
      Math.max(0, avg * (1 + dailyTilt * i)).toFixed(2),
    )
    total += projected
    daily.push({ date: ymd(d), projected })
  }

  const nonzero = last7.filter((p) => p.revenue > 0).length
  const confidence: RevenueForecast['confidence'] =
    nonzero >= 6 && Math.abs(trendPct) < 40
      ? 'high'
      : nonzero >= 4
        ? 'medium'
        : 'low'

  return {
    days: horizonDays,
    projectedRevenue: Number(total.toFixed(2)),
    daily,
    method: 'weighted_ma',
    confidence,
    note:
      confidence === 'low'
        ? 'Sparse recent sales — treat as a rough guide, not a target.'
        : `Based on weighted last ${last7.length} days${
            Math.abs(trendPct) >= 5
              ? ` · trend ${trendPct > 0 ? '+' : ''}${trendPct}%`
              : ''
          }.`,
    avgDaily7: Number(avg.toFixed(2)),
    trendPct,
  }
}

export type CohortSnapshot = {
  customersWithSales30: number
  repeatCustomers30: number
  repeatRate: number
  newCustomers30: number
  avgSpendRepeat: number
  avgSpendNew: number
  note: string
}

/** Repeat vs one-time buyers in a 30-day completed-sale window. */
export function computeCohorts(
  sales: Array<{ customerId: string | null; total: number; createdAt: Date }>,
  firstSeenByCustomer: Map<string, Date>,
  windowStart: Date,
): CohortSnapshot {
  const byCustomer = new Map<string, { tickets: number; spend: number }>()
  for (const s of sales) {
    if (!s.customerId) continue
    const row = byCustomer.get(s.customerId) || { tickets: 0, spend: 0 }
    row.tickets += 1
    row.spend += s.total
    byCustomer.set(s.customerId, row)
  }

  let repeat = 0
  let newCount = 0
  let spendRepeat = 0
  let spendNew = 0
  let ticketsRepeat = 0
  let ticketsNew = 0

  for (const [id, row] of byCustomer) {
    const first = firstSeenByCustomer.get(id)
    const isNew = !first || first >= windowStart
    if (row.tickets >= 2) {
      repeat += 1
      spendRepeat += row.spend
      ticketsRepeat += row.tickets
    }
    if (isNew) {
      newCount += 1
      spendNew += row.spend
      ticketsNew += row.tickets
    }
  }

  const n = byCustomer.size
  const repeatRate = n > 0 ? Number(((repeat / n) * 100).toFixed(1)) : 0

  return {
    customersWithSales30: n,
    repeatCustomers30: repeat,
    repeatRate,
    newCustomers30: newCount,
    avgSpendRepeat:
      ticketsRepeat > 0
        ? Number((spendRepeat / ticketsRepeat).toFixed(2))
        : 0,
    avgSpendNew:
      ticketsNew > 0 ? Number((spendNew / ticketsNew).toFixed(2)) : 0,
    note:
      n === 0
        ? 'Attach customers on Sell to unlock repeat-buyer insights.'
        : `${repeatRate}% of tagged buyers returned in 30 days.`,
  }
}
