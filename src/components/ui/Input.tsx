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
      <input id={inputId} className={`nx-field ${className}`} {...props} />
      {hint ? (
        <span className="block text-xs leading-relaxed text-ink-soft">{hint}</span>
      ) : null}
    </label>
  )
}
