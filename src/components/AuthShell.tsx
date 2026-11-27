import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { NexoraMark } from '@/components/NexoraMark'
import { RealBusinessVideo } from '@/components/RealBusinessVideo'

/** Shared live marketing chrome for login / signup. */
export function AuthShell({
  children,
  asideTitle,
  asideBody,
}: {
  children: ReactNode
  asideTitle: string
  asideBody: string
}) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#07101f] text-white">
      <div className="pointer-events-none absolute inset-0 lg:hidden">
        <RealBusinessVideo clip="checkout" dim={0.78} />
      </div>

      <div className="relative z-10 mx-auto grid min-h-dvh max-w-6xl lg:grid-cols-[1.08fr_0.92fr]">
        <aside className="relative hidden overflow-hidden lg:block">
          <RealBusinessVideo clip="shop-floor" dim={0.38} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07101f]/92 via-[#07101f]/25 to-[#07101f]/40" />
          <div className="absolute inset-0 flex flex-col justify-between p-10 xl:p-12">
            <Link
              to="/"
              className="inline-flex w-fit items-center gap-3 transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7DD3C0]"
            >
              <NexoraMark className="h-11 w-11" />
              <span className="font-display text-2xl font-extrabold tracking-[-0.04em]">
                NEXORA
              </span>
            </Link>
            <div className="max-w-md auth-aside-rise">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7DD3C0]">
                Shop operating system
              </p>
              <h2 className="font-display mt-3 text-3xl font-semibold leading-[1.12] tracking-tight xl:text-[2.35rem]">
                {asideTitle}
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-300/95">
                {asideBody}
              </p>
              <ul className="mt-8 space-y-2.5 text-sm text-slate-400">
                {[
                  'Sell that stays fast on phone and counter',
                  'Stock, lots, and transfers when you need them',
                  'Trust & audit so owners see every void',
                ].map((line) => (
                  <li key={line} className="flex gap-2.5">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#13B8A6]"
                      aria-hidden
                    />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <div className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:border-l lg:border-white/5 lg:bg-[#0a1222]/94 lg:px-12 lg:backdrop-blur-xl">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-2.5 lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7DD3C0]"
          >
            <NexoraMark className="h-9 w-9" />
            <span className="font-display text-lg font-extrabold tracking-[-0.04em]">
              NEXORA
            </span>
          </Link>
          <div className="mx-auto w-full max-w-md auth-form-rise">{children}</div>
        </div>
      </div>
    </div>
  )
}

export const authFieldClass =
  'w-full min-h-11 rounded-[0.875rem] border border-white/12 bg-white/[0.06] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 hover:border-white/20 focus:border-[#13B8A6] focus:ring-4 focus:ring-[#13B8A6]/18'
