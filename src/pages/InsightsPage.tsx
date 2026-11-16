import { useEffect, useState, type FormEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
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
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { formatZMW } from '@/lib/money'

type Insight = {
  id: string
  kind: string
  title: string
  summary: string
  impact?: string | null
  action?: string | null
  severity: string
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
  healthScore: number
  series7: Array<{ date: string; revenue: number; tickets: number; profit: number }>
  topProducts: Array<{ name: string; qty: number; revenue: number }>
  rising: Mover[]
  falling: Mover[]
  lowStock: Array<{
    id: string
    name: string
    stockQuantity: number
    lowStockThreshold: number
  }>
  paymentBreakdown: Record<string, number>
  generatedAt?: string
}

const prompts = [
  'How can we grow this month?',
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

function HealthRing({ score }: { score: number }) {
  const r = 42
  const c = 2 * Math.PI * r
  const offset = c - (Math.max(0, Math.min(100, score)) / 100) * c
  const tone =
    score >= 80 ? '#13b8a6' : score >= 60 ? '#3563e9' : score >= 40 ? '#d97706' : '#dc2626'
  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-line"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-display text-3xl font-bold text-ink">{score}</p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
          Health
        </p>
      </div>
    </div>
  )
}

function BarChart({
  points,
}: {
  points: Array<{ key: string; label: string; value: number }>
}) {
  const max = Math.max(1, ...points.map((p) => p.value))
  return (
    <div className="flex h-44 items-end gap-2">
      {points.map((p) => {
        const pct = Math.max(6, Math.round((p.value / max) * 100))
        return (
          <div
            key={p.key}
            className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-2"
          >
            <div className="relative flex min-h-0 flex-1 items-end">
              <div
                className="w-full rounded-t-xl bg-gradient-to-t from-royal to-teal shadow-sm shadow-royal/20 transition group-hover:brightness-110"
                style={{ height: `${pct}%` }}
                title={`${p.label}: ${formatZMW(p.value)}`}
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

function insightMeta(kind: string, severity: string): {
  icon: LucideIcon
  tone: 'royal' | 'teal' | 'ok' | 'warn' | 'danger' | 'violet'
} {
  if (kind.includes('low_stock') || severity === 'critical') {
    return { icon: AlertTriangle, tone: 'danger' }
  }
  if (kind.includes('slow') || kind.includes('discount')) {
    return { icon: Snowflake, tone: 'warn' }
  }
  if (kind.includes('performance') || kind.includes('margin')) {
    return { icon: TrendingUp, tone: 'ok' }
  }
  if (severity === 'warning') return { icon: AlertTriangle, tone: 'warn' }
  return { icon: Lightbulb, tone: 'royal' }
}

function payIcon(method: string): LucideIcon {
  if (method.includes('CARD')) return CreditCard
  if (method.includes('CASH')) return Banknote
  return CircleDollarSign
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
  const [loading, setLoading] = useState(true)

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
    setInsights(insightData.insights)
  }

  useEffect(() => {
    if (!allowed) {
      setLoading(false)
      return
    }
    void load(true)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load Pulse'),
      )
      .finally(() => setLoading(false))
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

  async function ask(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await api<{ answer: string }>('/insights/ask', {
        method: 'POST',
        body: JSON.stringify({ question }),
      })
      setAnswer(data.answer)
      setChat((prev) => [{ q: question, a: data.answer }, ...prev].slice(0, 8))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ask failed')
    } finally {
      setBusy(false)
    }
  }

  const payEntries = Object.entries(pulse?.paymentBreakdown || {}).sort(
    (a, b) => b[1] - a[1],
  )
  const payTotal = payEntries.reduce((s, [, v]) => s + v, 0) || 1

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHero
        eyebrow="Pulse · growth intelligence"
        title="Talk to your business"
        subtitle="Symbols, signals, and suggestions from your live sales — so you know what to push, fix, and protect."
        actions={
          <Button
            type="button"
            onClick={() => void refreshInsights()}
            disabled={busy || loading}
            className="bg-[#3563E9] hover:bg-[#2f58d4]"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            Refresh Pulse
          </Button>
        }
      />

      {error ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {loading && !pulse ? (
        <div className="nx-card flex items-center gap-3 p-8 text-sm text-ink-soft">
          <RefreshCw className="h-4 w-4 animate-spin text-royal" />
          Reading your shop signals…
        </div>
      ) : null}

      {pulse ? (
        <>
          <section className="nx-card grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:p-6">
            <HealthRing score={pulse.healthScore} />
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: 'Today',
                  value: formatZMW(pulse.revenueToday),
                  hint: `${pulse.ticketsToday} tickets`,
                  icon: Wallet,
                  tone: 'royal' as const,
                },
                {
                  label: '30-day revenue',
                  value: formatZMW(pulse.revenue30),
                  hint: `${pulse.tickets30} sales`,
                  icon: TrendingUp,
                  tone: 'teal' as const,
                },
                {
                  label: 'Gross profit',
                  value: formatZMW(pulse.profit30),
                  hint: `${(pulse.margin30 * 100).toFixed(1)}% margin`,
                  icon: Target,
                  tone: 'ok' as const,
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
                  <p className="mt-1 text-xs text-ink-soft">{card.hint}</p>
                </div>
              ))}
            </div>
          </section>

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
                label: 'Stock value',
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
                <IconBadge icon={Activity} tone="teal" />
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">
                    7-day revenue trail
                  </h3>
                  <p className="text-xs text-ink-soft">
                    Daily completed sales · hover a bar for exact take
                  </p>
                </div>
              </div>
              <BarChart
                points={pulse.series7.map((d) => ({
                  key: d.date,
                  label: d.date.slice(5),
                  value: d.revenue,
                }))}
              />
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
                  <li className="text-sm text-ink-soft">No sales in the last 30 days yet.</li>
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
                        <span className="text-[10px] text-ink-soft">{p.qty} units</span>
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
                <IconBadge icon={ArrowUpRight} tone="ok" />
                <div>
                  <h3 className="font-semibold text-ink">Buying more</h3>
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
                      <li
                        key={p.name}
                        className="flex items-center justify-between gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm"
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="inline-flex shrink-0 items-center gap-1 font-bold text-emerald-600">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {p.priorQty}→{p.recentQty}
                        </span>
                      </li>
                    ))
                )}
              </ul>
            </section>

            <section className="nx-card p-5">
              <div className="mb-3 flex items-center gap-3">
                <IconBadge icon={ArrowDownRight} tone="warn" />
                <div>
                  <h3 className="font-semibold text-ink">Buying less</h3>
                  <p className="text-xs text-ink-soft">Cooling demand · opportunity</p>
                </div>
              </div>
              <ul className="space-y-2">
                {(pulse.falling || []).length === 0 ? (
                  <li className="text-sm text-ink-soft">No cool-downs detected.</li>
                ) : (
                  pulse.falling.map((p) => (
                    <li
                      key={p.name}
                      className="flex items-center justify-between gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="inline-flex shrink-0 items-center gap-1 font-bold text-amber-700 dark:text-amber-300">
                        <TrendingDown className="h-3.5 w-3.5" />
                        {p.priorQty}→{p.recentQty}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </section>

            <section className="nx-card p-5">
              <div className="mb-3 flex items-center gap-3">
                <IconBadge
                  icon={AlertTriangle}
                  tone={pulse.lowStockCount > 0 ? 'danger' : 'ok'}
                />
                <div>
                  <h3 className="font-semibold text-ink">Stock risks</h3>
                  <p className="text-xs text-ink-soft">Protect revenue here</p>
                </div>
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
                          {method.replaceAll('_', ' ')}
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
              Ask in plain language — answers come from your real numbers
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
          <Button type="submit" disabled={busy} className="shrink-0">
            <Sparkles className="h-4 w-4" />
            Ask Pulse
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
        <div className="flex items-center gap-3">
          <IconBadge icon={Lightbulb} tone="teal" />
          <div>
            <h3 className="font-display text-lg font-bold text-ink">Growth journal</h3>
            <p className="text-xs text-ink-soft">
              Actionable ideas from sales, stock, and margin patterns
            </p>
          </div>
        </div>
        {insights.length === 0 ? (
          <div className="nx-card p-6 text-sm text-ink-soft">
            No recommendations yet. Hit Refresh Pulse to generate them from live data.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {insights.map((insight) => {
              const meta = insightMeta(insight.kind, insight.severity)
              return (
                <article key={insight.id} className="nx-card p-5">
                  <div className="flex items-start gap-3">
                    <IconBadge icon={meta.icon} tone={meta.tone} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-ink">{insight.title}</h3>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                            insight.severity === 'critical'
                              ? 'bg-red-500/15 text-danger'
                              : insight.severity === 'warning'
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                : 'bg-brand-soft text-royal'
                          }`}
                        >
                          {insight.severity}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                        {insight.summary}
                      </p>
                      {insight.impact ? (
                        <p className="mt-2 text-sm text-ink">
                          <strong>Impact:</strong> {insight.impact}
                        </p>
                      ) : null}
                      {insight.action ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-royal">
                          <Target className="h-3.5 w-3.5" />
                          {insight.action}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
