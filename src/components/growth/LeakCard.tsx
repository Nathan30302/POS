import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  Droplets,
  Flame,
  PackageMinus,
  Percent,
  RotateCcw,
  Snowflake,
  Tag,
} from 'lucide-react'
import { Link } from 'react-router-dom'

export type MoneyLeakKind =
  | 'discount_risk'
  | 'slow_mover'
  | 'hot_stockout'
  | 'cooling'
  | 'thin_margin'
  | 'void_spike'
  | 'stock_shrink'

export type MoneyLeakCta =
  | 'inventory'
  | 'sell'
  | 'ledger'
  | 'pulse'
  | 'audit'
  | 'conflicts'

export type MoneyLeakItem = {
  id: string
  kind: MoneyLeakKind
  severity: 'critical' | 'warning' | 'info'
  title: string
  why: string
  amount: number | null
  amountLabel: string
  cta: MoneyLeakCta
  ctaLabel: string
  productName?: string
}

const kindMeta: Record<
  MoneyLeakKind,
  { icon: LucideIcon; accent: string }
> = {
  discount_risk: {
    icon: Percent,
    accent: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  slow_mover: {
    icon: Snowflake,
    accent: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  },
  hot_stockout: {
    icon: Flame,
    accent: 'bg-red-500/15 text-danger',
  },
  cooling: {
    icon: Droplets,
    accent: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  },
  thin_margin: {
    icon: Tag,
    accent: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  },
  void_spike: {
    icon: RotateCcw,
    accent: 'bg-red-500/15 text-danger',
  },
  stock_shrink: {
    icon: PackageMinus,
    accent: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  },
}

export function leakCtaHref(cta: MoneyLeakCta): string {
  switch (cta) {
    case 'inventory':
      return '/app/products'
    case 'sell':
      return '/app/checkout'
    case 'ledger':
      return '/app/sales'
    case 'audit':
      return '/app/audit'
    case 'conflicts':
      return '/app/conflicts'
    case 'pulse':
    default:
      return '/app/insights'
  }
}

type Props = {
  leak: MoneyLeakItem
  compact?: boolean
}

export function LeakCard({ leak, compact = false }: Props) {
  const meta = kindMeta[leak.kind] || kindMeta.discount_risk
  const Icon = meta.icon
  const href = leakCtaHref(leak.cta)

  return (
    <article
      className={`flex gap-3 rounded-xl border border-line/80 bg-card/60 ${
        compact ? 'p-3' : 'p-3.5 sm:p-4'
      } ${
        leak.severity === 'critical'
          ? 'border-red-500/25'
          : leak.severity === 'warning'
            ? 'border-amber-500/25'
            : ''
      }`}
    >
      <span
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${meta.accent}`}
        title={leak.kind.replaceAll('_', ' ')}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-ink">{leak.title}</p>
            <p className="mt-1 text-sm leading-snug text-ink-soft">{leak.why}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-display text-sm font-bold tabular-nums text-ink">
              {leak.amountLabel}
            </p>
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                leak.severity === 'critical'
                  ? 'bg-red-500/15 text-danger'
                  : leak.severity === 'warning'
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'bg-brand-soft text-royal'
              }`}
            >
              {leak.severity}
            </span>
          </div>
        </div>
        <Link
          to={href}
          className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-royal hover:underline"
        >
          {leak.ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  )
}
