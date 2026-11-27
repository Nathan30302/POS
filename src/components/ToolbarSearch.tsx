import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from 'react'
import { ListFilter, Search } from 'lucide-react'

/** Consistent search field used across Ledger, Inventory, CRM. */
export function ToolbarSearch({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`relative flex min-h-11 items-center ${className}`}>
      <span
        className="pointer-events-none absolute inset-y-0 left-0 z-[1] flex w-11 items-center justify-center text-ink-soft"
        aria-hidden
      >
        <Search className="h-4 w-4" strokeWidth={2} />
      </span>
      <input {...props} className="nx-field nx-field-icon pr-3" />
    </label>
  )
}

/** Matching select with filter icon. */
export function ToolbarSelect({
  className = '',
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <label className={`relative flex min-h-11 items-center ${className}`}>
      <span
        className="pointer-events-none absolute inset-y-0 left-0 z-[1] flex w-11 items-center justify-center text-ink-soft"
        aria-hidden
      >
        <ListFilter className="h-4 w-4" strokeWidth={2} />
      </span>
      <select {...props} className="nx-field nx-field-icon">
        {children}
      </select>
    </label>
  )
}

/** Card wrapper for filter toolbars. */
export function ToolbarCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`nx-card space-y-3 p-3 sm:p-4 ${className}`}>{children}</div>
  )
}

/** Compact metric tile for stock / CRM strips. */
export function MetricTile({
  label,
  value,
  hint,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
}) {
  return (
    <div className="nx-panel px-3.5 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-bold tabular-nums tracking-tight text-ink">
        {value}
      </p>
      {hint ? <div className="mt-1 text-xs text-ink-soft">{hint}</div> : null}
    </div>
  )
}
