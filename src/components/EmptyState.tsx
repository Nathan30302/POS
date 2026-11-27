import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  compact,
}: {
  icon: LucideIcon
  title: string
  body?: string
  action?: ReactNode
  /** Tighter padding for nested panels (cart, filters) */
  compact?: boolean
}) {
  return (
    <div
      className={`flex flex-col items-center text-center ${
        compact ? 'px-4 py-8' : 'px-6 py-11 sm:py-12'
      }`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] border border-line bg-brand-soft text-royal sm:h-14 sm:w-14">
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.75} aria-hidden />
      </div>
      <p className="font-display mt-3.5 text-base font-semibold tracking-tight text-ink sm:mt-4 sm:text-lg">
        {title}
      </p>
      {body ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-4 sm:mt-5">{action}</div> : null}
    </div>
  )
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center gap-3 px-6 py-14 text-center sm:py-16"
      aria-busy
      role="status"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-royal/25 border-t-royal"
        aria-hidden
      />
      <p className="text-sm text-ink-soft">{label}</p>
    </div>
  )
}

export function StatChip({
  label,
  value,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  tone?: 'neutral' | 'warn' | 'ok' | 'royal'
}) {
  const tones = {
    neutral: 'bg-card text-ink-soft ring-line',
    warn: 'bg-amber-500/10 text-amber-800 ring-amber-500/25 dark:text-amber-300',
    ok: 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/25 dark:text-emerald-300',
    royal: 'bg-royal/10 text-royal ring-royal/20',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm ring-1 ${tones[tone]}`}
    >
      <span className="font-semibold tabular-nums text-ink dark:text-inherit">
        {value}
      </span>
      <span>{label}</span>
    </span>
  )
}
