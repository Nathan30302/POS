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
    <section className="nx-page-hero relative overflow-hidden rounded-[var(--radius-xl)] border border-line bg-card p-4 sm:p-5">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 55% 80% at 100% 0%, color-mix(in srgb, var(--royal) 10%, transparent), transparent 55%), radial-gradient(ellipse 40% 60% at 0% 100%, color-mix(in srgb, var(--teal) 8%, transparent), transparent 50%)',
        }}
      />
      <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="nx-eyebrow inline-flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal"
              aria-hidden
            />
            {eyebrow}
          </p>
          <h2 className="font-display mt-1.5 text-[1.45rem] font-bold tracking-tight text-ink sm:text-[1.85rem] sm:leading-tight">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-soft sm:text-sm">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  )
}
