import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const styles: Record<Variant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-deep focus-visible:ring-brand/30 disabled:bg-brand/50 shadow-sm shadow-brand/15',
  secondary:
    'bg-card text-ink border border-line hover:bg-brand-soft hover:border-brand/30 focus-visible:ring-brand/20 disabled:opacity-50',
  danger:
    'bg-danger text-white hover:bg-red-700 focus-visible:ring-danger/30 disabled:bg-danger/50',
  ghost:
    'bg-transparent text-ink-soft hover:bg-brand-soft hover:text-ink focus-visible:ring-brand/15 disabled:opacity-50',
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
      className={`inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 py-2.5 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-4 active:scale-[0.99] disabled:cursor-not-allowed disabled:active:scale-100 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
