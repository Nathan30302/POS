import type { ReactNode } from 'react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'

type Tone = 'ok' | 'error' | 'info'

const styles: Record<Tone, string> = {
  ok: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200',
  error: 'border-danger/25 bg-danger/10 text-danger',
  info: 'border-line bg-surface text-ink-soft',
}

const icons = {
  ok: CheckCircle2,
  error: XCircle,
  info: Info,
}

/** Inline success / error / info strip for settings & forms. */
export function FormBanner({
  tone,
  children,
  className = '',
}: {
  tone: Tone
  children: ReactNode
  className?: string
}) {
  const Icon = icons[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-snug ${styles[tone]} ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 opacity-90" strokeWidth={2.25} />
      <div className="min-w-0 flex-1 font-medium">{children}</div>
    </div>
  )
}
