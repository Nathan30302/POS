import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BookOpen,
  Building2,
  Flame,
  HeartPulse,
  Snowflake,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import {
  DeltaBadge,
  InsightCard,
  insightDeepLink,
  MoneyLeaksPanel,
  MomentumRow,
  SparkBars,
  TrustPanel,
  type BranchHealthItem,
  type CashierTrustItem,
  type InsightTone,
  type MoneyLeakItem,
} from '@/components/growth'
import { ManagerShiftsCard } from '@/components/ManagerShiftsCard'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import { formatZMW } from '@/lib/money'
import { apiPaymentLabel } from '@/types/database'

type BranchComparison = {
  branchId: string
  branchName: string
  revenue: number
  tickets: number
  voidRate: number
  discountRate: number
  lowStock: number
  stockValue: number
}

type DashboardPayload = {
  scope?: {
    mode: 'org' | 'branch'
    branchId: string | null
    branchName: string | null
    range: 'today' | '7d' | '30d'
  }
  branchComparison?: BranchComparison[]
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
    inventoryValueAtSell?: number
    productCount: number
    lowStockCount: number
    customerCount: number
    creditOutstanding?: number
    creditOverdueCount?: number
    leakRiskAmount?: number
    openStockConflicts?: number
    trustAlerts?: number
    branchAlerts?: number
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
  moneyLeaks?: MoneyLeakItem[]
  cashierTrust?: CashierTrustItem[]
  branchHealth?: BranchHealthItem[]
  journal: Array<{
    id: string
    tone: InsightTone
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
    cashier?: string | null
    branchName?: string | null
  }>
}

export function OwnerDashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [error, setError] = useState('')
  const [clock, setClock] = useState(() => new Date())
  const [range, setRange] = useState<'today' | '7d' | '30d'>('30d')
  const [branchTick, setBranchTick] = useState(0)

  useEffect(() => {
    const onBranch = () => setBranchTick((n) => n + 1)
    window.addEventListener('nexora-branch', onBranch)
    return () => window.removeEventListener('nexora-branch', onBranch)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (document.visibilityState === 'hidden') return
      try {
        const next = await api<DashboardPayload>(
          `/business/dashboard?range=${range}`,
        )
        if (!cancelled) setData(next)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard')
        }
      }
    }
    void load()
    const id = window.setInterval(() => void load(), 60000)
    const onVis = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [range, branchTick])

  useEffect(() => {
    // Minute clock — no need for a 1Hz re-render of the whole Command page
    const id = window.setInterval(() => setClock(new Date()), 30000)
    return () => window.clearInterval(id)
  }, [])

  if (error) {
    return (
      <div className="nx-card p-6 text-sm text-danger">
        {error}. Refresh the page — if it keeps failing, restart with{' '}
        <code className="rounded bg-surface px-1">npm run dev</code>.
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-royal/25 border-t-royal" />
        <p className="text-sm text-ink-soft">Loading Shop OS…</p>
      </div>
    )
  }

  const { summary } = data
  const payEntries = Object.entries(summary.paymentBreakdown || {})
  const payTotal = payEntries.reduce((s, [, v]) => s + v, 0) || 1

  return (
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
      <PageHero
        eyebrow={`Command · ${clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        title="Growth + integrity"
        subtitle="Revenue, leaks, and trust across the shops you run."
        actions={
          <>
            <Link to="/app/checkout" className="w-full sm:w-auto">
              <Button type="button" className="w-full sm:w-auto">
                <Store className="h-4 w-4" />
                Open Sell
              </Button>
            </Link>
            <Link to="/app/insights" className="w-full sm:w-auto">
              <Button type="button" variant="secondary" className="w-full sm:w-auto">
                <HeartPulse className="h-4 w-4" />
                Open Pulse
              </Button>
            </Link>
          </>
        }
      />

      {/* Head Office strip */}
      <section className="nx-card flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-royal/10 text-royal">
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-royal">
              {data.scope?.mode === 'org' ? 'Head Office' : 'Branch scope'}
            </p>
            <p className="font-semibold text-ink">
              {data.scope?.mode === 'org'
                ? 'All branches · consolidated'
                : data.scope?.branchName || 'Single branch'}
            </p>
            <p className="text-xs text-ink-soft">
              Stock {formatZMW(summary.inventoryValue)} ·{' '}
              {summary.lowStockCount} low ·{' '}
              {summary.branchAlerts || 0} branch alerts
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['today', '7d', '30d'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`nx-chip ${range === r ? 'is-active' : ''}`}
            >
              {r === 'today' ? 'Today' : r === '7d' ? '7 days' : '30 days'}
            </button>
          ))}
          <Link
            to="/app/transfers"
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:text-royal"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Transfers
          </Link>
        </div>
      </section>

      {data.scope?.mode === 'org' &&
      (data.branchComparison?.length || 0) > 1 ? (
        <section className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-royal">
              Branch comparison
            </p>
            <h3 className="nx-section-title mt-0.5">
              Revenue · tickets · risk · stock
            </h3>
            <p className="text-xs text-ink-soft">
              Range {range === 'today' ? 'today' : range} — each sale counted once
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(data.branchComparison || []).map((b) => (
              <div key={b.branchId} className="nx-card p-4">
                <p className="font-semibold text-ink">{b.branchName}</p>
                <p className="mt-2 font-display text-xl font-bold text-ink">
                  {formatZMW(b.revenue)}
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  {b.tickets} tickets · void {b.voidRate}% · discount{' '}
                  {b.discountRate}%
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  Stock {formatZMW(b.stockValue)} · {b.lowStock} low SKUs
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: 'Revenue MTD',
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
            label: 'Live today',
            value: formatZMW(summary.revenueToday),
            delta: null as number | null,
            hint: `${summary.transactionsToday} tickets · profit ${formatZMW(summary.grossProfitToday)}`,
            icon: Store,
          },
          {
            label: 'Avg ticket',
            value: formatZMW(summary.avgTicketMonth),
            delta: summary.ticketsMom,
            hint: `${summary.customerCount} customers · tickets MoM`,
            icon: Users,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="nx-card relative overflow-hidden p-4 sm:p-5"
          >
            <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-royal/10 blur-2xl" />
            <div className="relative flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                {card.label}
              </p>
              <card.icon className="h-4 w-4 text-royal" />
            </div>
            <p className="font-display relative mt-2 text-2xl font-bold text-ink sm:text-3xl">
              {card.value}
            </p>
            <div className="relative mt-2 flex flex-wrap items-center gap-2">
              {card.delta !== null ? <DeltaBadge value={card.delta} /> : null}
              <p className="text-xs text-ink-soft">{card.hint}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Money leaks — profit shield */}
      <MoneyLeaksPanel
        leaks={data.moneyLeaks || []}
        leakRiskAmount={summary.leakRiskAmount}
        compact
        moreHref="/app/insights"
        moreLabel="Work leaks on Pulse"
      />

      <TrustPanel
        cashiers={data.cashierTrust}
        branches={data.branchHealth}
        openConflicts={summary.openStockConflicts || 0}
        compact
      />

      <ManagerShiftsCard />

      {/* Money trail + growth journal */}
      <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="nx-card p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-royal">
                Money trail
              </p>
              <h3 className="nx-section-title mt-0.5">6-month revenue</h3>
              <p className="text-xs text-ink-soft">
                Growth path from completed sales — hover a bar for exact take
              </p>
            </div>
            <DeltaBadge value={summary.revenueMom} />
          </div>
          <SparkBars
            points={data.months.map((m) => ({
              key: m.key,
              label: m.label,
              value: m.revenue,
            }))}
            formatValue={formatZMW}
            heightClass="h-40 sm:h-48"
          />
        </section>

        <section className="nx-card flex max-h-[420px] flex-col overflow-hidden p-0">
          <div className="shrink-0 border-b border-line px-5 py-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-royal" />
              <h3 className="nx-section-title">Growth journal</h3>
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              Actionable coaching — tap through to Inventory, Sell, Ledger, or Pulse
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3 sm:p-4">
            {data.journal.length === 0 ? (
              <div className="px-2 py-6 text-center">
                <p className="text-sm text-ink-soft">
                  Journal fills as you ring sales.
                </p>
                <Link
                  to="/app/checkout"
                  className="mt-2 inline-flex text-sm font-semibold text-royal hover:underline"
                >
                  Open Sell →
                </Link>
              </div>
            ) : (
              data.journal.map((entry) => {
                const link = insightDeepLink(entry.id, entry.action)
                return (
                  <InsightCard
                    key={entry.id}
                    id={entry.id}
                    title={entry.title}
                    summary={entry.body}
                    action={entry.action}
                    tone={entry.tone}
                    href={link.href}
                    ctaLabel={link.label}
                    embedded
                  />
                )
              })
            )}
          </div>
        </section>
      </div>

      {/* Momentum panels */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="nx-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
              <Flame className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-semibold text-ink">Heating up</h3>
              <p className="text-xs text-ink-soft">Last 7 days vs week before</p>
            </div>
          </div>
          <ul className="space-y-2">
            {data.rising.length === 0 ? (
              <li className="text-sm text-ink-soft">Not enough sales yet.</li>
            ) : (
              data.rising.map((p) => (
                <MomentumRow
                  key={p.name}
                  name={p.name}
                  recentQty={p.recentQty}
                  priorQty={p.priorQty}
                  changePct={p.changePct}
                  direction="up"
                />
              ))
            )}
          </ul>
        </section>

        <section className="nx-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700">
              <Snowflake className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-semibold text-ink">Cooling off</h3>
              <p className="text-xs text-ink-soft">Demand dip · opportunity</p>
            </div>
          </div>
          <ul className="space-y-2">
            {data.falling.length === 0 ? (
              <li className="text-sm text-ink-soft">No cool-downs detected.</li>
            ) : (
              data.falling.map((p) => (
                <MomentumRow
                  key={p.name}
                  name={p.name}
                  recentQty={p.recentQty}
                  priorQty={p.priorQty}
                  changePct={p.changePct}
                  direction="down"
                />
              ))
            )}
          </ul>
        </section>

        <section className="nx-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-royal/15 text-royal">
              <Target className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-semibold text-ink">Month winners</h3>
              <p className="text-xs text-ink-soft">Keep near the counter</p>
            </div>
          </div>
          <ul className="space-y-2">
            {data.topProducts.length === 0 ? (
              <li className="rounded-xl bg-surface/80 px-3 py-4 text-sm text-ink-soft">
                No winners yet — complete a few sales on Sell.
              </li>
            ) : (
              data.topProducts.map((p, i) => (
                <li
                  key={p.name}
                  className="flex items-center justify-between rounded-xl bg-surface/80 px-3 py-2 text-sm"
                >
                  <span className="truncate pr-2">
                    <span className="mr-2 text-xs font-bold text-royal">#{i + 1}</span>
                    {p.name}
                  </span>
                  <strong className="shrink-0">{formatZMW(p.revenue)}</strong>
                </li>
              ))
            )}
          </ul>
          <Link
            to="/app/checkout"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-royal hover:underline"
          >
            Feature winners on Sell <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      </div>

      {/* Ops strip */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="nx-card p-5">
          <h3 className="font-semibold text-ink">How people paid today</h3>
          <ul className="mt-4 space-y-3">
            {payEntries.length === 0 ? (
              <li className="text-sm text-ink-soft">No payments yet today.</li>
            ) : (
              payEntries.map(([method, amount]) => (
                <li key={method}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-ink-soft">{apiPaymentLabel(method)}</span>
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
            Month expenses {formatZMW(summary.expensesMonth)} · Stock at cost{' '}
            {formatZMW(summary.inventoryValue)}
            {summary.inventoryValueAtSell != null
              ? ` · at sell ${formatZMW(summary.inventoryValueAtSell)}`
              : ''}
            {summary.creditOutstanding != null && summary.creditOutstanding > 0
              ? ` · credit out ${formatZMW(summary.creditOutstanding)}`
              : ''}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
            <Link to="/app/expenses" className="text-royal hover:underline">
              Expenses
            </Link>
            <Link to="/app/customers" className="text-royal hover:underline">
              Credit
              {summary.creditOverdueCount
                ? ` (${summary.creditOverdueCount} overdue)`
                : ''}
            </Link>
            <Link to="/app/products" className="text-royal hover:underline">
              Stock value
            </Link>
          </div>
        </section>

        <section className="nx-card p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warn" />
              <h3 className="font-semibold text-ink">
                Low stock ({summary.lowStockCount})
              </h3>
            </div>
            <Link
              to="/app/products"
              className="text-xs font-semibold text-royal hover:underline"
            >
              Products
            </Link>
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
                  <span className="truncate pr-2">{p.name}</span>
                  <strong className="shrink-0">{p.stockQuantity} left</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="nx-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-ink">Recent ledger</h3>
            <Link
              to="/app/sales"
              className="inline-flex items-center gap-1 text-sm font-semibold text-royal"
            >
              All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {data.recentSales.length === 0 ? (
              <li className="py-4 text-center">
                <p className="text-sm text-ink-soft">No sales recorded yet.</p>
                <Link
                  to="/app/checkout"
                  className="mt-2 inline-flex text-sm font-semibold text-royal hover:underline"
                >
                  Open Sell →
                </Link>
              </li>
            ) : (
              data.recentSales.map((sale) => (
                <li key={sale.id} className="flex justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {sale.paymentMethod.replaceAll('_', ' ')}
                      {sale.cashier ? ` · ${sale.cashier}` : ''}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {sale.branchName ? `${sale.branchName} · ` : ''}
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/60 px-4 py-3 text-xs text-ink-soft">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-royal" />
          Live refresh every 60s · last pulse{' '}
          {summary.liveAt
            ? new Date(summary.liveAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '—'}
        </span>
        <Link
          to="/app/insights"
          className="inline-flex items-center gap-1 font-semibold text-royal hover:underline"
        >
          Open Pulse <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}
