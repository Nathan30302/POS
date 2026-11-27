import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AuthShell, authFieldClass } from '@/components/AuthShell'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'

const showDemos = import.meta.env.VITE_HIDE_DEMO_LOGINS !== '1'

const platformDemo = {
  email: 'admin@nexora.app',
  password: 'NexoraAdmin1!',
}

export function PlatformLoginPage() {
  const { user, loading, login, logout } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState(showDemos ? platformDemo.email : '')
  const [password, setPassword] = useState(
    showDemos ? platformDemo.password : '',
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!loading && user) {
    if (user.kind === 'platform') {
      return <Navigate to="/platform" replace />
    }
    return <Navigate to="/app" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const next = await login(email.trim(), password)
      if (next.kind !== 'platform') {
        logout()
        setError(
          'This portal is for NEXORA operators only. Shop staff should use the shop sign-in page.',
        )
        return
      }
      navigate('/platform', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell
      asideTitle="Operator console."
      asideBody="Approve shops, manage plans and entitlements, and keep every business environment healthy — separate from shop owner and cashier sign-in."
    >
      <form
        onSubmit={onSubmit}
        className="rounded-[1.25rem] border border-white/10 bg-[#0c1528]/88 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-md sm:p-8"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7DD3C0]">
          NEXORA Platform
        </p>
        <h1 className="font-display mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Operator sign-in
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
          Staff who control businesses across the network. Shop owners and
          cashiers use a different page.
        </p>

        {showDemos ? (
          <button
            type="button"
            onClick={() => {
              setEmail(platformDemo.email)
              setPassword(platformDemo.password)
              setError('')
            }}
            className="mt-5 w-full rounded-[0.875rem] border border-[#3563E9]/40 bg-[#3563E9]/15 px-3 py-2.5 text-left transition hover:bg-[#3563E9]/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7DD3C0]"
          >
            <span className="block text-sm font-semibold text-white">
              Demo operator
            </span>
            <span className="mt-1 block font-mono text-[10px] leading-snug text-slate-400 break-all">
              {platformDemo.email}
              <br />
              {platformDemo.password}
            </span>
          </button>
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
          <p
            role="alert"
            className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2.5 text-sm text-red-200"
          >
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          disabled={busy}
          className="mt-6 w-full rounded-[0.875rem] bg-[#13B8A6] py-3 text-[#042f2e] shadow-none hover:brightness-110"
        >
          {busy ? 'Signing in…' : 'Enter console'}
        </Button>

        <p className="mt-5 text-center text-sm text-slate-500">
          Shop staff?{' '}
          <Link
            to="/login"
            className="font-semibold text-[#13B8A6] underline-offset-2 hover:underline"
          >
            Shop sign-in
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
