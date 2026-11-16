import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Flame,
  Lightbulb,
  Minus,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import { formatZMW } from '@/lib/money'

type DashboardPayload = {
  summary: {
    revenueToday: number
    transactionsToday: number
    grossProfitToday: number
    revenueMonth: number
    profitMonth: number
    ticketsMonth: number
    revenueLastMonth: number
    profitLastMonth: number
    ticketsLastMonth: number
    revenueMom: number
    profitMom: number
    ticketsMom: number
    avgTicketMonth: number
    expensesMonth: number
    inventoryValue: number
    productCount: number
    lowStockCount: number
    customerCount: number
    paymentBreakdown: Record<string, number>
    liveAt: string
  }
  months: Array<{
    key: string
    label: string
    revenue: number
    profit: number
    tickets: number
  }>
  rising: Array<{
    name: string
    recentQty: number
    priorQty: number
    delta: number
    changePct: number
  }>
  falling: Array<{
    name: string
    recentQty: number
    priorQty: number
    delta: number
    changePct: number
  }>
  topProducts: Array<{ name: string; qty: number; revenue: number }>
  journal: Array<{
    id: string
    tone: 'growth' | 'risk' | 'focus' | 'win'
    title: string
    body: string
    action?: string
  }>
  lowStock: Array<{ id: string; name: string; stockQuantity: number }>
  recentSales: Array<{
    id: string
    total: number
    paymentMethod: string
    createdAt: string
  }>
}

function Delta({ value }: { value: number }) {
  if (value > 0.5) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
        <ArrowUpRight className="h-3.5 w-3.5" />
        +{value}%
      </span>
    )
  }
  if (value < -0.5) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-bold text-red-600">
        <ArrowDownRight className="h-3.5 w-3.5" />
        {value}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-bold text-ink-soft">
      <Minus className="h-3.5 w-3.5" />
      flat
    </span>
  )
}

const toneStyles: Record<string, string> = {
  growth: 'border-emerald-500/25 bg-emerald-500/10',
  win: 'border-teal/30 bg-teal/10',
  risk: 'border-amber-500/30 bg-amber-500/10',
  focus: 'border-royal/25 bg-royal/10',
}

const toneIcons = {
  growth: TrendingUp,
  win: Flame,
  risk: AlertTriangle,
  focus: Lightbulb,
} as const

export function OwnerDashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState('')
  const [clock, setClock] = useState(() => new Date())

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const next = await api<DashboardPayload>('/business/dashboard')
        if (!cancelled) setData(next)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard')
        }
      }
    }
    void load()
    const id = window.setInterval(() => void load(), 30000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  if (error) {
    return (
      <div className="nx-card p-6 text-sm text-danger">
        {error}. Is the NEXORA API running on port 4000?
      </div>
    )
  }

  if (!data) {
    return <p className="text-sm text-ink-soft">Loading command center…</p>
  }

  const { summary } = data
  const maxMonthRev = Math.max(1, ...data.months.map((m) => m.revenue))
  const payEntries = Object.entries(summary.paymentBreakdown || {})
  const payTotal = payEntries.reduce((s, [, v]) => s + v, 0) || 1

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-line bg-[#0b1224] text-white shadow-xl">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 top-0 h-56 w-56 rounded-full bg-royal/40 blur-3xl interior-orb" />
          <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-teal/30 blur-3xl interior-orb-delay" />
          <div className="absolute inset-0 opacity-30 landing-grid" />
        </div>
        <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Live command
              </span>
              <span className="text-white/50">
                {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <h2 className="font-display mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Grow the shop
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300">
              Month-to-month money, product momentum, and a growth journal from your
              real sales — not just a till screen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/app/checkout">
              <Button type="button" className="bg-[#3563E9] hover:bg-[#2f58d4]">
                <Store className="h-4 w-4" />
                Open Sell
              </Button>
            </Link>
            <Link
              to="/app/insights"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
            >
              <Sparkles className="h-4 w-4" />
              Open Pulse
            </Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'This month revenue',
            value: formatZMW(summary.revenueMonth),
            delta: summary.revenueMom,
            hint: `vs ${formatZMW(summary.revenueLastMonth)} last month`,
            icon: Wallet,
          },
          {
            label: 'Gross profit MTD',
            value: formatZMW(summary.profitMonth),
            delta: summary.profitMom,
            hint: `${summary.ticketsMonth} sales this month`,
            icon: TrendingUp,
          },
          {
            label: 'Today',
            value: formatZMW(summary.revenueToday),
            delta: null as number | null,
            hint: `${summary.transactionsToday} tickets · profit ${formatZMW(summary.grossProfitToday)}`,
            icon: Store,
          },
          {
            label: 'Avg ticket',
            value: formatZMW(summary.avgTicketMonth),
            delta: summary.ticketsMom,
            hint: `${summary.customerCount} customers on file`,
            icon: Users,
          },
        ].map((card) => (
          <div key={card.label} className="nx-card relative overflow-hidden p-5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-ink-soft">{card.label}</p>
              <card.icon className="h-4 w-4 text-royal" />
            </div>
            <p className="font-display mt-2 text-3xl font-bold text-ink">
              {card.value}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {card.delta !== null ? <Delta value={card.delta} /> : null}
              <p className="text-xs text-ink-soft">{card.hint}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="nx-card p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-bold">6-month money</h3>
              <p className="text-xs text-ink-soft">Revenue by month · growth trail</p>
            </div>
            <Delta value={summary.revenueMom} />
          </div>
          <div className="flex h-44 items-end gap-2 sm:gap-3">
            {data.months.map((m) => {
              const pct = Math.max(8, Math.round((m.revenue / maxMonthRev) * 100))
              return (
                <div
                  key={m.key}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"
                >
                  <div className="relative flex min-h-0 flex-1 items-end">
                    <div
                      className="w-full rounded-t-xl bg-gradient-to-t from-royal to-teal shadow-sm shadow-royal/20"
                      style={{ height: `${pct}%` }}
                      title={`${m.label}: ${formatZMW(m.revenue)}`}
                    />
                  </div>
                  <span className="truncate text-center text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                    {m.label}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        <section className="nx-card overflow-hidden p-0">
          <div className="border-b border-line px-5 py-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-royal" />
              <h3 className="font-display text-lg font-bold">Growth journal</h3>
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              Suggestions from your numbers — what to push, fix, or protect
            </p>
          </div>
          <ul className="max-h-[280px] space-y-0 overflow-y-auto">
            {data.journal.map((entry) => {
              const Icon = toneIcons[entry.tone] || Lightbulb
              return (
                <li
                  key={entry.id}
                  className={`border-b border-line px-5 py-4 last:border-b-0 ${toneStyles[entry.tone] || ''}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-card/80 text-royal">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{entry.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                        {entry.body}
                      </p>
                      {entry.action ? (
                        <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-royal">
                          <Target className="h-3 w-3" />
                          {entry.action}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="nx-card p-5">
          <h3 className="font-semibold text-ink">Buying more</h3>
          <p className="mt-1 text-xs text-ink-soft">Last 7 days vs week before</p>
          <ul className="mt-4 space-y-2">
            {data.rising.length === 0 ? (
              <li className="text-sm text-ink-soft">Not enough sales yet.</li>
            ) : (
              data.rising.map((p) => (
                <li
                  key={p.name}
                  className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-3 py-2 text-sm"
                >
                  <span className="truncate pr-2">{p.name}</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    {p.priorQty}→{p.recentQty}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="nx-card p-5">
          <h3 className="font-semibold text-ink">Buying less</h3>
          <p className="mt-1 text-xs text-ink-soft">Cooling demand · opportunity</p>
          <ul className="mt-4 space-y-2">
            {data.falling.length === 0 ? (
              <li className="text-sm text-ink-soft">No cool-downs detected.</li>
            ) : (
              data.falling.map((p) => (
                <li
                  key={p.name}
                  className="flex items-center justify-between rounded-xl bg-amber-500/10 px-3 py-2 text-sm"
                >
                  <span className="truncate pr-2">{p.name}</span>
                  <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                    <ArrowDownRight className="h-3.5 w-3.5" />
                    {p.priorQty}→{p.recentQty}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="nx-card p-5">
          <h3 className="font-semibold text-ink">This month’s winners</h3>
          <p className="mt-1 text-xs text-ink-soft">Focus shelf + staff pitch here</p>
          <ul className="mt-4 space-y-2">
            {data.topProducts.map((p, i) => (
              <li
                key={p.name}
                className="flex items-center justify-between rounded-xl bg-surface/80 px-3 py-2 text-sm"
              >
                <span>
                  <span className="mr-2 text-xs font-bold text-royal">#{i + 1}</span>
                  {p.name}
                </span>
                <strong>{formatZMW(p.revenue)}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="nx-card p-5">
          <h3 className="font-semibold">How people paid today</h3>
          <ul className="mt-4 space-y-3">
            {payEntries.length === 0 ? (
              <li className="text-sm text-ink-soft">No payments yet today.</li>
            ) : (
              payEntries.map(([method, amount]) => (
                <li key={method}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-ink-soft">
                      {method.replaceAll('_', ' ')}
                    </span>
                    <strong>{formatZMW(amount)}</strong>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-royal to-teal"
                      style={{ width: `${(amount / payTotal) * 100}%` }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
          <p className="mt-4 text-xs text-ink-soft">
            Month expenses: {formatZMW(summary.expensesMonth)} · Stock value{' '}
            {formatZMW(summary.inventoryValue)}
          </p>
        </section>

        <section className="nx-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warn" />
            <h3 className="font-semibold">Low stock ({summary.lowStockCount})</h3>
          </div>
          {data.lowStock.length === 0 ? (
            <p className="text-sm text-ink-soft">Stock levels look healthy.</p>
          ) : (
            <ul className="space-y-2">
              {data.lowStock.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between rounded-xl bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/30"
                >
                  <span>{p.name}</span>
                  <strong>{p.stockQuantity} left</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="nx-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Recent ledger</h3>
            <Link
              to="/app/sales"
              className="inline-flex items-center gap-1 text-sm font-semibold text-royal"
            >
              All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {data.recentSales.length === 0 ? (
              <li className="py-3 text-sm text-ink-soft">
                No sales yet. Open Sell and ring the first one.
              </li>
            ) : (
              data.recentSales.map((sale) => (
                <li key={sale.id} className="flex justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {sale.paymentMethod.replaceAll('_', ' ')}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {new Date(sale.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <p className="font-semibold">{formatZMW(sale.total)}</p>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  )
}
