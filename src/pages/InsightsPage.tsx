import { useEffect, useState, type FormEvent } from 'react'
import { Activity, MessageSquare, RefreshCw, Sparkles } from 'lucide-react'
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

type Pulse = {
  revenueToday: number
  ticketsToday: number
  revenue30: number
  profit30: number
  margin30: number
  discount30: number
  customers: number
  productCount: number
  lowStockCount: number
  inventoryValue: number
  healthScore: number
  series7: Array<{ date: string; revenue: number; tickets: number; profit: number }>
  topProducts: Array<{ name: string; qty: number; revenue: number }>
  paymentBreakdown: Record<string, number>
}

const prompts = [
  'How much profit did we make this month?',
  'What sold best in the last 30 days?',
  'Which items are low on stock?',
  'How are we doing on discounts?',
  "What's today's revenue?",
]

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

  async function load() {
    const [insightData, pulseData] = await Promise.all([
      api<{ insights: Insight[] }>('/insights'),
      api<{ pulse: Pulse }>('/insights/pulse'),
    ])
    setInsights(insightData.insights)
    setPulse(pulseData.pulse)
  }

  useEffect(() => {
    if (!allowed) return
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load Pulse'),
    )
  }, [allowed])

  if (!allowed) {
    return (
      <div className="nx-card mx-auto max-w-lg p-8 text-center text-sm text-ink-soft">
        Pulse is locked for your role. Ask an owner or admin for access.
      </div>
    )
  }

  async function refreshInsights() {
    setBusy(true)
    setError('')
    try {
      const data = await api<{ insights: Insight[] }>('/insights/refresh', {
        method: 'POST',
      })
      setInsights(data.insights)
      const pulseData = await api<{ pulse: Pulse }>('/insights/pulse')
      setPulse(pulseData.pulse)
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

  const maxRev = Math.max(1, ...(pulse?.series7.map((d) => d.revenue) || [1]))

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="relative overflow-hidden rounded-[28px] border border-line bg-[#0b1224] p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-8 top-0 h-48 w-48 rounded-full bg-teal/30 blur-3xl interior-orb" />
          <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-royal/40 blur-3xl interior-orb-delay" />
        </div>
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Pulse · growth intelligence
            </p>
            <h2 className="font-display mt-3 text-4xl font-bold tracking-tight">
              Talk to your business
            </h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Ask questions, read the growth journal, and double down on what people
              actually buy.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => void refreshInsights()}
            disabled={busy}
            className="bg-[#3563E9] hover:bg-[#2f58d4]"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            Refresh Pulse
          </Button>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>
      ) : null}

      {pulse ? (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="nx-card overflow-hidden p-0">
            <div className="border-b border-line bg-gradient-to-br from-royal/10 via-transparent to-teal/10 px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-royal">
                    Health score
                  </p>
                  <p className="font-display mt-1 text-5xl font-bold text-ink">
                    {pulse.healthScore}
                  </p>
                </div>
                <div className="rounded-2xl bg-card/80 px-4 py-3 text-right shadow-sm">
                  <p className="text-xs text-ink-soft">Today</p>
                  <p className="text-lg font-bold text-ink">
                    {formatZMW(pulse.revenueToday)}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {pulse.ticketsToday} sales
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              {[
                ['30-day revenue', formatZMW(pulse.revenue30)],
                ['Gross profit', formatZMW(pulse.profit30)],
                ['Margin', `${(pulse.margin30 * 100).toFixed(1)}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-surface/80 px-4 py-3">
                  <p className="text-xs text-ink-soft">{label}</p>
                  <p className="mt-1 text-xl font-bold text-ink">{value}</p>
                </div>
              ))}
            </div>
            <div className="px-5 pb-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
                <Activity className="h-4 w-4 text-teal" />
                7-day revenue
              </div>
              <div className="flex h-36 items-end gap-2">
                {pulse.series7.map((day) => (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className="w-full rounded-t-lg bg-gradient-to-t from-royal to-teal/80 transition-all"
                      style={{
                        height: `${Math.max(8, (day.revenue / maxRev) * 100)}%`,
                      }}
                      title={`${day.date}: ${formatZMW(day.revenue)}`}
                    />
                    <span className="text-[10px] text-ink-soft">
                      {day.date.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="nx-card p-5">
              <h3 className="font-semibold text-ink">Top movers</h3>
              <ul className="mt-3 space-y-2">
                {pulse.topProducts.length === 0 ? (
                  <li className="text-sm text-ink-soft">No sales in the last 30 days yet.</li>
                ) : (
                  pulse.topProducts.map((p, i) => (
                    <li
                      key={p.name}
                      className="flex items-center justify-between rounded-xl bg-surface/70 px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="mr-2 text-xs font-bold text-royal">#{i + 1}</span>
                        {p.name}
                      </span>
                      <strong>{formatZMW(p.revenue)}</strong>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Customers', String(pulse.customers)],
                ['SKUs', String(pulse.productCount)],
                ['Low stock', String(pulse.lowStockCount)],
                ['Stock value', formatZMW(pulse.inventoryValue)],
              ].map(([label, value]) => (
                <div key={label} className="nx-card p-4">
                  <p className="text-xs text-ink-soft">{label}</p>
                  <p className="mt-1 text-lg font-bold text-ink">{value}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <p className="text-sm text-ink-soft">Loading Pulse…</p>
      )}

      <form onSubmit={ask} className="nx-card space-y-4 p-5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-royal" />
          <h3 className="font-semibold">Ask NEXORA</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {prompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setQuestion(p)}
              className="rounded-full border border-line bg-surface/60 px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-royal/40 hover:text-ink"
            >
              {p}
            </button>
          ))}
        </div>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-royal focus:ring-4 focus:ring-royal/15"
          placeholder="Ask about profit, stock, customers…"
        />
        <Button type="submit" disabled={busy}>
          <Sparkles className="h-4 w-4" />
          Ask Pulse
        </Button>
        {answer ? (
          <p className="rounded-xl bg-brand-soft px-4 py-3 text-sm leading-relaxed text-ink">
            {answer}
          </p>
        ) : null}
        {chat.length > 1 ? (
          <div className="space-y-2 border-t border-line pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Recent asks
            </p>
            {chat.slice(1).map((item) => (
              <div key={item.q + item.a} className="rounded-xl bg-surface/70 px-3 py-2 text-xs">
                <p className="font-semibold text-ink">{item.q}</p>
                <p className="mt-1 text-ink-soft">{item.a}</p>
              </div>
            ))}
          </div>
        ) : null}
      </form>

      <div className="space-y-3">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">Growth journal</h3>
          <p className="text-xs text-ink-soft">
            Ideas from your sales, stock, and margin patterns
          </p>
        </div>
        {insights.length === 0 ? (
          <p className="text-sm text-ink-soft">
            Hit Refresh Pulse to generate live recommendations from your data.
          </p>
        ) : (
          insights.map((insight) => (
            <article key={insight.id} className="nx-card p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-ink">{insight.title}</h3>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                    insight.severity === 'critical'
                      ? 'bg-red-100 text-danger'
                      : insight.severity === 'warning'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-brand-soft text-royal'
                  }`}
                >
                  {insight.severity}
                </span>
              </div>
              <p className="mt-2 text-sm text-ink-soft">{insight.summary}</p>
              {insight.impact ? (
                <p className="mt-2 text-sm">
                  <strong>Impact:</strong> {insight.impact}
                </p>
              ) : null}
              {insight.action ? (
                <p className="mt-1 text-sm font-semibold text-royal">
                  → {insight.action}
                </p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  )
}
