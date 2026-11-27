import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Plus, Shield, UserPlus, Users } from 'lucide-react'
import { EmptyState, LoadingBlock } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/Input'
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

type SeatInfo = {
  used: number
  max: number
  canAdd: boolean
  planLabel: string | null
  message: string
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
  const [seats, setSeats] = useState<SeatInfo | null>(null)
  const [meta, setMeta] = useState<RoleMeta | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  async function load() {
    const [list, roles] = await Promise.all([
      api<{ members: Member[]; seats?: SeatInfo }>('/team'),
      api<RoleMeta>('/team/roles'),
    ])
    setMembers(list.members)
    setSeats(list.seats ?? null)
    setMeta(roles)
  }

  useEffect(() => {
    if (!isOwnerLike) {
      setLoading(false)
      return
    }
    setLoading(true)
    void load()
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load team'),
      )
      .finally(() => setLoading(false))
  }, [isOwnerLike])

  function applyRoleDefaults(role: string) {
    const defaults = meta?.defaults[role] || ['sell']
    setForm((f) => ({ ...f, role, permissions: [...defaults] }))
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setOk('')
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
      setOk('Team member created.')
      window.setTimeout(() => setOk(''), 2200)
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
    setOk('')
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
      setOk('Member updated.')
      window.setTimeout(() => setOk(''), 2200)
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
      <div className="mx-auto max-w-lg space-y-4">
        <PageHero
          eyebrow="Access · people"
          title="Team & permissions"
        />
        <div className="nx-card flex flex-col items-center px-6 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-card text-ink-soft">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="font-display mt-3 text-xl font-bold text-ink">
            Team access locked
          </h2>
          <p className="mt-2 max-w-sm text-sm text-ink-soft">
            Only the business owner or admin can create staff accounts and set
            permissions.
          </p>
          <Link to="/app/checkout" className="mt-6">
            <Button type="button">Back to Sell</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 sm:space-y-5">
      <PageHero
        eyebrow="Access · people"
        title="Team & permissions"
        actions={
          <Button
            type="button"
            disabled={Boolean(seats && !seats.canAdd && !open)}
            title={
              seats && !seats.canAdd
                ? seats.message
                : undefined
            }
            onClick={() => {
              if (seats && !seats.canAdd && !open) {
                setError(seats.message)
                return
              }
              setOpen((v) => !v)
              if (meta) applyRoleDefaults('CASHIER')
            }}
          >
            <UserPlus className="h-4 w-4" />
            {open ? 'Close' : 'Add staff'}
          </Button>
        }
      />

      {error ? <FormBanner tone="error">{error}</FormBanner> : null}
      {ok ? <FormBanner tone="ok">{ok}</FormBanner> : null}

      {seats ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            seats.canAdd
              ? 'border-line bg-card text-ink-soft'
              : 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100'
          }`}
        >
          <p className="font-medium text-ink">
            Staff seats · {seats.used}/{seats.max}
            {seats.planLabel ? ` · ${seats.planLabel}` : ''}
          </p>
          <p className="mt-0.5 text-xs">{seats.message}</p>
        </div>
      ) : null}

      {open ? (
        <form onSubmit={onCreate} className="nx-card space-y-4 p-4 sm:p-5">
          <div>
            <h3 className="nx-section-title text-base">New staff account</h3>
            <p className="mt-0.5 text-xs text-ink-soft">
              Login details first, then role and permissions.
              {seats
                ? ` ${seats.used}/${seats.max} seats used on your plan.`
                : ''}
            </p>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Input
              label="Full name"
              required
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="e.g. Grace Mwale"
            />
            <Input
              label="Login email"
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="staff@shop.com"
            />
            <Input
              label="Temporary password"
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min 8 characters"
              hint="They can change this after first sign-in."
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <label className="block space-y-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-ink">Role</span>
              <select
                value={form.role}
                onChange={(e) => applyRoleDefaults(e.target.value)}
                className="nx-field"
              >
                {(
                  meta?.roles ||
                  Object.keys(ROLE_LABELS).filter((r) => r !== 'OWNER')
                ).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role] || role}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Permissions
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {ALL_PERMISSIONS.map((perm) => (
                <label
                  key={perm}
                  className="flex min-h-11 items-center gap-2.5 rounded-xl border border-line bg-surface/60 px-3 py-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--brand)]"
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

          <div className="flex flex-wrap gap-2 border-t border-line/70 pt-3">
            <Button type="submit" disabled={busy} className="min-h-11">
              <Plus className="h-4 w-4" />
              {busy ? 'Creating…' : 'Create account'}
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

      <div className="nx-card overflow-hidden">
        {loading ? (
          <LoadingBlock label="Loading team…" />
        ) : members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No team members yet"
            body="Add cashiers and managers with the exact permissions each person needs."
            action={
              <Button
                type="button"
                onClick={() => {
                  setOpen(true)
                  if (meta) applyRoleDefaults('CASHIER')
                }}
              >
                <UserPlus className="h-4 w-4" />
                Add staff
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li
                key={m.membershipId}
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink">
                    {m.user.fullName}
                    {!m.active ? (
                      <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:text-amber-200">
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 p-4 backdrop-blur-[2px] sm:items-center">
          <form
            onSubmit={saveEdit}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-line bg-card p-5 shadow-2xl sm:p-6"
          >
            <h3 className="font-display text-xl font-bold text-ink">
              Edit {editing.user.fullName}
            </h3>
            <div className="mt-4 space-y-3">
              <input
                value={editing.user.fullName}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    user: { ...editing.user, fullName: e.target.value },
                  })
                }
                className="nx-field"
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
                className="nx-field"
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
                  className="nx-field"
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
                  className="nx-field"
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
