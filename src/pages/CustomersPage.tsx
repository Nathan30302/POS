import { useEffect, useState, type FormEvent } from 'react'
import { Plus, Search, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
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

const emptyForm = {
  fullName: '',
  phone: '',
  email: '',
  creditLimit: '0',
  notes: '',
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)

  async function load(q = query) {
    const data = await api<{ customers: Customer[] }>(
      `/customers${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`,
    )
    setCustomers(data.customers)
  }

  useEffect(() => {
    void load('').catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load customers'),
    )
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load(query).catch(() => undefined)
    }, 250)
    return () => window.clearTimeout(id)
  }, [query])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-royal">
            Relationships
          </p>
          <h2 className="nx-page-title mt-1 font-display">Customers</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Profiles, loyalty, and credit — the people side of your shop OS.
          </p>
        </div>
        <Button type="button" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4" />
          {open ? 'Close' : 'Add customer'}
        </Button>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>
      ) : null}

      {open ? (
        <form onSubmit={onCreate} className="nx-card grid gap-3 p-5 sm:grid-cols-2">
          <input
            required
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-royal sm:col-span-2"
          />
          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-royal"
          />
          <input
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-royal"
          />
          <input
            placeholder="Credit limit"
            type="number"
            min="0"
            value={form.creditLimit}
            onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
            className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-royal"
          />
          <input
            placeholder="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-royal"
          />
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy}>
              Save customer
            </Button>
          </div>
        </form>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone, email…"
          className="w-full rounded-xl border border-line bg-card py-2.5 pl-10 pr-3 text-sm outline-none focus:border-royal"
        />
      </div>

      <div className="nx-card overflow-hidden">
        {customers.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <Users className="h-8 w-8 text-ink-soft" />
            <p className="text-sm text-ink-soft">No customers yet — add your first regular.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {customers.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-ink">{c.fullName}</p>
                  <p className="text-xs text-ink-soft">
                    {[c.phone, c.email].filter(Boolean).join(' · ') || 'No contact yet'}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    Loyalty {c.loyaltyPts} pts · Credit limit {formatZMW(c.creditLimit)} ·
                    Balance {formatZMW(c.balance)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void bumpLoyalty(c)}
                  >
                    +10 pts
                  </Button>
                  <button
                    type="button"
                    className="rounded-xl border border-line px-3 py-2 text-ink-soft hover:border-danger/40 hover:text-danger"
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
