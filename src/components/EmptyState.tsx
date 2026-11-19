import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-royal">
        <Icon className="h-6 w-6" />
      </div>
      <p className="mt-4 font-display text-lg font-semibold text-ink">{title}</p>
      {body ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-soft">
          {body}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-royal/25 border-t-royal" />
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
    warn: 'bg-amber-50 text-amber-800 ring-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20',
    ok: 'bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20',
    royal: 'bg-royal/10 text-royal ring-royal/20',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ring-1 ${tones[tone]}`}
    >
      <span className="font-semibold text-ink dark:text-inherit">{value}</span>
      <span>{label}</span>
    </span>
  )
}
