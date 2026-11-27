import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LiveAmbient } from '@/components/LiveSkyScene'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { formatZMW } from '@/lib/money'
import {
  getLiveAmbientVariant,
  getThemePreference,
  isLiveTheme,
} from '@/lib/theme'

type PlanRow = {
  id: string
  label: string
  blurb: string
  priceMonthlyZmw: number
  maxBranches: number
  maxUsers: number
  features: string[]
}

type Modules = Record<string, boolean>

type SubscriptionView = {
  plan: string
  planLabel: string
  status: string
  access: 'ok' | 'trial' | 'grace' | 'blocked'
  accessMessage: string
  fullAccess: boolean
  trialEndsAt: string | null
  subscriptionEndsAt: string | null
  graceEndsAt: string | null
  billingProvider: string
  lastPaymentAt: string | null
  entitlements: {
    maxBranches: number
    maxUsers: number
    features: string[]
    overrides: { maxBranches?: number; maxUsers?: number } | null
  }
  priceMonthlyZmw: number
}

type BusinessRow = {
  id: string
  name: string
  industry: string
  status: string
  currency: string
  plan: string
  phone: string | null
  address: string | null
  email: string | null
  createdAt: string
  trialEndsAt: string | null
  subscriptionEndsAt: string | null
  owner: { fullName: string; email: string } | null
  modules: Modules
  subscription: SubscriptionView
  branchCount: number
  userCount: number
  canAddBranch: boolean
  canAddUser: boolean
  lastSaleAt: string | null
  fullAccess: boolean
  _count: { products: number; sales: number; memberships: number; branches: number }
}

type Stats = {
  businesses: number
  active: number
  trial?: number
  pending?: number
  suspended?: number
  users: number
  salesCount: number
}

type BillingEvent = {
  id: string
  kind: string
  plan: string | null
  amount: number
  note: string | null
  createdAt: string
}

const STATUS_FILTERS = [
  'ALL',
  'PENDING_APPROVAL',
  'TRIAL',
  'ACTIVE',
  'SUSPENDED',
  'CANCELLED',
] as const

const MODULE_LABELS: Array<{ key: string; label: string }> = [
  { key: 'sell', label: 'Sell' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'finance', label: 'Finance' },
  { key: 'employees', label: 'Team' },
  { key: 'crm', label: 'Customers' },
  { key: 'procurement', label: 'Purchasing' },
  { key: 'intelligence', label: 'Pulse' },
  { key: 'pharmacy', label: 'Pharmacy lots' },
  { key: 'perishables', label: 'Perishables' },
  { key: 'labels', label: 'Labels' },
  { key: 'transfers', label: 'Transfers' },
]

function statusTone(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'bg-teal/15 text-teal'
    case 'TRIAL':
      return 'bg-royal/15 text-royal'
    case 'PENDING_APPROVAL':
      return 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
    case 'SUSPENDED':
      return 'bg-red-500/15 text-red-700 dark:text-red-300'
    case 'CANCELLED':
      return 'bg-ink/10 text-ink-soft'
    default:
      return 'bg-brand-soft text-royal'
  }
}

function accessLabel(sub: SubscriptionView) {
  if (sub.fullAccess) return 'Full access'
  if (sub.access === 'trial') return 'Trial access'
  if (sub.access === 'grace') return 'Grace period'
  return 'Limited / blocked'
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString()
}

function fmtRelative(iso: string | null | undefined) {
  if (!iso) return 'Never'
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return '—'
  const mins = Math.round((Date.now() - t) / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 48) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(iso)
}

export function PlatformHomePage() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    businesses: 0,
    active: 0,
    users: 0,
    salesCount: 0,
  })
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [listTotal, setListTotal] = useState(0)
  const [listPage, setListPage] = useState(1)
  const [listTotalPages, setListTotalPages] = useState(1)
  const pageSize = 50
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busyId, setBusyId] = useState('')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>('ALL')
  const [planFilter, setPlanFilter] = useState('ALL')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<BusinessRow | null>(null)
  const [billingEvents, setBillingEvents] = useState<BillingEvent[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '',
    industry: 'retail',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: 'Welcome123!',
    plan: 'starter',
    startTrial: true,
  })
  const [edit, setEdit] = useState({
    plan: 'starter',
    maxBranches: '',
    maxUsers: '',
    trialEndsAt: '',
    subscriptionEndsAt: '',
    modules: {} as Modules,
  })

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(query.trim()), 280)
    return () => window.clearTimeout(t)
  }, [query])

  useEffect(() => {
    setListPage(1)
  }, [debouncedQuery, statusFilter, planFilter])

  const refresh = useCallback(async () => {
    const params = new URLSearchParams({
      page: String(listPage),
      pageSize: String(pageSize),
    })
    if (debouncedQuery) params.set('q', debouncedQuery)
    if (statusFilter !== 'ALL') params.set('status', statusFilter)
    if (planFilter !== 'ALL') params.set('plan', planFilter)

    const [s, b, p] = await Promise.all([
      api<{ stats: Stats }>('/platform/stats'),
      api<{
        businesses: BusinessRow[]
        total: number
        page: number
        pageSize: number
        totalPages: number
      }>(`/platform/businesses?${params}`),
      api<{ plans: PlanRow[] }>('/subscription/plans'),
    ])
    setStats(s.stats)
    setBusinesses(b.businesses)
    setListTotal(b.total)
    setListTotalPages(b.totalPages || 1)
    setPlans(p.plans)

    if (selectedId) {
      try {
        const detail = await api<{
          business: BusinessRow
          events?: BillingEvent[]
        }>(`/platform/businesses/${selectedId}`)
        setSelected(detail.business as BusinessRow)
        setBillingEvents(detail.events ?? [])
      } catch {
        const onPage = b.businesses.find((row) => row.id === selectedId)
        if (onPage) setSelected(onPage)
      }
    }
  }, [
    debouncedQuery,
    listPage,
    pageSize,
    planFilter,
    selectedId,
    statusFilter,
  ])

  useEffect(() => {
    void refresh().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load platform'),
    )
  }, [refresh])

  useEffect(() => {
    if (!selected) return
    setEdit({
      plan: selected.plan,
      maxBranches: String(selected.subscription.entitlements.maxBranches),
      maxUsers: String(selected.subscription.entitlements.maxUsers),
      trialEndsAt: selected.trialEndsAt
        ? selected.trialEndsAt.slice(0, 10)
        : '',
      subscriptionEndsAt: selected.subscriptionEndsAt
        ? selected.subscriptionEndsAt.slice(0, 10)
        : '',
      modules: { ...selected.modules },
    })
  }, [selected])

  function openDetails(row: BusinessRow) {
    setSelectedId(row.id)
    setSelected(row)
    setBillingEvents([])
    void api<{
      business: BusinessRow
      events?: BillingEvent[]
    }>(`/platform/businesses/${row.id}`)
      .then((detail) => {
        setSelected(detail.business as BusinessRow)
        setBillingEvents(detail.events ?? [])
      })
      .catch(() => undefined)
  }

  function filterByStatus(status: (typeof STATUS_FILTERS)[number]) {
    setStatusFilter(status)
    setListPage(1)
  }

  async function createBusiness(e: FormEvent) {
    e.preventDefault()
    setError('')
    setOk('')
    try {
      await api('/platform/businesses', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      setForm({
        name: '',
        industry: 'retail',
        ownerName: '',
        ownerEmail: '',
        ownerPassword: 'Welcome123!',
        plan: 'starter',
        startTrial: true,
      })
      setShowCreate(false)
      setOk('Business created.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    }
  }

  async function setStatus(id: string, status: string) {
    setBusyId(id)
    setError('')
    setOk('')
    try {
      await api(`/platform/businesses/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setOk(`Status → ${status}`)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed')
    } finally {
      setBusyId('')
    }
  }

  async function charge(id: string, plan: string, period: 'monthly' | 'yearly') {
    setBusyId(id)
    setError('')
    setOk('')
    try {
      const data = await api<{
        subscription: { planLabel: string; subscriptionEndsAt: string | null }
      }>(`/subscription/platform/businesses/${id}/charge`, {
        method: 'POST',
        body: JSON.stringify({
          plan,
          period,
          provider: 'manual',
          confirm: true,
        }),
      })
      setOk(
        `Payment recorded · ${data.subscription.planLabel} through ${
          data.subscription.subscriptionEndsAt
            ? new Date(data.subscription.subscriptionEndsAt).toLocaleDateString()
            : '—'
        }`,
      )
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Charge failed')
    } finally {
      setBusyId('')
    }
  }

  async function startTrial(id: string) {
    setBusyId(id)
    setError('')
    try {
      await api(`/subscription/platform/businesses/${id}/start-trial`, {
        method: 'POST',
        body: JSON.stringify({ days: 14 }),
      })
      setOk('14-day trial started.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trial start failed')
    } finally {
      setBusyId('')
    }
  }

  async function saveEntitlements(id: string) {
    setBusyId(id)
    setError('')
    setOk('')
    try {
      const planDef = plans.find((p) => p.id === edit.plan)
      const maxBranches = Number(edit.maxBranches)
      const maxUsers = Number(edit.maxUsers)
      const body: Record<string, unknown> = {
        plan: edit.plan,
        trialEndsAt: edit.trialEndsAt
          ? new Date(`${edit.trialEndsAt}T23:59:59.000Z`).toISOString()
          : null,
        subscriptionEndsAt: edit.subscriptionEndsAt
          ? new Date(`${edit.subscriptionEndsAt}T23:59:59.000Z`).toISOString()
          : null,
      }
      if (Number.isFinite(maxBranches) && maxBranches >= 1) {
        body.maxBranches =
          planDef && maxBranches === planDef.maxBranches ? null : maxBranches
      }
      if (Number.isFinite(maxUsers) && maxUsers >= 1) {
        body.maxUsers =
          planDef && maxUsers === planDef.maxUsers ? null : maxUsers
      }
      await api(`/subscription/platform/businesses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      await api(`/platform/businesses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ modules: edit.modules }),
      })
      setOk('Plan, limits, and modules saved.')
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-surface px-4 py-8 sm:px-8">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <LiveAmbient
          variant={
            isLiveTheme(getThemePreference())
              ? getLiveAmbientVariant(getThemePreference())
              : 'floor'
          }
        />
      </div>
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-royal/12 via-card to-teal/8 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-royal">
                NEXORA Platform
              </p>
              <h1 className="font-display nx-page-title mt-1">
                Business console
              </h1>
              <p className="text-sm text-ink-soft">
                {user?.email} · approve shops, plans, entitlements, and access
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => setShowCreate((v) => !v)}
              >
                {showCreate ? 'Close create' : 'Register business'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  logout()
                  navigate('/platform/login')
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {(
            [
              ['All shops', stats.businesses, 'ALL'],
              ['Active', stats.active, 'ACTIVE'],
              ['Trial', stats.trial ?? 0, 'TRIAL'],
              ['Pending', stats.pending ?? 0, 'PENDING_APPROVAL'],
              ['Suspended', stats.suspended ?? 0, 'SUSPENDED'],
              ['Users', stats.users, null],
              ['Sales', stats.salesCount, null],
            ] as const
          ).map(([label, value, filter]) => {
            const active =
              filter !== null && statusFilter === filter && planFilter === 'ALL'
            const clickable = filter !== null
            const className = `nx-card p-4 text-left transition ${
              clickable ? 'hover:border-royal/40 hover:bg-royal/[0.04]' : ''
            } ${active ? 'border-royal/50 bg-royal/[0.08]' : ''}`
            const body = (
              <>
                <p className="text-xs font-medium uppercase tracking-wider text-ink-soft">
                  {label}
                  {clickable ? (
                    <span className="ml-1 font-normal normal-case tracking-normal opacity-70">
                      · filter
                    </span>
                  ) : null}
                </p>
                <p className="mt-1.5 text-2xl font-bold tabular-nums">{value}</p>
              </>
            )
            if (clickable && filter) {
              return (
                <button
                  key={label}
                  type="button"
                  className={className}
                  onClick={() => filterByStatus(filter)}
                >
                  {body}
                </button>
              )
            }
            return (
              <div key={label} className={className}>
                {body}
              </div>
            )
          })}
        </div>

        {error ? <FormBanner tone="error">{error}</FormBanner> : null}
        {ok ? <FormBanner tone="ok">{ok}</FormBanner> : null}

        {plans.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <div key={p.id} className="nx-card p-4">
                <p className="font-semibold text-ink">{p.label}</p>
                <p className="mt-1 text-xs text-ink-soft">{p.blurb}</p>
                <p className="mt-2 text-sm font-bold tabular-nums">
                  {p.priceMonthlyZmw > 0
                    ? `${formatZMW(p.priceMonthlyZmw)}/mo`
                    : 'Custom'}
                </p>
                <p className="text-[10px] text-ink-soft">
                  {p.maxBranches} branches · {p.maxUsers} users
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {showCreate ? (
          <form
            onSubmit={createBusiness}
            className="nx-card grid gap-3 p-5 sm:grid-cols-2"
          >
            <h2 className="sm:col-span-2 text-lg font-semibold">
              Register business
            </h2>
            <Input
              label="Business name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Industry
              </span>
              <select
                className="nx-field"
                value={form.industry}
                onChange={(e) =>
                  setForm((f) => ({ ...f, industry: e.target.value }))
                }
              >
                <option value="retail">Retail</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="stationery">Stationery</option>
                <option value="grocery">Grocery</option>
                <option value="chemist">Chemist</option>
                <option value="clinic">Clinic dispensary</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Plan
              </span>
              <select
                className="nx-field"
                value={form.plan}
                onChange={(e) =>
                  setForm((f) => ({ ...f, plan: e.target.value }))
                }
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={form.startTrial}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startTrial: e.target.checked }))
                }
              />
              Start 14-day trial
            </label>
            <Input
              label="Owner name"
              value={form.ownerName}
              onChange={(e) =>
                setForm((f) => ({ ...f, ownerName: e.target.value }))
              }
              required
            />
            <Input
              label="Owner email"
              type="email"
              value={form.ownerEmail}
              onChange={(e) =>
                setForm((f) => ({ ...f, ownerEmail: e.target.value }))
              }
              required
            />
            <Input
              label="Owner password"
              value={form.ownerPassword}
              onChange={(e) =>
                setForm((f) => ({ ...f, ownerPassword: e.target.value }))
              }
              required
            />
            <div className="sm:col-span-2">
              <Button type="submit">Create business environment</Button>
            </div>
          </form>
        ) : null}

        <div className="nx-card space-y-4 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Business directory</h2>
              <p className="text-xs text-ink-soft">
                Page {listPage}/{listTotalPages} · showing {businesses.length}{' '}
                of {listTotal} shops
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="search"
                placeholder="Search name, owner, email, phone, id…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="nx-field min-w-[14rem]"
                aria-label="Search businesses"
              />
              <select
                className="nx-field"
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as (typeof STATUS_FILTERS)[number],
                  )
                }
              >
                {STATUS_FILTERS.map((s) => (
                  <option key={s} value={s}>
                    {s === 'ALL' ? 'All statuses' : s}
                  </option>
                ))}
              </select>
              <select
                className="nx-field"
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
              >
                <option value="ALL">All plans</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {query || statusFilter !== 'ALL' || planFilter !== 'ALL' ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-10 px-3 text-xs"
                  onClick={() => {
                    setQuery('')
                    setDebouncedQuery('')
                    setStatusFilter('ALL')
                    setPlanFilter('ALL')
                    setListPage(1)
                  }}
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[72rem] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wider text-ink-soft">
                  <th className="px-2 py-2 font-semibold">Business</th>
                  <th className="px-2 py-2 font-semibold">Status</th>
                  <th className="px-2 py-2 font-semibold">Plan / access</th>
                  <th className="px-2 py-2 font-semibold">Scale</th>
                  <th className="px-2 py-2 font-semibold">Catalogue</th>
                  <th className="px-2 py-2 font-semibold">Trial / paid</th>
                  <th className="px-2 py-2 font-semibold">Activity</th>
                  <th className="px-2 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {businesses.map((b) => (
                  <tr
                    key={b.id}
                    className={`border-b border-line/70 align-top transition hover:bg-royal/[0.04] ${
                      selectedId === b.id ? 'bg-royal/[0.06]' : ''
                    }`}
                  >
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        className="text-left"
                        onClick={() => openDetails(b)}
                      >
                        <p className="font-semibold text-ink">{b.name}</p>
                        <p className="text-[11px] text-ink-soft">
                          {b.industry}
                          {b.owner?.fullName
                            ? ` · ${b.owner.fullName}`
                            : ''}
                          {b.owner?.email ? ` · ${b.owner.email}` : ''}
                        </p>
                        {b.phone ? (
                          <p className="text-[10px] text-ink-soft">{b.phone}</p>
                        ) : null}
                      </button>
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone(b.status)}`}
                      >
                        {b.status}
                      </span>
                      <p className="mt-1 text-[10px] text-ink-soft">
                        {accessLabel(b.subscription)}
                      </p>
                    </td>
                    <td className="px-2 py-3">
                      <p className="font-medium">{b.subscription.planLabel}</p>
                      <p className="text-[11px] text-ink-soft">
                        {b.subscription.priceMonthlyZmw > 0
                          ? `${formatZMW(b.subscription.priceMonthlyZmw)}/mo`
                          : 'Custom'}
                        {b.subscription.fullAccess ? ' · full' : ''}
                      </p>
                    </td>
                    <td className="px-2 py-3 text-[11px] tabular-nums">
                      <div>
                        {b.branchCount}/
                        {b.subscription.entitlements.maxBranches} br
                        <span className="ml-1 text-[10px] text-ink-soft">
                          {b.canAddBranch ? 'ok' : 'cap'}
                        </span>
                      </div>
                      <div
                        className={
                          b.canAddUser
                            ? ''
                            : 'font-semibold text-amber-700 dark:text-amber-300'
                        }
                      >
                        {b.userCount}/{b.subscription.entitlements.maxUsers}{' '}
                        seats
                        {!b.canAddUser ? ' · full' : ''}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-[11px] tabular-nums text-ink-soft">
                      <div>{b._count.products} products</div>
                      <div>{b._count.sales} sales</div>
                    </td>
                    <td className="px-2 py-3 text-[11px] text-ink-soft">
                      <div>Trial {fmtDate(b.trialEndsAt)}</div>
                      <div>Paid {fmtDate(b.subscriptionEndsAt)}</div>
                    </td>
                    <td className="px-2 py-3 text-[11px]">
                      <p className="font-medium text-ink">
                        {fmtRelative(b.lastSaleAt)}
                      </p>
                      <p className="text-ink-soft">{fmtDate(b.lastSaleAt)}</p>
                      <p className="text-[10px] text-ink-soft">
                        Joined {fmtDate(b.createdAt)}
                      </p>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          variant="secondary"
                          className="min-h-8 rounded-lg px-2 text-[10px]"
                          onClick={() => openDetails(b)}
                        >
                          Details
                        </Button>
                        {b.status === 'PENDING_APPROVAL' ? (
                          <Button
                            type="button"
                            className="min-h-8 rounded-lg px-2 text-[10px]"
                            disabled={busyId === b.id}
                            onClick={() => void setStatus(b.id, 'TRIAL')}
                          >
                            Approve
                          </Button>
                        ) : null}
                        {b.status !== 'SUSPENDED' &&
                        b.status !== 'PENDING_APPROVAL' &&
                        b.status !== 'CANCELLED' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="min-h-8 rounded-lg px-2 text-[10px]"
                            disabled={busyId === b.id}
                            onClick={() => void setStatus(b.id, 'SUSPENDED')}
                          >
                            Suspend
                          </Button>
                        ) : b.status === 'SUSPENDED' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            className="min-h-8 rounded-lg px-2 text-[10px]"
                            disabled={busyId === b.id}
                            onClick={() => void setStatus(b.id, 'ACTIVE')}
                          >
                            Reactivate
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {businesses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-2 py-8 text-center text-sm text-ink-soft"
                    >
                      No businesses match these filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {listTotalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <p className="text-xs text-ink-soft">
                Server-paginated · {pageSize} per page
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-9 px-3 text-xs"
                  disabled={listPage <= 1}
                  onClick={() => setListPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-9 px-3 text-xs"
                  disabled={listPage >= listTotalPages}
                  onClick={() =>
                    setListPage((p) => Math.min(listTotalPages, p + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {selected ? (
          <div className="nx-card space-y-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-royal">
                  Shop detail
                </p>
                <h2 className="font-display mt-1 text-xl font-semibold">
                  {selected.name}
                </h2>
                <p className="text-sm text-ink-soft">
                  {selected.industry} · created {fmtDate(selected.createdAt)} ·{' '}
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone(selected.status)}`}
                  >
                    {selected.status}
                  </span>
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setSelectedId(null)
                  setSelected(null)
                }}
              >
                Close
              </Button>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-2 rounded-2xl border border-line p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Owner & contact
                </p>
                <p>
                  <span className="text-ink-soft">Owner: </span>
                  {selected.owner?.fullName || '—'}
                </p>
                <p>
                  <span className="text-ink-soft">Email: </span>
                  {selected.owner?.email || selected.email || '—'}
                </p>
                <p>
                  <span className="text-ink-soft">Phone: </span>
                  {selected.phone || '—'}
                </p>
                <p>
                  <span className="text-ink-soft">Address: </span>
                  {selected.address || '—'}
                </p>
                <p className="pt-2 text-xs text-ink-soft">
                  {selected._count.products} products · {selected._count.sales}{' '}
                  sales · {selected._count.branches} branches ·{' '}
                  {selected._count.memberships} users
                </p>
                <p className="text-xs text-ink-soft">
                  Last sale {fmtRelative(selected.lastSaleAt)}
                  {selected.lastSaleAt
                    ? ` (${fmtDate(selected.lastSaleAt)})`
                    : ''}
                </p>
                {selected.subscription.accessMessage ? (
                  <p className="rounded-lg bg-brand-soft/40 px-2 py-1.5 text-[11px] text-ink">
                    {selected.subscription.accessMessage}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2 rounded-2xl border border-line p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Subscription
                </p>
                <p>
                  <span className="text-ink-soft">Plan: </span>
                  {selected.subscription.planLabel}
                </p>
                <p>
                  <span className="text-ink-soft">Access: </span>
                  {accessLabel(selected.subscription)}
                </p>
                <p className="text-xs text-ink-soft">
                  {selected.subscription.accessMessage}
                </p>
                <p>
                  <span className="text-ink-soft">Branches: </span>
                  {selected.branchCount}/
                  {selected.subscription.entitlements.maxBranches}{' '}
                  {selected.canAddBranch ? '(can add more)' : '(at limit)'}
                </p>
                <p>
                  <span className="text-ink-soft">Staff seats: </span>
                  {selected.userCount}/
                  {selected.subscription.entitlements.maxUsers}{' '}
                  {selected.canAddUser ? (
                    <span className="text-[11px] text-ink-soft">(room)</span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      (at limit)
                    </span>
                  )}
                </p>
                {!selected.canAddUser ? (
                  <p className="rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-900 dark:text-amber-100">
                    Shop cannot invite more staff until you raise the user limit
                    or they deactivate a seat.
                  </p>
                ) : null}
                <p>
                  <span className="text-ink-soft">Billing: </span>
                  {selected.subscription.billingProvider}
                  {selected.subscription.lastPaymentAt
                    ? ` · last pay ${fmtDate(selected.subscription.lastPaymentAt)}`
                    : ''}
                </p>
              </div>

              <div className="space-y-2 rounded-2xl border border-line p-4 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Quick actions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.status === 'PENDING_APPROVAL' ? (
                    <>
                      <Button
                        type="button"
                        className="min-h-9 rounded-lg text-[11px]"
                        disabled={busyId === selected.id}
                        onClick={() => void setStatus(selected.id, 'TRIAL')}
                      >
                        Approve (trial)
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="min-h-9 rounded-lg text-[11px]"
                        disabled={busyId === selected.id}
                        onClick={() => void setStatus(selected.id, 'CANCELLED')}
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                  {selected.status === 'SUSPENDED' ? (
                    <Button
                      type="button"
                      className="min-h-9 rounded-lg text-[11px]"
                      disabled={busyId === selected.id}
                      onClick={() => void setStatus(selected.id, 'ACTIVE')}
                    >
                      Reactivate
                    </Button>
                  ) : selected.status !== 'PENDING_APPROVAL' &&
                    selected.status !== 'CANCELLED' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-9 rounded-lg text-[11px]"
                      disabled={busyId === selected.id}
                      onClick={() => void setStatus(selected.id, 'SUSPENDED')}
                    >
                      Suspend
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-9 rounded-lg text-[11px]"
                    disabled={busyId === selected.id}
                    onClick={() => void startTrial(selected.id)}
                  >
                    Start / extend trial
                  </Button>
                  <Button
                    type="button"
                    className="min-h-9 rounded-lg text-[11px]"
                    disabled={busyId === selected.id}
                    onClick={() =>
                      void charge(selected.id, edit.plan || selected.plan, 'monthly')
                    }
                  >
                    Record month pay
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-9 rounded-lg text-[11px]"
                    disabled={busyId === selected.id}
                    onClick={() =>
                      void charge(selected.id, edit.plan || selected.plan, 'yearly')
                    }
                  >
                    Record year pay
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-line p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Plan & limits
                </p>
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-semibold text-ink-soft">
                    Plan
                  </span>
                  <select
                    className="nx-field"
                    value={edit.plan}
                    onChange={(e) => {
                      const planId = e.target.value
                      const p = plans.find((x) => x.id === planId)
                      setEdit((prev) => ({
                        ...prev,
                        plan: planId,
                        maxBranches: p ? String(p.maxBranches) : prev.maxBranches,
                        maxUsers: p ? String(p.maxUsers) : prev.maxUsers,
                      }))
                    }}
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Branch limit"
                    type="number"
                    min={1}
                    value={edit.maxBranches}
                    onChange={(e) =>
                      setEdit((prev) => ({
                        ...prev,
                        maxBranches: e.target.value,
                      }))
                    }
                  />
                  <Input
                    label="User limit"
                    type="number"
                    min={1}
                    value={edit.maxUsers}
                    onChange={(e) =>
                      setEdit((prev) => ({
                        ...prev,
                        maxUsers: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Trial ends"
                    type="date"
                    value={edit.trialEndsAt}
                    onChange={(e) =>
                      setEdit((prev) => ({
                        ...prev,
                        trialEndsAt: e.target.value,
                      }))
                    }
                  />
                  <Input
                    label="Paid through"
                    type="date"
                    value={edit.subscriptionEndsAt}
                    onChange={(e) =>
                      setEdit((prev) => ({
                        ...prev,
                        subscriptionEndsAt: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-line p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Modules
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {MODULE_LABELS.map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-center gap-2 rounded-xl border border-line px-2.5 py-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(edit.modules[key])}
                        onChange={(e) =>
                          setEdit((prev) => ({
                            ...prev,
                            modules: {
                              ...prev.modules,
                              [key]: e.target.checked,
                            },
                          }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {billingEvents.length > 0 ? (
              <div className="rounded-2xl border border-line p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Recent billing / signup events
                </p>
                <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-xs">
                  {billingEvents.map((ev) => (
                    <li
                      key={ev.id}
                      className="flex justify-between gap-2 border-b border-line/60 py-1.5"
                    >
                      <span>
                        {ev.kind}
                        {ev.plan ? ` · ${ev.plan}` : ''}
                        {ev.note ? ` — ${ev.note}` : ''}
                      </span>
                      <span className="shrink-0 tabular-nums text-ink-soft">
                        {fmtDate(ev.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <Button
              type="button"
              disabled={busyId === selected.id}
              onClick={() => void saveEntitlements(selected.id)}
            >
              Save plan, limits & modules
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
