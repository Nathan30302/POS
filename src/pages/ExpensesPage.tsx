import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Download, Plus, Wallet } from 'lucide-react'
import { EmptyState, LoadingBlock } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { downloadCsv } from '@/lib/csv'
import { formatZMW } from '@/lib/money'

type Branch = { id: string; name: string }
type Expense = {
  id: string
  category: string
  amount: number
  paymentMethod: string
  note: string | null
  spentAt: string
  status: string
  branch: { id: string; name: string } | null
  recordedBy: { id: string; fullName: string } | null
  approvedBy: { id: string; fullName: string } | null
}

type Summary = {
  total: number
  count: number
  pendingCount: number
  pendingAmount: number
  largeThreshold: number
}

const PAY_OPTS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'MTN_MOMO', label: 'MTN MoMo' },
  { value: 'AIRTEL_MONEY', label: 'Airtel Money' },
  { value: 'CARD', label: 'Card' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'OTHER', label: 'Other' },
]

export function ExpensesPage() {
  const { can, user } = useAuth()
  const canWrite = can('expenses')
  const canApprove = ['OWNER', 'ADMIN', 'BRANCH_MANAGER'].includes(
    user?.role || '',
  )

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')

  const [form, setForm] = useState({
    category: 'Rent',
    amount: '',
    paymentMethod: 'CASH',
    note: '',
    branchId: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (categoryFilter) params.set('category', categoryFilter)
      if (statusFilter) params.set('status', statusFilter)
      if (branchFilter) params.set('branchId', branchFilter)
      const qs = params.toString() ? `?${params}` : ''
      const [ex, br] = await Promise.all([
        api<{
          expenses: Expense[]
          categories: string[]
          summary: Summary
        }>(`/expenses${qs}`),
        api<{ branches: Branch[] }>('/branches'),
      ])
      setExpenses(ex.expenses)
      setCategories(ex.categories)
      setSummary(ex.summary)
      setBranches(br.branches)
      setForm((f) => ({
        ...f,
        branchId: f.branchId || br.branches[0]?.id || '',
        category: f.category || ex.categories[0] || 'Other',
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenses')
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, statusFilter, branchFilter])

  useEffect(() => {
    void load()
  }, [load])

  function flash(msg: string) {
    setOk(msg)
    window.setTimeout(() => setOk(''), 2200)
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!canWrite) return
    setBusy(true)
    setError('')
    try {
      await api('/expenses', {
        method: 'POST',
        body: JSON.stringify({
          category: form.category,
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod,
          note: form.note.trim() || undefined,
          branchId: form.branchId || undefined,
        }),
      })
      setForm((f) => ({ ...f, amount: '', note: '' }))
      setOpen(false)
      flash('Expense recorded')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save expense')
    } finally {
      setBusy(false)
    }
  }

  async function approve(id: string) {
    setBusy(true)
    try {
      await api(`/expenses/${id}/approve`, { method: 'POST', body: '{}' })
      flash('Expense approved')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed')
    } finally {
      setBusy(false)
    }
  }

  async function reject(id: string) {
    setBusy(true)
    try {
      await api(`/expenses/${id}/reject`, { method: 'POST', body: '{}' })
      flash('Expense rejected')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject failed')
    } finally {
      setBusy(false)
    }
  }

  function exportCsv() {
    const header = [
      'date',
      'category',
      'amount',
      'payment',
      'status',
      'branch',
      'recorded_by',
      'note',
    ]
    const rows = expenses.map((e) =>
      [
        e.spentAt,
        e.category,
        e.amount,
        e.paymentMethod,
        e.status,
        e.branch?.name || '',
        e.recordedBy?.fullName || '',
        (e.note || '').replaceAll(',', ';'),
      ].join(','),
    )
    downloadCsv(
      `nexora-expenses-${new Date().toISOString().slice(0, 10)}.csv`,
      [header.join(','), ...rows].join('\n'),
    )
  }

  const pending = useMemo(
    () => expenses.filter((e) => e.status === 'PENDING_APPROVAL'),
    [expenses],
  )

  return (
    <div className="mx-auto max-w-5xl space-y-4 sm:space-y-5">
      <PageHero
        eyebrow="Money · ops"
        title="Expenses"
        subtitle="Record shop costs so Pulse and Command show true profit."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={exportCsv}>
              <Download className="h-4 w-4" />
              CSV
            </Button>
            {canWrite ? (
              <Button type="button" onClick={() => setOpen((v) => !v)}>
                <Plus className="h-4 w-4" />
                {open ? 'Close' : 'Record expense'}
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? <FormBanner tone="error">{error}</FormBanner> : null}
      {ok ? <FormBanner tone="ok">{ok}</FormBanner> : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="nx-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Logged total
            </p>
            <p className="mt-1 text-xl font-bold text-ink">
              {formatZMW(summary.total)}
            </p>
            <p className="text-xs text-ink-soft">{summary.count} entries</p>
          </div>
          <div className="nx-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Pending approval
            </p>
            <p className="mt-1 text-xl font-bold text-ink">
              {formatZMW(summary.pendingAmount)}
            </p>
            <p className="text-xs text-ink-soft">
              {summary.pendingCount} · threshold{' '}
              {formatZMW(summary.largeThreshold)}
            </p>
          </div>
          <div className="nx-card p-4">
            <p className="text-xs text-ink-soft">
              Large expenses (≥ {formatZMW(summary.largeThreshold)}) need owner
              approval unless recorded by a manager.
            </p>
          </div>
        </div>
      ) : null}

      {open && canWrite ? (
        <form
          onSubmit={onCreate}
          className="nx-card grid gap-3.5 p-4 sm:grid-cols-2 sm:p-5"
        >
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Category
            </span>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
            >
              {(categories.length ? categories : ['Other']).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Amount (ZMW)"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Payment method
            </span>
            <select
              value={form.paymentMethod}
              onChange={(e) =>
                setForm({ ...form, paymentMethod: e.target.value })
              }
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
            >
              {PAY_OPTS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Branch
            </span>
            <select
              value={form.branchId}
              onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <Input
              label="Notes"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Optional"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              <Wallet className="h-4 w-4" />
              {busy ? 'Saving…' : 'Save expense'}
            </Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="RECORDED">Recorded</option>
          <option value="PENDING_APPROVAL">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="nx-card overflow-hidden">
        {loading ? (
          <LoadingBlock label="Loading expenses…" />
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No expenses yet"
            body="Record rent, utilities, transport, and other shop costs. No tax fields."
            action={
              canWrite ? (
                <Button type="button" onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Record expense
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {expenses.map((e) => (
              <li
                key={e.id}
                className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div>
                  <p className="font-semibold text-ink">
                    {e.category} · {formatZMW(e.amount)}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {e.status}
                    {e.branch ? ` · ${e.branch.name}` : ''} ·{' '}
                    {e.paymentMethod.replaceAll('_', ' ')} ·{' '}
                    {new Date(e.spentAt).toLocaleString()}
                    {e.recordedBy ? ` · ${e.recordedBy.fullName}` : ''}
                  </p>
                  {e.note ? (
                    <p className="mt-1 text-xs text-ink-soft">{e.note}</p>
                  ) : null}
                </div>
                {canApprove && e.status === 'PENDING_APPROVAL' ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="min-h-9 px-3 py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => void approve(e.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-9 px-3 py-1.5 text-xs"
                      disabled={busy}
                      onClick={() => void reject(e.id)}
                    >
                      Reject
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {pending.length > 0 && canApprove ? (
        <p className="text-xs text-ink-soft">
          {pending.length} expense(s) awaiting your approval.
        </p>
      ) : null}
    </div>
  )
}
