import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, LineChart, Shield, Smartphone, Sparkles } from 'lucide-react'
import { RealBusinessVideo } from '@/components/RealBusinessVideo'
import { useAuth } from '@/context/AuthContext'
import { businessHomePath } from '@/lib/permissions'

export function LandingPage() {
  const { user, loading } = useAuth()

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

  return (
    <div className="landing relative min-h-screen overflow-hidden bg-[#070d1c] text-white">
      <RealBusinessVideo clip="shop-floor" dim={0.55} />

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

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-center px-6 pb-28 pt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#13B8A6]">
          Shop operating system
        </p>
        <h1 className="font-display mt-5 max-w-4xl text-5xl font-semibold leading-[0.95] tracking-tight sm:text-7xl">
          NEXORA
        </h1>
        <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-300 sm:text-xl">
          Sell, stock, people, and decisions in one command center — built to
          outperform ordinary till software.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-full bg-[#3563E9] px-7 py-3.5 text-sm font-semibold shadow-lg shadow-blue-900/40 transition hover:bg-[#2f58d4]"
          >
            Enter workspace <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#why"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-7 py-3.5 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
          >
            Why NEXORA
          </a>
        </div>
      </main>

      <section
        id="why"
        className="relative z-10 border-t border-white/10 bg-black/40 py-20 backdrop-blur-sm"
      >
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#13B8A6]">
            Beyond the till
          </p>
          <h2 className="font-display mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything a growing shop needs — without the POS ceiling.
          </h2>
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-8 px-6 md:grid-cols-3">
          {[
            {
              icon: Smartphone,
              title: 'Counter that moves',
              body: 'Phone as barcode gun over Wi‑Fi, MoMo agents, cash change, WhatsApp PDF receipts — staff stay fast.',
            },
            {
              icon: LineChart,
              title: 'Pulse decisions',
              body: 'Ask NEXORA about profit, slow stock, and risk. Answers come from your real sales, not guesswork.',
            },
            {
              icon: Shield,
              title: 'Team you control',
              body: 'Owners create logins and lock permissions. Cashiers see Sell. Managers see what you allow.',
            },
          ].map((item) => (
            <div key={item.title} className="border-t border-white/10 pt-6">
              <item.icon className="h-5 w-5 text-[#13B8A6]" />
              <h3 className="mt-4 font-display text-xl">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                {item.body}
              </p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-14 flex max-w-6xl items-center gap-2 px-6 text-sm text-slate-500">
          <Sparkles className="h-4 w-4 text-[#3563E9]" />
          NEXORA is a business growth OS — not another cash register app.
        </p>
      </section>
    </div>
  )
}
