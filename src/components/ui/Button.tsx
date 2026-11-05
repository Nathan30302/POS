import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const styles: Record<Variant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-deep shadow-sm disabled:bg-brand/50',
  secondary:
    'bg-white text-ink border border-line hover:bg-slate-50 disabled:opacity-50',
  danger:
    'bg-danger text-white hover:bg-red-700 disabled:bg-danger/50',
  ghost: 'bg-transparent text-ink-soft hover:bg-slate-100 disabled:opacity-50',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
