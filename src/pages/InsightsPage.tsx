import { useEffect, useState, type FormEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Banknote,
  Boxes,
  CircleDollarSign,
  CreditCard,
  Flame,
  HeartPulse,
  Lightbulb,
  MessageSquare,
  Package,
  Percent,
  RefreshCw,
  ShoppingBag,
  Snowflake,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  HealthMeter,
  InsightCard,
  MoneyLeaksPanel,
  MomentumRow,
  SparkBars,
  TrustPanel,
  type BranchHealthItem,
  type CashierTrustItem,
  type MoneyLeakItem,
} from '@/components/growth'
import { PageHero } from '@/components/PageHero'
import { ScenarioSimulator } from '@/components/ScenarioSimulator'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { formatZMW } from '@/lib/money'
import { apiPaymentLabel } from '@/types/database'

type Insight = {
  id: string
  kind: string
  title: string
  summary: string
  impact?: string | null
  action?: string | null
  severity: string
  status?: string
  active?: boolean
}

type Mover = {
  name: string
  recentQty: number
  priorQty: number
  delta: number
  changePct: number
}

type Pulse = {
  revenueToday: number
  ticketsToday: number
  revenue30: number
  profit30: number
  margin30: number
  discount30: number
  avgTicket30: number
  tickets30: number
  customers: number
  productCount: number
  lowStockCount: number
  inventoryValue: number
  inventoryValueAtSell?: number
  healthScore: number
  series7: Array<{ date: string; revenue: number; tickets: number; profit: number }>
  forecast?: {
    days: number
    projectedRevenue: number
    daily: Array<{ date: string; projected: number }>
    method: string
    confidence: 'low' | 'medium' | 'high'
    note: string
    avgDaily7: number
    trendPct: number
  }
  cohorts?: {
    customersWithSales30: number
    repeatCustomers30: number
    repeatRate: number
    newCustomers30: number
    avgSpendRepeat: number
    avgSpendNew: number
    note: string
  }
  topProducts: Array<{ name: string; qty: number; revenue: number }>
  rising: Mover[]
  falling: Mover[]
  lowStock: Array<{
    id: string
    name: string
    stockQuantity: number
    lowStockThreshold: number
  }>
  reorderRecommendations?: Array<{
    id: string
    name: string
    stockQuantity: number
    lowStockThreshold: number
    soldLast14Days: number
    dailyVelocity: number
    suggestedQty: number
    preferredSupplier: { id: string; name: string } | null
    disclaimer: string
  }>
  paymentBreakdown: Record<string, number>
  moneyLeaks?: MoneyLeakItem[]
  leakRiskAmount?: number
  openStockConflicts?: number
  expiringLots90?: number
  cashierTrust?: CashierTrustItem[]
  branchHealth?: BranchHealthItem[]
  generatedAt?: string
}

const prompts = [
  'Where is money leaking?',
  'How can we grow this month?',
  'Forecast next week revenue',
  'What is our repeat buyer rate?',
  'How much profit did we make this month?',
  'What sold best in the last 30 days?',
  'Which products are cooling off?',
  'Which items are low on stock?',
  "What's today's revenue?",
]

function IconBadge({
  icon: Icon,
  tone = 'royal',
}: {
  icon: LucideIcon
  tone?: 'royal' | 'teal' | 'ok' | 'warn' | 'danger' | 'violet'
}) {
  const tones: Record<string, string> = {
    royal: 'bg-royal/15 text-royal',
    teal: 'bg-teal/15 text-teal',
    ok: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    danger: 'bg-red-500/15 text-danger',
    violet: 'bg-violet-500/15 text-violet-600 dark:text-violet-300',
  }
  return (
    <span
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${tones[tone]}`}
    >
      <Icon className="h-5 w-5" />
    </span>
  )
}

function payIcon(method: string): LucideIcon {
  if (method.includes('CARD')) return CreditCard
  if (method.includes('CASH')) return Banknote
  return CircleDollarSign
}

function healthHint(score: number, pulse: Pulse): string {
  if (pulse.lowStockCount > 0 && score < 70) {
    return `${pulse.lowStockCount} low-stock risks are weighing health down — protect those SKUs first.`
  }
  if (score >= 80) {
    return 'Sales, margin, and stock are aligned. Protect winners and keep the trail climbing.'
  }
  if (score >= 60) {
    return 'Solid baseline. Push rising products and clear cool-downs for the next leap.'
  }
  if (score >= 40) {
    return 'Mixed signals. Check Money leaks for discounts, cool-downs, and stock gaps before the week slips.'
  }
  return 'Health is strained. Work the Money leaks panel before chasing more volume.'
}

export function InsightsPage() {
  const { can } = useAuth()
  const allowed = can('pulse')
  const [insights, setInsights] = useState<Insight[]>([])
  const [pulse, setPulse] = useState<Pulse | null>(null)
  const [question, setQuestion] = useState(prompts[0])
  const [answer, setAnswer] = useState('')
  const [chat, setChat] = useState<Array<{ q: string; a: string }>>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [askBusy, setAskBusy] = useState(false)
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [briefing, setBriefing] = useState<{
    salesCount: number
    revenue: number
    grossProfit: number
    lowStock: Array<{ name: string; stock: number }>
    openStockConflicts: number
    note?: string
  } | null>(null)

  function visibleInsights(list: Insight[]) {
    return list.filter(
      (i) =>
        i.active !== false &&
        i.status !== 'dismissed' &&
        i.status !== 'resolved',
    )
  }

  async function load(generate = false) {
    setError('')
    const pulseData = await api<{ pulse: Pulse }>('/insights/pulse')
    setPulse(pulseData.pulse)

    let insightData = await api<{ insights: Insight[] }>('/insights')
    if (generate || insightData.insights.length === 0) {
      insightData = await api<{ insights: Insight[] }>('/insights/refresh', {
        method: 'POST',
      })
    }
    setInsights(visibleInsights(insightData.insights))

    try {
      const brief = await api<{
        briefing: {
          salesCount: number
          revenue: number
          grossProfit: number
          lowStock: Array<{ name: string; stock: number }>
          openStockConflicts: number
          note?: string
        }
      }>('/insights/briefing/today')
      setBriefing(brief.briefing)
    } catch {
      setBriefing(null)
    }
  }

  useEffect(() => {
    if (!allowed) {
      setLoading(false)
      return
    }
    const run = () => {
      void load(true)
        .catch((err) =>
          setError(err instanceof Error ? err.message : 'Failed to load Pulse'),
        )
        .finally(() => setLoading(false))
    }
    run()
    window.addEventListener('nexora-branch', run)
    return () => window.removeEventListener('nexora-branch', run)
  }, [allowed])

  if (!allowed) {
    return (
      <div className="nx-card mx-auto max-w-lg p-8 text-center">
        <IconBadge icon={HeartPulse} tone="warn" />
        <p className="mt-4 text-sm text-ink-soft">
          Pulse is locked for your role. Ask an owner or admin for access.
        </p>
      </div>
    )
  }

  async function refreshInsights() {
    setBusy(true)
    try {
      await load(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setBusy(false)
    }
  }

  async function setInsightStatus(
    id: string,
    status: 'resolved' | 'dismissed',
  ) {
    setStatusBusyId(id)
    setError('')
    try {
      await api(`/insights/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setInsights((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update insight status',
      )
    } finally {
      setStatusBusyId(null)
    }
  }

  async function ask(e: FormEvent) {
    e.preventDefault()
    const q = question.trim()
    if (q.length < 2) {
      setError('Type a short question for Pulse.')
      return
    }
    setAskBusy(true)
    setError('')
    try {
      const data = await api<{ answer: string }>('/insights/ask', {
        method: 'POST',
        body: JSON.stringify({ question: q }),
      })
      setAnswer(data.answer)
      setChat((prev) => [{ q, a: data.answer }, ...prev].slice(0, 8))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ask failed')
    } finally {
      setAskBusy(false)
    }
  }

  const payEntries = Object.entries(pulse?.paymentBreakdown || {}).sort(
    (a, b) => b[1] - a[1],
  )
  const payTotal = payEntries.reduce((s, [, v]) => s + v, 0) || 1

  return (
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-5">
      <PageHero
        eyebrow="Shop OS · Pulse"
        title="Health + integrity"
        subtitle="Trust signals, leaks, and momentum — refresh anytime."
        actions={
          <Button
            type="button"
            onClick={() => void refreshInsights()}
            disabled={busy || loading}
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            Refresh Pulse
          </Button>
        }
      />

      {error ? <FormBanner tone="error">{error}</FormBanner> : null}

      {loading && !pulse ? (
        <div className="nx-card flex items-center gap-3 p-8 text-sm text-ink-soft">
          <RefreshCw className="h-4 w-4 animate-spin text-royal" />
          Reading your shop signals…
        </div>
      ) : null}

      {pulse ? (
        <>
          {/* Health + 7-day spark header */}
          <section className="nx-card grid gap-6 p-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)] sm:p-6">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-royal">
                  Shop health
                </p>
                <h3 className="font-display mt-0.5 text-lg font-bold text-ink">
                  How the business is breathing
                </h3>
              </div>
              <HealthMeter
                score={pulse.healthScore}
                size="lg"
                hint={healthHint(pulse.healthScore, pulse)}
              />
              {pulse.generatedAt ? (
                <p className="text-[10px] text-ink-soft">
                  Updated{' '}
                  {new Date(pulse.generatedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  {
                    label: 'Today',
                    value: formatZMW(pulse.revenueToday),
                    hint: `${pulse.ticketsToday} tickets`,
                  },
                  {
                    label: '30-day',
                    value: formatZMW(pulse.revenue30),
                    hint: `${pulse.tickets30} sales`,
                  },
                  {
                    label: 'Margin',
                    value: `${(pulse.margin30 * 100).toFixed(1)}%`,
                    hint: formatZMW(pulse.profit30),
                  },
                  ...(pulse.expiringLots90 != null && pulse.expiringLots90 > 0
                    ? [
                        {
                          label: 'Expiring',
                          value: String(pulse.expiringLots90),
                          hint: 'lots · 90d',
                        },
                      ]
                    : []),
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-xl border border-line bg-surface/70 px-3 py-2.5"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
                      {card.label}
                    </p>
                    <p className="font-display mt-1 truncate text-base font-bold text-ink sm:text-lg">
                      {card.value}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-ink-soft">
                      {card.hint}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal">
                    7-day trail
                  </p>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Revenue spark
                  </h3>
                  <p className="text-xs text-ink-soft">
                    Daily completed sales · hover for exact take
                  </p>
                </div>
                <Link
                  to="/app/dashboard"
                  className="hidden text-xs font-semibold text-royal hover:underline sm:inline"
                >
                  Open Command
                </Link>
              </div>
              <SparkBars
                points={pulse.series7.map((d) => ({
                  key: d.date,
                  label: d.date.slice(5),
                  value: d.revenue,
                }))}
                formatValue={formatZMW}
                heightClass="h-40 sm:h-48"
              />
            </div>
          </section>

          {pulse.forecast || pulse.cohorts ? (
            <section className="grid gap-3 sm:grid-cols-2">
              {pulse.forecast ? (
                <div className="nx-card space-y-3 p-4 sm:p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-royal">
                    7-day forecast
                  </p>
                  <p className="font-display text-2xl font-bold text-ink">
                    {formatZMW(pulse.forecast.projectedRevenue)}
                  </p>
                  <p className="text-xs text-ink-soft">
                    ~{formatZMW(pulse.forecast.avgDaily7)}/day · confidence{' '}
                    {pulse.forecast.confidence}
                    {Math.abs(pulse.forecast.trendPct) >= 5
                      ? ` · trend ${pulse.forecast.trendPct > 0 ? '+' : ''}${pulse.forecast.trendPct}%`
                      : ''}
                  </p>
                  <p className="text-[11px] text-ink-soft">{pulse.forecast.note}</p>
                  {pulse.forecast.daily.length > 0 ? (
                    <SparkBars
                      points={pulse.forecast.daily.map((d) => ({
                        key: d.date,
                        label: d.date.slice(5),
                        value: d.projected,
                      }))}
                      formatValue={formatZMW}
                      heightClass="h-24"
                    />
                  ) : null}
                </div>
              ) : null}
              {pulse.cohorts ? (
                <div className="nx-card space-y-3 p-4 sm:p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-teal">
                    Buyer cohorts · 30d
                  </p>
                  <p className="font-display text-2xl font-bold text-ink">
                    {pulse.cohorts.repeatRate}%
                    <span className="ml-2 text-sm font-semibold text-ink-soft">
                      repeat
                    </span>
                  </p>
                  <p className="text-xs text-ink-soft">
                    {pulse.cohorts.repeatCustomers30} returning ·{' '}
                    {pulse.cohorts.newCustomers30} new ·{' '}
                    {pulse.cohorts.customersWithSales30} tagged
                  </p>
                  <p className="text-xs text-ink-soft">
                    Avg ticket repeat {formatZMW(pulse.cohorts.avgSpendRepeat)} ·
                    new {formatZMW(pulse.cohorts.avgSpendNew)}
                  </p>
                  <p className="text-[11px] text-ink-soft">{pulse.cohorts.note}</p>
                </div>
              ) : null}
            </section>
          ) : null}

          {briefing ? (
            <section className="nx-card p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-royal">
                Daily briefing
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-ink-soft">Sales today</p>
                  <p className="font-display text-2xl font-bold">
                    {briefing.salesCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-soft">Revenue</p>
                  <p className="font-display text-2xl font-bold">
                    {formatZMW(briefing.revenue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-soft">Gross profit</p>
                  <p className="font-display text-2xl font-bold">
                    {formatZMW(briefing.grossProfit)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-soft">Low stock / conflicts</p>
                  <p className="font-display text-2xl font-bold">
                    {briefing.lowStock.length}/{briefing.openStockConflicts}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-ink-soft">
                {briefing.note ||
                  'Calculated from completed sales and live stock.'}
              </p>
            </section>
          ) : null}

          <MoneyLeaksPanel
            leaks={pulse.moneyLeaks || []}
            leakRiskAmount={pulse.leakRiskAmount}
            moreHref="/app/products"
            moreLabel="Fix stock & prices in Inventory"
          />

          <TrustPanel
            cashiers={pulse.cashierTrust}
            branches={pulse.branchHealth}
            openConflicts={pulse.openStockConflicts || 0}
          />

          <ScenarioSimulator
            baselineRevenue30={pulse.revenue30}
            baselineMargin30={pulse.margin30}
            avgTicket30={pulse.avgTicket30}
          />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Avg ticket',
                value: formatZMW(pulse.avgTicket30),
                icon: ShoppingBag,
                tone: 'violet' as const,
              },
              {
                label: 'Customers',
                value: String(pulse.customers),
                icon: Users,
                tone: 'royal' as const,
              },
              {
                label: 'Low stock',
                value: String(pulse.lowStockCount),
                icon: Package,
                tone: pulse.lowStockCount > 0 ? ('warn' as const) : ('ok' as const),
              },
              {
                label: 'Stock at cost',
                value: formatZMW(pulse.inventoryValue),
                icon: Boxes,
                tone: 'teal' as const,
              },
            ].map((card) => (
              <div key={card.label} className="nx-card flex items-center gap-3 p-4">
                <IconBadge icon={card.icon} tone={card.tone} />
                <div className="min-w-0">
                  <p className="text-xs text-ink-soft">{card.label}</p>
                  <p className="font-display truncate text-xl font-bold text-ink">
                    {card.value}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="nx-card p-5 sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <IconBadge icon={Wallet} tone="teal" />
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Profit snapshot
                  </h3>
                  <p className="text-xs text-ink-soft">
                    30-day gross · discounts {formatZMW(pulse.discount30)}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: 'Revenue',
                    value: formatZMW(pulse.revenue30),
                    icon: TrendingUp,
                    tone: 'royal' as const,
                  },
                  {
                    label: 'Gross profit',
                    value: formatZMW(pulse.profit30),
                    icon: Target,
                    tone: 'ok' as const,
                  },
                  {
                    label: 'Margin',
                    value: `${(pulse.margin30 * 100).toFixed(1)}%`,
                    icon: Percent,
                    tone: 'violet' as const,
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-line bg-surface/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                        {card.label}
                      </p>
                      <IconBadge icon={card.icon} tone={card.tone} />
                    </div>
                    <p className="font-display mt-3 text-2xl font-bold text-ink">
                      {card.value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="nx-card p-5">
              <div className="mb-4 flex items-center gap-3">
                <IconBadge icon={Flame} tone="ok" />
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    Top sellers
                  </h3>
                  <p className="text-xs text-ink-soft">Where money concentrates</p>
                </div>
              </div>
              <ul className="space-y-2">
                {pulse.topProducts.length === 0 ? (
                  <li className="text-sm text-ink-soft">
                    No sales in the last 30 days yet.
                  </li>
                ) : (
                  pulse.topProducts.map((p, i) => (
                    <li
                      key={p.name}
                      className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2.5 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-royal/15 text-[11px] font-bold text-royal">
                          {i + 1}
                        </span>
                        <span className="truncate">{p.name}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <strong className="block">{formatZMW(p.revenue)}</strong>
                        <span className="text-[10px] text-ink-soft">
                          {p.qty} units
                        </span>
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="nx-card p-5">
              <div className="mb-3 flex items-center gap-3">
                <IconBadge icon={Flame} tone="ok" />
                <div>
                  <h3 className="font-semibold text-ink">Heating up</h3>
                  <p className="text-xs text-ink-soft">Last 7 days vs week before</p>
                </div>
              </div>
              <ul className="space-y-2">
                {(pulse.rising || []).filter((m) => m.delta > 0).length === 0 ? (
                  <li className="text-sm text-ink-soft">No rising products yet.</li>
                ) : (
                  pulse.rising
                    .filter((m) => m.delta > 0)
                    .map((p) => (
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
              <div className="mb-3 flex items-center gap-3">
                <IconBadge icon={Snowflake} tone="warn" />
                <div>
                  <h3 className="font-semibold text-ink">Cooling off</h3>
                  <p className="text-xs text-ink-soft">Demand dip · opportunity</p>
                </div>
              </div>
              <ul className="space-y-2">
                {(pulse.falling || []).length === 0 ? (
                  <li className="text-sm text-ink-soft">No cool-downs detected.</li>
                ) : (
                  pulse.falling.map((p) => (
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
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <IconBadge
                    icon={AlertTriangle}
                    tone={pulse.lowStockCount > 0 ? 'danger' : 'ok'}
                  />
                  <div>
                    <h3 className="font-semibold text-ink">Stock risks</h3>
                    <p className="text-xs text-ink-soft">
                      At cost {formatZMW(pulse.inventoryValue)}
                      {pulse.inventoryValueAtSell != null
                        ? ` · at sell ${formatZMW(pulse.inventoryValueAtSell)}`
                        : ''}
                    </p>
                  </div>
                </div>
                <Link
                  to="/app/products"
                  className="text-xs font-semibold text-royal hover:underline"
                >
                  Products
                </Link>
              </div>
              <ul className="space-y-2">
                {(pulse.lowStock || []).length === 0 ? (
                  <li className="text-sm text-ink-soft">Stock levels look healthy.</li>
                ) : (
                  pulse.lowStock.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-xl bg-red-500/10 px-3 py-2 text-sm"
                    >
                      <span className="truncate">{p.name}</span>
                      <strong className="text-danger">{p.stockQuantity} left</strong>
                    </li>
                  ))
                )}
              </ul>
            </section>
          </div>

          <section className="nx-card p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="font-semibold text-ink">Reorder recommendations</h3>
                <p className="text-xs text-ink-soft">
                  Based on 14-day velocity + threshold — suggestions, not guarantees
                </p>
              </div>
              <Link
                to="/app/purchasing"
                className="text-xs font-semibold text-royal hover:underline"
              >
                Purchasing
              </Link>
            </div>
            <ul className="space-y-2">
              {(pulse.reorderRecommendations || []).length === 0 ? (
                <li className="text-sm text-ink-soft">
                  Nothing below threshold right now.
                </li>
              ) : (
                (pulse.reorderRecommendations || []).map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink">{r.name}</p>
                      <p className="text-xs text-ink-soft">
                        {r.stockQuantity} left · sold {r.soldLast14Days}/14d · ~
                        {r.dailyVelocity}/day
                        {r.preferredSupplier
                          ? ` · ${r.preferredSupplier.name}`
                          : ''}
                      </p>
                    </div>
                    <strong className="shrink-0 text-royal">
                      Suggest +{r.suggestedQty}
                    </strong>
                  </li>
                ))
              )}
            </ul>
          </section>

          {payEntries.length > 0 ? (
            <section className="nx-card p-5">
              <div className="mb-4 flex items-center gap-3">
                <IconBadge icon={Percent} tone="violet" />
                <div>
                  <h3 className="font-semibold text-ink">How people paid</h3>
                  <p className="text-xs text-ink-soft">
                    Last 30 days · discounts given {formatZMW(pulse.discount30)}
                  </p>
                </div>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2">
                {payEntries.map(([method, amount]) => {
                  const Icon = payIcon(method)
                  return (
                    <li
                      key={method}
                      className="rounded-xl border border-line bg-surface/60 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 text-sm text-ink">
                          <Icon className="h-4 w-4 text-royal" />
                          {apiPaymentLabel(method)}
                        </span>
                        <strong>{formatZMW(amount)}</strong>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-card">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-royal to-teal"
                          style={{ width: `${(amount / payTotal) * 100}%` }}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      <form onSubmit={ask} className="nx-card space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <IconBadge icon={MessageSquare} tone="royal" />
          <div>
            <h3 className="font-display text-lg font-bold">Ask NEXORA</h3>
            <p className="text-xs text-ink-soft">
              Plain-language coaching from your real numbers
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {prompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setQuestion(p)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                question === p
                  ? 'border-royal bg-royal/15 text-royal'
                  : 'border-line bg-surface text-ink-soft hover:border-royal/40 hover:text-ink'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-royal focus:ring-4 focus:ring-royal/15"
            placeholder="Ask about profit, growth, stock, customers…"
          />
          <Button type="submit" disabled={askBusy || loading} className="shrink-0">
            <Sparkles className={`h-4 w-4 ${askBusy ? 'animate-pulse' : ''}`} />
            {askBusy ? 'Thinking…' : 'Ask Pulse'}
          </Button>
        </div>
        {answer ? (
          <div className="rounded-2xl border border-royal/20 bg-brand-soft px-4 py-3">
            <p className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-royal">
              <Lightbulb className="h-3 w-3" /> Answer
            </p>
            <p className="text-sm leading-relaxed text-ink">{answer}</p>
          </div>
        ) : null}
        {chat.length > 1 ? (
          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Recent asks
            </p>
            {chat.slice(1).map((item) => (
              <div
                key={item.q + item.a}
                className="rounded-xl bg-surface px-3 py-2 text-xs"
              >
                <p className="font-semibold text-ink">{item.q}</p>
                <p className="mt-1 text-ink-soft">{item.a}</p>
              </div>
            ))}
          </div>
        ) : null}
      </form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <IconBadge icon={Lightbulb} tone="teal" />
            <div>
              <h3 className="font-display text-lg font-bold text-ink">
                Growth journal
              </h3>
              <p className="text-xs text-ink-soft">
                Mark Done or Dismiss — then jump straight into the fix
              </p>
            </div>
          </div>
          <p className="text-xs text-ink-soft">
            {insights.length} open coach{insights.length === 1 ? '' : 'es'}
          </p>
        </div>
        {insights.length === 0 ? (
          <div className="nx-card p-6 text-sm text-ink-soft">
            No open recommendations. Hit Refresh Pulse to generate them from live
            data — or you cleared the journal. Nice work.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {insights.map((insight) => (
              <InsightCard
                key={insight.id}
                id={insight.id}
                title={insight.title}
                summary={insight.summary}
                impact={insight.impact}
                action={insight.action}
                severity={insight.severity}
                kind={insight.kind}
                onDone={(id) => void setInsightStatus(id, 'resolved')}
                onDismiss={(id) => void setInsightStatus(id, 'dismissed')}
                busy={statusBusyId === insight.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
