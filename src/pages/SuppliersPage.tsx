import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Truck } from 'lucide-react'
import { EmptyState, LoadingBlock } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
type Supplier = {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  orderCount?: number
  productCount?: number
}

const empty = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
}

export function SuppliersPage() {
  const { can } = useAuth()
  const canManage = can('inventory')

  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState(empty)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api<{ suppliers: Supplier[] }>('/purchasing/suppliers')
      setSuppliers(data.suppliers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suppliers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function flash(msg: string) {
    setOk(msg)
    window.setTimeout(() => setOk(''), 2200)
  }

  function startEdit(s: Supplier) {
    setEditing(s)
    setForm({
      name: s.name,
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      notes: s.notes || '',
    })
    setOpen(true)
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!canManage) return
    setBusy(true)
    setError('')
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }
      if (editing) {
        await api(`/purchasing/suppliers/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        flash('Supplier updated')
      } else {
        await api('/purchasing/suppliers', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        flash('Supplier created')
      }
      setForm(empty)
      setEditing(null)
      setOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm('Delete this supplier?')) return
    try {
      await api(`/purchasing/suppliers/${id}`, { method: 'DELETE' })
      flash('Supplier deleted')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 sm:space-y-5">
      <PageHero
        eyebrow="Purchasing · vendors"
        title="Suppliers"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/app/purchasing"
              className="inline-flex items-center rounded-xl border border-line px-3 py-2 text-sm font-semibold text-royal hover:bg-surface"
            >
              Purchase orders
            </Link>
            {canManage ? (
              <Button
                type="button"
                onClick={() => {
                  setEditing(null)
                  setForm(empty)
                  setOpen((v) => !v)
                }}
              >
                <Plus className="h-4 w-4" />
                {open && !editing ? 'Close' : 'Add supplier'}
              </Button>
            ) : null}
          </div>
        }
      />

      {error ? <FormBanner tone="error">{error}</FormBanner> : null}
      {ok ? <FormBanner tone="ok">{ok}</FormBanner> : null}

      {open && canManage ? (
        <form
          onSubmit={onSave}
          className="nx-card grid gap-3.5 p-4 sm:grid-cols-2 sm:p-5"
        >
          <div className="sm:col-span-2">
            <h3 className="font-semibold text-ink">
              {editing ? 'Edit supplier' : 'New supplier'}
            </h3>
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <div className="sm:col-span-2">
            <Input
              label="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Input
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Update' : 'Create'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false)
                setEditing(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      <div className="nx-card overflow-hidden">
        {loading ? (
          <LoadingBlock label="Loading suppliers…" />
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No suppliers yet"
            body="Add wholesalers and link them as preferred suppliers on products or POs."
            action={
              canManage ? (
                <Button type="button" onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add supplier
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {suppliers.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div>
                  <p className="font-semibold text-ink">{s.name}</p>
                  <p className="text-xs text-ink-soft">
                    {[s.phone, s.email, s.address].filter(Boolean).join(' · ') ||
                      'No contact yet'}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {s.orderCount ?? 0} POs · {s.productCount ?? 0} preferred
                    products
                    {s.notes ? ` · ${s.notes}` : ''}
                  </p>
                </div>
                {canManage ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-9 px-3 py-1.5 text-xs"
                      onClick={() => startEdit(s)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="min-h-9 px-3 py-1.5 text-xs"
                      onClick={() => void onDelete(s.id)}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-ink-soft">
        Tip: set preferred supplier on a product, then create a PO from{' '}
        <Link to="/app/purchasing" className="font-semibold text-royal">
          Purchasing
        </Link>
        . Receiving a PO updates weighted average cost and can set preferred
        supplier.
      </p>
    </div>
  )
}
