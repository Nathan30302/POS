import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
}

export function Input({ label, hint, className = '', id, ...props }: Props) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-')
  return (
    <label className="block space-y-1.5" htmlFor={inputId}>
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        id={inputId}
        className={`w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/15 ${className}`}
        {...props}
      />
      {hint ? <span className="block text-xs text-ink-soft">{hint}</span> : null}
    </label>
  )
}
