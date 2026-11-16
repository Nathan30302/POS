import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, LineChart, Shield, Sparkles, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { RealBusinessVideo } from '@/components/RealBusinessVideo'
import { useAuth } from '@/context/AuthContext'

const liveStats = [
  { label: 'Shops live', value: 128 },
  { label: 'Sales today', value: 4821 },
  { label: 'Insights fired', value: 963 },
]

export function LandingPage() {
  const { user, loading } = useAuth()
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 2200)
    return () => window.clearInterval(id)
  }, [])

  if (!loading && user) {
    return (
      <Navigate
        to={user.kind === 'platform' ? '/platform' : '/app/dashboard'}
        replace
      />
    )
  }

  return (
    <div className="landing relative min-h-screen overflow-hidden bg-[#070d1c] text-white">
      <RealBusinessVideo clip="shop-floor" dim={0.52} />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#3563E9] to-[#13B8A6] text-sm font-bold shadow-lg shadow-blue-900/40">
            NX
          </div>
          <span className="font-display text-xl tracking-tight">NEXORA</span>
        </div>
        <Link
          to="/login"
          className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/10"
        >
          Sign in
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-center px-6 pb-24 pt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#13B8A6]">
          Intelligent business OS
        </p>
        <h1 className="font-display mt-5 max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight sm:text-7xl">
          NEXORA
        </h1>
        <p className="mt-5 max-w-xl text-lg text-slate-300 sm:text-xl">
          Run smarter. Grow faster. One command center for selling, stock,
          money, people, and decisions — built to outperform ordinary shop software.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[#3563E9] px-6 py-3 text-sm font-semibold shadow-lg shadow-blue-900/40 transition hover:bg-[#2f58d4]"
          >
            Enter workspace <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#why"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
          >
            Why NEXORA
          </a>
        </div>

        <div className="mt-14 grid gap-3 sm:grid-cols-3">
          {liveStats.map((stat, i) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur"
            >
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {stat.label}
              </p>
              <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
                {(stat.value + ((tick + i) % 7) * (i + 3)).toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-[#13B8A6]">Live pulse · demo feed</p>
            </div>
          ))}
        </div>
      </main>

      <section id="why" className="relative z-10 border-t border-white/10 bg-black/30 py-16 backdrop-blur-sm">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 md:grid-cols-3">
          {[
            {
              icon: Zap,
              title: 'Sell at the counter',
              body: 'Fast counter checkout, phone scanning, receipts — without feeling like basic shop software.',
            },
            {
              icon: LineChart,
              title: 'Decide with Pulse',
              body: 'Ask NEXORA about profit, slow stock, and risk. Get answers from your real numbers.',
            },
            {
              icon: Shield,
              title: 'Team access you control',
              body: 'Owners create staff logins, set roles, and lock permissions — cashiers only see what they need.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <item.icon className="h-5 w-5 text-[#13B8A6]" />
              <h2 className="mt-4 font-display text-xl">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-10 flex max-w-6xl items-center gap-2 px-6 text-sm text-slate-500">
          <Sparkles className="h-4 w-4 text-[#3563E9]" />
          More than ringing up sales — a business operating system.
        </p>
      </section>
    </div>
  )
}
