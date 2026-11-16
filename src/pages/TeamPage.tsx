import { useEffect, useState, type FormEvent } from 'react'
import { KeyRound, Plus, Shield, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import {
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  type Permission,
} from '@/lib/permissions'

type Member = {
  membershipId: string
  role: string
  active: boolean
  permissions: string[]
  user: {
    id: string
    email: string
    fullName: string
    phone: string | null
    active: boolean
  }
}

type RoleMeta = {
  roles: string[]
  permissions: Permission[]
  defaults: Record<string, Permission[]>
}

const emptyForm = {
  fullName: '',
  email: '',
  password: '',
  phone: '',
  role: 'CASHIER',
  permissions: [] as Permission[],
}

export function TeamPage() {
  const { isOwnerLike } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [meta, setMeta] = useState<RoleMeta | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const [list, roles] = await Promise.all([
      api<{ members: Member[] }>('/team'),
      api<RoleMeta>('/team/roles'),
    ])
    setMembers(list.members)
    setMeta(roles)
  }

  useEffect(() => {
    if (!isOwnerLike) return
    void load().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load team'),
    )
  }, [isOwnerLike])

  function applyRoleDefaults(role: string) {
    const defaults = meta?.defaults[role] || ['sell']
    setForm((f) => ({ ...f, role, permissions: [...defaults] }))
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/team', {
        method: 'POST',
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          phone: form.phone || undefined,
          role: form.role,
          permissions: form.permissions,
        }),
      })
      setForm(emptyForm)
      setOpen(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account')
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    setBusy(true)
    setError('')
    try {
      await api(`/team/${editing.membershipId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: editing.user.fullName,
          phone: editing.user.phone,
          role: editing.role === 'OWNER' ? undefined : editing.role,
          permissions: editing.permissions,
          active: editing.active,
          password: resetPassword || undefined,
        }),
      })
      setEditing(null)
      setResetPassword('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function deactivate(member: Member) {
    if (!window.confirm(`Deactivate ${member.user.fullName}? They will lose access.`)) {
      return
    }
    try {
      await api(`/team/${member.membershipId}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not deactivate')
    }
  }

  if (!isOwnerLike) {
    return (
      <div className="nx-card mx-auto max-w-lg p-8 text-center">
        <Shield className="mx-auto h-8 w-8 text-ink-soft" />
        <h2 className="mt-3 font-display text-xl font-bold">Team access locked</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Only the business owner or admin can create staff accounts and set permissions.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-royal">
            Access
          </p>
          <h2 className="nx-page-title mt-1 font-display">Team</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Create logins for cashiers, salespeople, and managers — then set exactly what
            each person can do.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setOpen((v) => !v)
            if (meta) applyRoleDefaults('CASHIER')
          }}
        >
          <UserPlus className="h-4 w-4" />
          {open ? 'Close' : 'Add staff'}
        </Button>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>
      ) : null}

      {open ? (
        <form onSubmit={onCreate} className="nx-card space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              placeholder="Full name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-royal"
            />
            <input
              required
              type="email"
              placeholder="Login email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-royal"
            />
            <input
              required
              type="password"
              minLength={8}
              placeholder="Temporary password (min 8)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-royal"
            />
            <input
              placeholder="Phone (optional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-royal"
            />
            <select
              value={form.role}
              onChange={(e) => applyRoleDefaults(e.target.value)}
              className="rounded-xl border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-royal sm:col-span-2"
            >
              {(meta?.roles || Object.keys(ROLE_LABELS).filter((r) => r !== 'OWNER')).map(
                (role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role] || role}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Permissions
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ALL_PERMISSIONS.map((perm) => (
                <label
                  key={perm}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.permissions.includes(perm)}
                    onChange={(e) => {
                      setForm((f) => ({
                        ...f,
                        permissions: e.target.checked
                          ? [...f.permissions, perm]
                          : f.permissions.filter((p) => p !== perm),
                      }))
                    }}
                  />
                  {PERMISSION_LABELS[perm]}
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" disabled={busy}>
            <Plus className="h-4 w-4" />
            Create account
          </Button>
        </form>
      ) : null}

      <div className="nx-card overflow-hidden">
        {members.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <Users className="h-8 w-8 text-ink-soft" />
            <p className="text-sm text-ink-soft">No team members yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li
                key={m.membershipId}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-ink">
                    {m.user.fullName}
                    {!m.active ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                        inactive
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {m.user.email} · {ROLE_LABELS[m.role] || m.role}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-soft">
                    {m.permissions.map((p) => PERMISSION_LABELS[p as Permission] || p).join(' · ')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditing(m)
                      setResetPassword('')
                    }}
                  >
                    Edit access
                  </Button>
                  {m.role !== 'OWNER' ? (
                    <Button type="button" variant="secondary" onClick={() => void deactivate(m)}>
                      Deactivate
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <form
            onSubmit={saveEdit}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-card p-6 shadow-2xl"
          >
            <h3 className="font-display text-xl font-bold">Edit {editing.user.fullName}</h3>
            <div className="mt-4 space-y-3">
              <input
                value={editing.user.fullName}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    user: { ...editing.user, fullName: e.target.value },
                  })
                }
                className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
              />
              <input
                value={editing.user.phone || ''}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    user: { ...editing.user, phone: e.target.value },
                  })
                }
                placeholder="Phone"
                className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
              />
              {editing.role !== 'OWNER' ? (
                <select
                  value={editing.role}
                  onChange={(e) => {
                    const role = e.target.value
                    const defaults = meta?.defaults[role] || editing.permissions
                    setEditing({
                      ...editing,
                      role,
                      permissions: [...defaults],
                    })
                  }}
                  className="w-full rounded-xl border border-line px-3 py-2.5 text-sm"
                >
                  {(meta?.roles || []).map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role] || role}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="grid gap-2">
                {ALL_PERMISSIONS.map((perm) => (
                  <label key={perm} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editing.permissions.includes(perm)}
                      disabled={editing.role === 'OWNER'}
                      onChange={(e) => {
                        setEditing({
                          ...editing,
                          permissions: e.target.checked
                            ? [...editing.permissions, perm]
                            : editing.permissions.filter((p) => p !== perm),
                        })
                      }}
                    />
                    {PERMISSION_LABELS[perm]}
                  </label>
                ))}
              </div>
              <div className="rounded-xl border border-line bg-surface/70 p-3">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  <KeyRound className="h-3.5 w-3.5" />
                  Reset password
                </p>
                <input
                  type="password"
                  minLength={8}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm"
                />
              </div>
              {editing.role !== 'OWNER' ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editing.active}
                    onChange={(e) =>
                      setEditing({ ...editing, active: e.target.checked })
                    }
                  />
                  Account active
                </label>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditing(null)
                  setResetPassword('')
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Save changes
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}
