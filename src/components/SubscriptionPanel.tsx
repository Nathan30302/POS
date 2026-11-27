import { useEffect, useState } from 'react'
import { CreditCard } from 'lucide-react'
import { FormBanner } from '@/components/ui/FormBanner'
import { api } from '@/lib/api'
import { formatZMW } from '@/lib/money'

type Snapshot = {
  plan: string
  planLabel: string
  status: string
  trialEndsAt: string | null
  subscriptionEndsAt: string | null
  graceEndsAt: string | null
  access: string
  accessMessage: string
  entitlements: { maxBranches: number; maxUsers: number }
  priceMonthlyZmw: number
  billingProvider: string
  lastPaymentAt: string | null
}

type Usage = {
  users: number
  branches: number
  maxUsers: number
  maxBranches: number
  canAddUser: boolean
  canAddBranch: boolean
}

type EventRow = {
  id: string
  kind: string
  plan: string | null
  amount: number
  currency: string
  provider: string
  createdAt: string
  note: string | null
}

export function SubscriptionPanel() {
  const [sub, setSub] = useState<Snapshot | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    void api<{
      subscription: Snapshot
      usage?: Usage
      events: EventRow[]
    }>('/subscription/current')
      .then((data) => {
        setSub(data.subscription)
        setUsage(data.usage ?? null)
        setEvents(data.events)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load plan'),
      )
  }, [])

  if (error) return <FormBanner tone="error">{error}</FormBanner>
  if (!sub) {
    return <p className="text-sm text-ink-soft">Loading subscription…</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-royal/15 text-royal">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold text-ink">
            {sub.planLabel} · {sub.status}
          </p>
          <p className="text-sm text-ink-soft">{sub.accessMessage}</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface/60 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-ink-soft">
            List price
          </p>
          <p className="font-semibold tabular-nums text-ink">
            {sub.priceMonthlyZmw > 0
              ? `${formatZMW(sub.priceMonthlyZmw)} / mo`
              : 'Custom'}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface/60 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-ink-soft">
            Branches
          </p>
          <p className="font-semibold tabular-nums text-ink">
            {usage
              ? `${usage.branches} / ${usage.maxBranches}`
              : `up to ${sub.entitlements.maxBranches}`}
          </p>
          {usage && !usage.canAddBranch ? (
            <p className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-300">
              At branch limit
            </p>
          ) : null}
        </div>
        <div className="rounded-xl border border-line bg-surface/60 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase text-ink-soft">
            Staff seats
          </p>
          <p className="font-semibold tabular-nums text-ink">
            {usage
              ? `${usage.users} / ${usage.maxUsers}`
              : `up to ${sub.entitlements.maxUsers}`}
          </p>
          {usage && !usage.canAddUser ? (
            <p className="mt-0.5 text-[10px] text-amber-700 dark:text-amber-300">
              At staff limit — upgrade or deactivate a seat
            </p>
          ) : null}
        </div>
      </div>

      <ul className="space-y-1 text-xs text-ink-soft">
        {sub.trialEndsAt ? (
          <li>Trial ends {new Date(sub.trialEndsAt).toLocaleString()}</li>
        ) : null}
        {sub.subscriptionEndsAt ? (
          <li>
            Paid through {new Date(sub.subscriptionEndsAt).toLocaleString()}
          </li>
        ) : null}
        {sub.graceEndsAt ? (
          <li>Grace until {new Date(sub.graceEndsAt).toLocaleString()}</li>
        ) : null}
        {sub.lastPaymentAt ? (
          <li>
            Last payment {new Date(sub.lastPaymentAt).toLocaleString()} ·{' '}
            {sub.billingProvider}
          </li>
        ) : null}
      </ul>

      <p className="text-xs text-ink-soft">
        To upgrade or renew, contact NEXORA platform support — they record MoMo /
        bank / card payments against your shop.
      </p>

      {events.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Billing history
          </p>
          <ul className="max-h-40 space-y-1.5 overflow-y-auto text-xs">
            {events.map((e) => (
              <li
                key={e.id}
                className="flex justify-between gap-2 border-b border-line/60 py-1.5"
              >
                <span>
                  {e.kind}
                  {e.plan ? ` · ${e.plan}` : ''}
                  {e.note ? ` — ${e.note}` : ''}
                </span>
                <span className="shrink-0 tabular-nums text-ink-soft">
                  {e.amount > 0 ? formatZMW(e.amount) : '—'} ·{' '}
                  {new Date(e.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
