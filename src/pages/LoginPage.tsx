import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Moon, Sun } from 'lucide-react'
import { PhoneShopLink } from '@/components/PhoneShopLink'
import { RealBusinessVideo } from '@/components/RealBusinessVideo'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { businessHomePath } from '@/lib/permissions'
import { applyAllPreferences, getTheme, toggleTheme } from '@/lib/theme'

const demos = [
  { label: 'Owner', email: 'owner@demo.shop', password: 'DemoOwner1!' },
  { label: 'Admin', email: 'admin@demo.shop', password: 'DemoAdmin1!' },
  { label: 'Cashier', email: 'cashier@demo.shop', password: 'DemoCash1!' },
  { label: 'Platform', email: 'admin@nexora.app', password: 'NexoraAdmin1!' },
]

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
    try {
      const next = await login(email.trim(), password)
      navigate(
        next.kind === 'platform'
          ? '/platform'
          : businessHomePath(next.permissions, next.role),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  const onPhone =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)

  return (
    <div className="relative flex min-h-dvh overflow-x-hidden bg-[#070d1c] text-white">
      <RealBusinessVideo clip="checkout" dim={0.58} />

      <button
        type="button"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-20 rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 backdrop-blur"
        onClick={() => setTheme(toggleTheme())}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:grid-cols-2 lg:gap-10">
        <div className={onPhone ? 'hidden' : ''}>
          <Link
            to="/"
            className="text-xs font-semibold uppercase tracking-[0.28em] text-[#13B8A6]"
          >
            NEXORA
          </Link>
          <h1 className="font-display mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
            Sign in to your
            <br />
            shop OS
          </h1>
          <p className="mt-4 max-w-md text-slate-400">
            Owners run the team. Staff get the access you grant. Selling, stock,
            money, and Pulse — one workspace.
          </p>
          <div className="mt-8">
            <PhoneShopLink path="/login" />
          </div>
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Demo accounts
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {demos.map((demo) => (
                <button
                  key={demo.label}
                  type="button"
                  onClick={() => {
                    setEmail(demo.email)
                    setPassword(demo.password)
                    setError('')
                  }}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                    email === demo.email
                      ? 'border-[#3563E9] bg-[#3563E9]/20 text-white'
                      : 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {demo.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-white/10 bg-[#0f172a]/85 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8"
        >
          {onPhone ? (
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#13B8A6]">
                NEXORA · phone
              </p>
              <h2 className="font-display mt-2 text-3xl font-semibold">
                Sign in
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Then open Sell — tap products or Snap barcodes.
              </p>
            </div>
          ) : null}
          {!onPhone ? (
            <>
              <h2 className="font-display text-2xl font-semibold">Welcome back</h2>
              <p className="mt-1 text-sm text-slate-400">
                Business workspace or NEXORA platform console.
              </p>
            </>
          ) : (
            <div className="mb-2 flex flex-wrap gap-2">
              {demos.slice(0, 3).map((demo) => (
                <button
                  key={demo.label}
                  type="button"
                  onClick={() => {
                    setEmail(demo.email)
                    setPassword(demo.password)
                    setError('')
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    email === demo.email
                      ? 'border-[#3563E9] bg-[#3563E9]/20 text-white'
                      : 'border-white/15 bg-white/5 text-slate-300'
                  }`}
                >
                  {demo.label}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 space-y-4 sm:mt-6">
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
