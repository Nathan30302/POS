import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Users } from 'lucide-react'
import { ToolbarSearch } from '@/components/ToolbarSearch'
import { EmptyState, LoadingBlock } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { formatZMW } from '@/lib/money'

type Customer = {
  id: string
  fullName: string
  phone: string | null
  email: string | null
  creditLimit: number
  balance: number
  loyaltyPts: number
  notes: string | null
}

type CreditSummary = {
  summary: {
    customersWithBalance: number
    totalOutstanding: number
    overdueCount: number
    overdueAmount: number
    overdueDays: number
  }
  overdue: Array<{
    id: string
    fullName: string
    balance: number
    creditLimit: number
    overdue: boolean
  }>
  outstanding: Array<{
    id: string
    fullName: string
    balance: number
    creditLimit: number
    available: number
    overdue: boolean
  }>
}

const emptyForm = {
  fullName: '',
  phone: '',
  email: '',
  creditLimit: '0',
  notes: '',
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [credit, setCredit] = useState<CreditSummary | null>(null)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [payFor, setPayFor] = useState<Customer | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [ledgerFor, setLedgerFor] = useState<Customer | null>(null)
  const [ledger, setLedger] = useState<
    Array<{
      type: string
      id: string
      amount: number
      paymentMethod: string
      status: string
      createdAt: string
      actor: string | null
    }>
  >([])

  async function load(q = query) {
    const [data, creditData] = await Promise.all([
      api<{ customers: Customer[] }>(
        `/customers${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`,
      ),
      api<CreditSummary>('/customers/credit-summary').catch(() => null),
    ])
    setCustomers(data.customers)
    if (creditData) setCredit(creditData)
    setHasLoaded(true)
  }

  useEffect(() => {
    setLoading(true)
    void load('')
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load customers'),
      )
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!hasLoaded) return
    const id = window.setTimeout(() => {
      void load(query).catch(() => undefined)
    }, 250)
    return () => window.clearTimeout(id)
  }, [query])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setOk('')
    try {
      await api('/customers', {
        method: 'POST',
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone || undefined,
          email: form.email || undefined,
          creditLimit: Number(form.creditLimit) || 0,
          notes: form.notes || undefined,
        }),
      })
      setForm(emptyForm)
      setOpen(false)
      setOk('Customer saved.')
      window.setTimeout(() => setOk(''), 2200)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save customer')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm('Remove this customer?')) return
    try {
      await api(`/customers/${id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  async function bumpLoyalty(c: Customer) {
    try {
      await api(`/customers/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ loyaltyPts: c.loyaltyPts + 10 }),
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  async function recordPayment() {
    if (!payFor) return
    setBusy(true)
    setError('')
    try {
      await api(`/customers/${payFor.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(payAmount),
          method: 'CASH',
        }),
      })
      setPayFor(null)
      setPayAmount('')
      setOk('Credit payment recorded')
      window.setTimeout(() => setOk(''), 2200)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setBusy(false)
    }
  }

  async function openLedger(c: Customer) {
    setLedgerFor(c)
    try {
      const data = await api<{
        history: typeof ledger
      }>(`/customers/${c.id}/ledger`)
      setLedger(data.history)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load ledger')
      setLedger([])
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 sm:space-y-5">
      <PageHero
        eyebrow="Relationships · CRM"
        title="Customers"
        subtitle="Loyalty, credit, and quick lookup for the counter."
        actions={
          <Button type="button" onClick={() => setOpen((v) => !v)}>
            <Plus className="h-4 w-4" />
            {open ? 'Close form' : 'Add customer'}
          </Button>
        }
      />

      {error ? <FormBanner tone="error">{error}</FormBanner> : null}
      {ok ? <FormBanner tone="ok">{ok}</FormBanner> : null}

      {credit ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="nx-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Credit outstanding
            </p>
            <p className="mt-1 text-xl font-bold text-ink">
              {formatZMW(credit.summary.totalOutstanding)}
            </p>
            <p className="text-xs text-ink-soft">
              {credit.summary.customersWithBalance} customers
            </p>
          </div>
          <div className="nx-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Overdue (~{credit.summary.overdueDays}d+)
            </p>
            <p className="mt-1 text-xl font-bold text-ink">
              {formatZMW(credit.summary.overdueAmount)}
            </p>
            <p className="text-xs text-ink-soft">
              {credit.summary.overdueCount} accounts
            </p>
          </div>
          <div className="nx-card p-4 text-xs text-ink-soft">
            Credit sales need the{' '}
            <span className="font-semibold text-ink">credit_sales</span>{' '}
            permission on Sell. Issuance is audited with employee + customer.
            <Link
              to="/app/checkout"
              className="mt-2 block font-semibold text-royal hover:underline"
            >
              Open Sell
            </Link>
          </div>
        </div>
      ) : null}

      {credit && credit.overdue.length > 0 ? (
        <section className="nx-card p-4">
          <h3 className="font-semibold text-ink">Overdue alerts</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {credit.overdue.slice(0, 8).map((c) => (
              <li
                key={c.id}
                className="flex justify-between rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-950/30"
              >
                <span>{c.fullName}</span>
                <strong>{formatZMW(c.balance)}</strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {open ? (
        <form
          onSubmit={onCreate}
          className="nx-card grid gap-3.5 p-4 sm:grid-cols-2 sm:p-5"
        >
          <div className="sm:col-span-2">
            <h3 className="nx-section-title text-base">New customer</h3>
            <p className="mt-0.5 text-xs text-ink-soft">
              Contact and credit — loyalty starts at zero.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Full name"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="e.g. Chanda Banda"
            />
          </div>
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="097…"
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Credit limit (ZMW)"
            type="number"
            min="0"
            value={form.creditLimit}
            onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
          />
          <Input
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <div className="flex flex-wrap gap-2 border-t border-line/70 pt-3 sm:col-span-2">
            <Button type="submit" disabled={busy} className="min-h-11">
              {busy ? 'Saving…' : 'Save customer'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {payFor ? (
        <div className="nx-card space-y-3 p-4">
          <h3 className="font-semibold text-ink">
            Record payment · {payFor.fullName}
          </h3>
          <p className="text-xs text-ink-soft">
            Outstanding {formatZMW(payFor.balance)}
          </p>
          <Input
            label="Amount (ZMW)"
            type="number"
            min="0.01"
            step="0.01"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={busy || !payAmount}
              onClick={() => void recordPayment()}
            >
              Save payment
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPayFor(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {ledgerFor ? (
        <div className="nx-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-ink">
              History · {ledgerFor.fullName}
            </h3>
            <Button
              type="button"
              variant="secondary"
              className="min-h-9 px-3 py-1.5 text-xs"
              onClick={() => setLedgerFor(null)}
            >
              Close
            </Button>
          </div>
          <ul className="max-h-64 space-y-1.5 overflow-y-auto text-sm">
            {ledger.length === 0 ? (
              <li className="text-ink-soft">No sales or payments yet.</li>
            ) : (
              ledger.map((h) => (
                <li
                  key={`${h.type}-${h.id}`}
                  className="flex justify-between gap-2 rounded-lg bg-surface px-3 py-2"
                >
                  <span>
                    {h.type === 'payment' ? 'Payment' : 'Sale'} ·{' '}
                    {h.paymentMethod.replaceAll('_', ' ')}
                    {h.actor ? ` · ${h.actor}` : ''}
                    <span className="block text-xs text-ink-soft">
                      {new Date(h.createdAt).toLocaleString()}
                    </span>
                  </span>
                  <strong>
                    {h.type === 'payment' ? '−' : ''}
                    {formatZMW(h.amount)}
                  </strong>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      <ToolbarSearch
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Name, phone, email…"
        aria-label="Search customers"
      />

      <div className="nx-card overflow-hidden">
        {loading ? (
          <LoadingBlock label="Loading customers…" />
        ) : customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title={
              query.trim()
                ? `No results for “${query.trim()}”`
                : 'No customers yet'
            }
            body={
              query.trim()
                ? 'Try another name, phone, or email.'
                : 'Add regulars for loyalty points, credit limits, and faster repeat sales.'
            }
            action={
              !query.trim() ? (
                <Button type="button" onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add customer
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {customers.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{c.fullName}</p>
                  <p className="text-xs text-ink-soft">
                    {[c.phone, c.email].filter(Boolean).join(' · ') ||
                      'No contact yet'}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    Loyalty {c.loyaltyPts} pts · Credit limit{' '}
                    {formatZMW(c.creditLimit)} · Balance{' '}
                    <span
                      className={
                        c.balance > 0 ? 'font-semibold text-warn' : undefined
                      }
                    >
                      {formatZMW(c.balance)}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.balance > 0 ? (
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-9 px-3 py-1.5 text-xs"
                      onClick={() => {
                        setPayFor(c)
                        setPayAmount(String(c.balance))
                      }}
                    >
                      Pay credit
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-9 px-3 py-1.5 text-xs"
                    onClick={() => void openLedger(c)}
                  >
                    History
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-9 px-3 py-1.5 text-xs"
                    onClick={() => void bumpLoyalty(c)}
                  >
                    +10 pts
                  </Button>
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-ink-soft transition hover:border-danger/40 hover:bg-danger/10 hover:text-danger"
                    onClick={() => void onDelete(c.id)}
                    aria-label="Delete customer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
