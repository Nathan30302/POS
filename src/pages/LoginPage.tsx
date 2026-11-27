import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AuthShell, authFieldClass } from '@/components/AuthShell'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { businessHomePath } from '@/lib/permissions'

/** Demo shop is always seeded — show tap-to-fill logins unless explicitly hidden. */
const showDemos = import.meta.env.VITE_HIDE_DEMO_LOGINS !== '1'

/** Shop roles only — platform ops use `/platform/login`. */
const demos = [
  {
    label: 'Cashier',
    email: 'cashier@demo.shop',
    password: 'DemoCash1!',
    hint: 'Till / Sell',
  },
  {
    label: 'Owner',
    email: 'owner@demo.shop',
    password: 'DemoOwner1!',
    hint: 'Command + settings',
  },
  {
    label: 'Admin',
    email: 'admin@demo.shop',
    password: 'DemoAdmin1!',
    hint: 'Shop admin',
  },
]

export function LoginPage() {
  const { user, loading, login, logout } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState(showDemos ? demos[0].email : '')
  const [password, setPassword] = useState(showDemos ? demos[0].password : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && user) {
    if (user.kind === 'platform') {
      return <Navigate to="/platform" replace />
    }
    return (
      <Navigate
        to={businessHomePath(user.permissions, user.role)}
        replace
      />
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const next = await login(email.trim(), password)
      if (next.kind === 'platform') {
        logout()
        navigate('/platform/login', { replace: true })
        return
      }
      navigate(businessHomePath(next.permissions, next.role))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      asideTitle="Your shop is already running."
      asideBody="Sign in to Sell, stock, Pulse, and team tools. Industry modules load from your business type — pharmacy, grocery, or retail."
    >
      <form
        onSubmit={onSubmit}
        className="rounded-[1.25rem] border border-white/10 bg-[#0c1528]/88 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-8"
      >
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Sign in
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
          Demo is ready — tap a role below (password fills in), then Sign in.
        </p>

        {showDemos ? (
          <div className="mt-5 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-300/90">
              Demo accounts — tap to fill
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {demos.map((demo) => (
                <button
                  key={demo.label}
                  type="button"
                  onClick={() => {
                    setEmail(demo.email)
                    setPassword(demo.password)
                    setError('')
                  }}
                  className={`rounded-[0.875rem] border px-3 py-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7DD3C0] ${
                    email === demo.email
                      ? 'border-[#3563E9] bg-[#3563E9]/25 text-white'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span className="block text-sm font-semibold">{demo.label}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    {demo.hint}
                  </span>
                  <span className="mt-1 block font-mono text-[10px] leading-snug text-slate-500 break-all">
                    {demo.email}
                    <br />
                    {demo.password}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-slate-300">Email</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={authFieldClass}
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-slate-300">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={authFieldClass}
            />
          </label>
        </div>

        {error ? (
          <div
            role="alert"
            className={`mt-4 rounded-xl border px-3 py-2.5 text-sm ${
              /waiting for NEXORA approval|PENDING_APPROVAL|once an admin/i.test(
                error,
              )
                ? 'border-amber-400/30 bg-amber-500/10 text-amber-100'
                : 'border-red-400/20 bg-red-500/10 text-red-200'
            }`}
          >
            <p>{error}</p>
            {/waiting for NEXORA approval|once an admin/i.test(error) ? (
              <p className="mt-2 text-xs text-amber-200/80">
                After a NEXORA admin Approves your shop, sign in here again —
                your password stays the same.
              </p>
            ) : null}
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-[0.875rem] bg-[#13B8A6] py-3 text-[#042f2e] shadow-none hover:brightness-110"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>

        <p className="mt-5 text-center text-sm text-slate-500">
          New shop?{' '}
          <Link
            to="/signup"
            className="font-semibold text-[#13B8A6] underline-offset-2 hover:underline"
          >
            Create shop
          </Link>
          {' · '}
          <Link
            to="/guide"
            className="font-semibold text-[#13B8A6] underline-offset-2 hover:underline"
          >
            How to use (screens + voice)
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
