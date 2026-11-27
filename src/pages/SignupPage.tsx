import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AuthShell, authFieldClass } from '@/components/AuthShell'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { INDUSTRY_OPTIONS } from '@/lib/industry'
import { businessHomePath } from '@/lib/permissions'

export function SignupPage() {
  const { user, loading } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [doneMsg, setDoneMsg] = useState('')
  const [form, setForm] = useState({
    businessName: '',
    industry: 'retail',
    phone: '',
    address: '',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
  })

  if (!loading && user) {
    return (
      <Navigate
        to={
          user.kind === 'platform'
            ? '/platform'
            : businessHomePath(user.permissions, user.role)
        }
        replace
      />
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setDoneMsg('')
    try {
      const data = await api<{
        pendingApproval?: boolean
        businessName?: string
        message?: string
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          businessName: form.businessName.trim(),
          industry: form.industry,
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
          ownerName: form.ownerName.trim(),
          ownerEmail: form.ownerEmail.trim(),
          ownerPassword: form.ownerPassword,
          currency: 'ZMW',
        }),
      })
      setDoneMsg(
        data.message ||
          'Shop submitted. Wait for a NEXORA admin to approve you, then sign in.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      asideTitle="Open a shop the OS can grow with."
      asideBody="Pick your trade — retail, pharmacy, grocery, or stationery. After approval you get Sell, stock, Pulse, and integrity tools shaped for that counter."
    >
      <form
        onSubmit={onSubmit}
        className="rounded-[1.25rem] border border-white/10 bg-[#0c1528]/88 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-8"
      >
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Create your shop
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
          Submit for approval. Receipts will show{' '}
          <strong className="font-semibold text-slate-200">your</strong> shop
          name — not a generic till brand.
        </p>

        {doneMsg ? (
          <div className="mt-6 space-y-4 rounded-xl border border-[#13B8A6]/35 bg-[#13B8A6]/10 p-4 text-sm text-teal-50">
            <p>{doneMsg}</p>
            <ol className="list-decimal space-y-1 pl-4 text-xs text-teal-100/90">
              <li>Wait for a NEXORA admin to Approve your shop.</li>
              <li>Sign in with the same email and password.</li>
              <li>Follow the on-screen setup guide (branch → products → Sell).</li>
            </ol>
            <Link
              to="/login"
              className="inline-flex font-semibold text-[#13B8A6] underline-offset-2 hover:underline"
            >
              Go to sign in →
            </Link>
          </div>
        ) : null}

        <div className={`mt-6 space-y-4 ${doneMsg ? 'hidden' : ''}`}>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-slate-300">
              Shop name (on receipts)
            </span>
            <input
              required
              value={form.businessName}
              onChange={(e) =>
                setForm((f) => ({ ...f, businessName: e.target.value }))
              }
              placeholder="e.g. Blessing Pharmacy"
              className={authFieldClass}
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-slate-300">What kind of shop?</span>
            <select
              className={authFieldClass}
              value={form.industry}
              onChange={(e) =>
                setForm((f) => ({ ...f, industry: e.target.value }))
              }
            >
              {INDUSTRY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id} className="bg-[#0f172a]">
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-slate-300">Phone (optional)</span>
              <input
                value={form.phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
                className={authFieldClass}
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium text-slate-300">Your name</span>
              <input
                required
                value={form.ownerName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, ownerName: e.target.value }))
                }
                className={authFieldClass}
              />
            </label>
          </div>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-slate-300">Address (optional)</span>
            <input
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
              className={authFieldClass}
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-slate-300">Login email</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={form.ownerEmail}
              onChange={(e) =>
                setForm((f) => ({ ...f, ownerEmail: e.target.value }))
              }
              className={authFieldClass}
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-slate-300">
              Password (8+ characters)
            </span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={form.ownerPassword}
              onChange={(e) =>
                setForm((f) => ({ ...f, ownerPassword: e.target.value }))
              }
              className={authFieldClass}
            />
          </label>
        </div>

        {error && !doneMsg ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-200"
          >
            {error}
          </p>
        ) : null}

        {!doneMsg ? (
          <Button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-xl bg-[#13B8A6] py-3 text-[#042f2e] shadow-none hover:brightness-110"
          >
            {busy ? 'Submitting…' : 'Submit shop for approval'}
          </Button>
        ) : null}

        <p className="mt-5 text-center text-sm text-slate-500">
          Already have a shop?{' '}
          <Link
            to="/login"
            className="font-semibold text-[#13B8A6] underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
