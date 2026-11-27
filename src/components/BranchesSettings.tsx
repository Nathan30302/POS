import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, MapPin, Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { getActiveBranchId, setActiveBranchId } from '@/lib/branch'

type Branch = {
  id: string
  name: string
  code?: string | null
  address?: string | null
  phone?: string | null
  isMain: boolean
}

const emptyForm = {
  name: '',
  code: '',
  address: '',
  phone: '',
}

export function BranchesSettings() {
  const { isOwnerLike } = useAuth()
  const [branches, setBranches] = useState<Branch[]>([])
  const [activeId, setActiveId] = useState(getActiveBranchId() || '')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async () => {
    try {
      const data = await api<{
        branches: Branch[]
        activeBranchId: string | null
      }>('/branches')
      setBranches(data.branches)
      const next =
        getActiveBranchId() ||
        data.activeBranchId ||
        data.branches.find((b) => b.isMain)?.id ||
        data.branches[0]?.id ||
        ''
      if (next && next !== getActiveBranchId()) {
        setActiveBranchId(next)
      }
      setActiveId(next)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load branches')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function selectActive(id: string) {
    setActiveId(id)
    setActiveBranchId(id || null)
    try {
      await api('/branches/active', {
        method: 'POST',
        body: JSON.stringify({ branchId: id || null }),
      })
    } catch {
      /* local header still applies */
    }
  }

  function startAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setShowAdd(true)
    setOk('')
    setError('')
  }

  function startEdit(branch: Branch) {
    setShowAdd(false)
    setEditingId(branch.id)
    setForm({
      name: branch.name,
      code: branch.code || '',
      address: branch.address || '',
      phone: branch.phone || '',
    })
    setOk('')
    setError('')
  }

  function cancelForm() {
    setShowAdd(false)
    setEditingId(null)
    setForm(emptyForm)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!isOwnerLike) return
    setBusy(true)
    setError('')
    setOk('')
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
      }
      if (editingId) {
        await api(`/branches/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        setOk('Branch updated.')
      } else {
        await api('/branches', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        setOk('Branch added.')
      }
      cancelForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save branch')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && !showAdd && !editingId ? (
        <FormBanner tone="error">{error}</FormBanner>
      ) : null}

      <ul className="space-y-2">
        {branches.map((b) => {
          const isActive = b.id === activeId
          return (
            <li
              key={b.id}
              className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-3 ${
                isActive
                  ? 'border-royal/40 bg-royal/10'
                  : 'border-line bg-surface'
              }`}
            >
              <button
                type="button"
                onClick={() => void selectActive(b.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-royal" />
                  <span className="truncate">{b.name}</span>
                  {b.isMain ? (
                    <span className="rounded-md bg-card px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft ring-1 ring-line">
                      Main
                    </span>
                  ) : null}
                  {isActive ? (
                    <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                      Active
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-ink-soft">
                  {[b.code, b.address, b.phone].filter(Boolean).join(' · ') ||
                    'Tap to make active'}
                </span>
              </button>
              {isOwnerLike ? (
                <button
                  type="button"
                  onClick={() => startEdit(b)}
                  className="inline-flex items-center gap-1 rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-royal/40 hover:text-ink"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>

      {branches.length === 0 ? (
        <p className="text-sm text-ink-soft">No branches loaded yet.</p>
      ) : null}

      {isOwnerLike ? (
        <div className="space-y-3">
          {!showAdd && !editingId ? (
            <Button type="button" variant="secondary" onClick={startAdd}>
              <Plus className="h-4 w-4" />
              Add branch
            </Button>
          ) : (
            <form
              onSubmit={onSubmit}
              className="space-y-3 rounded-2xl border border-line bg-surface p-4"
            >
              <h4 className="text-sm font-semibold text-ink">
                {editingId ? 'Edit branch' : 'New branch'}
              </h4>
              <Input
                label="Name"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                placeholder="Downtown counter"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Code"
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value }))
                  }
                  placeholder="DT"
                  hint="Optional short code"
                />
                <Input
                  label="Phone"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  placeholder="Optional"
                />
              </div>
              <Input
                label="Address"
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                placeholder="Optional street / area"
              />
              {error ? <FormBanner tone="error">{error}</FormBanner> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy} className="min-h-11">
                  {busy ? (
                    'Saving…'
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      {editingId ? 'Save changes' : 'Create branch'}
                    </>
                  )}
                </Button>
                <Button type="button" variant="secondary" onClick={cancelForm}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
          {ok ? <FormBanner tone="ok">{ok}</FormBanner> : null}
        </div>
      ) : (
        <p className="text-xs text-ink-soft">
          Only owners and admins can add or rename branches. You can still
          switch the active location when more than one exists.
        </p>
      )}
    </div>
  )
}
