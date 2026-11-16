import type { ReactNode } from 'react'

export function PageHero({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-line bg-[#0b1224] p-5 text-white sm:p-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-6 top-0 h-32 w-32 rounded-full bg-royal/40 blur-3xl interior-orb" />
        <div className="absolute bottom-0 left-8 h-28 w-28 rounded-full bg-teal/30 blur-3xl interior-orb-delay" />
      </div>
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {eyebrow}
          </p>
          <h2 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </section>
  )
}
