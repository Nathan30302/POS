import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { RealBusinessVideo } from '@/components/RealBusinessVideo'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { applyAllPreferences, getTheme, toggleTheme } from '@/lib/theme'

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('owner@demo.shop')
  const [password, setPassword] = useState('DemoOwner1!')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [theme, setTheme] = useState(getTheme())

  useEffect(() => {
    applyAllPreferences()
  }, [])

  if (!loading && user) {
    return (
      <Navigate
        to={user.kind === 'platform' ? '/platform' : '/app/dashboard'}
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
      navigate(next.kind === 'platform' ? '/platform' : '/app/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#070d1c] text-white">
      <RealBusinessVideo clip="checkout" dim={0.58} />

      <button
        type="button"
        className="absolute right-4 top-4 z-20 rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 backdrop-blur"
        onClick={() => setTheme(toggleTheme())}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-2">
        <div>
          <Link to="/" className="text-xs font-semibold uppercase tracking-[0.28em] text-[#13B8A6]">
            NEXORA
          </Link>
          <h1 className="font-display mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">
            Sign in to your
            <br />
            command center
          </h1>
          <p className="mt-4 max-w-md text-slate-400">
            Behind every busy counter — owners run the team, staff log in with
            the access you give them. Selling, stock, money, and intelligence.
          </p>
          <div className="mt-8 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300 backdrop-blur">
            <p>
              <span className="text-slate-500">Owner</span> · owner@demo.shop /
              DemoOwner1!
            </p>
            <p>
              <span className="text-slate-500">Admin</span> · admin@demo.shop /
              DemoAdmin1!
            </p>
            <p>
              <span className="text-slate-500">Cashier</span> · cashier@demo.shop /
              DemoCash1!
            </p>
            <p>
              <span className="text-slate-500">Platform</span> · admin@nexora.app /
              NexoraAdmin1!
            </p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-white/10 bg-[#0f172a]/75 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl"
        >
          <h2 className="font-display text-2xl font-semibold">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-400">
            Access your business workspace or the NEXORA platform console.
          </p>
          <div className="mt-6 space-y-4">
            <label className="block space-y-1.5 text-sm">
              <span className="text-slate-300">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-white outline-none transition focus:border-[#3563E9] focus:ring-4 focus:ring-[#3563E9]/20"
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-slate-300">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-white outline-none transition focus:border-[#3563E9] focus:ring-4 focus:ring-[#3563E9]/20"
              />
            </label>
          </div>
          {error ? (
            <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="mt-6 w-full rounded-xl bg-[#3563E9] py-3 hover:bg-[#2f58d4]"
            disabled={busy}
          >
            {busy ? 'Signing in…' : 'Enter NEXORA'}
          </Button>
        </form>
      </div>
    </div>
  )
}
