import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  Check,
  Flame,
  Lightbulb,
  Snowflake,
  Target,
  TrendingUp,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export type InsightTone = 'growth' | 'risk' | 'focus' | 'win'

export type InsightCardProps = {
  id: string
  title: string
  summary: string
  impact?: string | null
  action?: string | null
  severity?: string
  kind?: string
  tone?: InsightTone
  href?: string
  ctaLabel?: string
  onDismiss?: (id: string) => void
  onDone?: (id: string) => void
  busy?: boolean
  /** Drop outer card chrome when nested in a panel. */
  embedded?: boolean
}

const toneStyles: Record<InsightTone, string> = {
  growth: 'border-emerald-500/25 bg-emerald-500/5',
  win: 'border-teal/30 bg-teal/5',
  risk: 'border-amber-500/30 bg-amber-500/5',
  focus: 'border-royal/25 bg-royal/5',
}

const toneIcons: Record<InsightTone, LucideIcon> = {
  growth: TrendingUp,
  win: Flame,
  risk: AlertTriangle,
  focus: Lightbulb,
}

function metaFromKind(
  kind: string | undefined,
  severity: string | undefined,
): { icon: LucideIcon; tone: InsightTone } {
  if (!kind && severity) {
    if (severity === 'critical' || severity === 'warning') {
      return { icon: AlertTriangle, tone: 'risk' }
    }
    return { icon: Lightbulb, tone: 'focus' }
  }
  const k = kind || ''
  if (k.includes('money_leak') || k.includes('hot_stockout')) {
    return { icon: AlertTriangle, tone: 'risk' }
  }
  if (k.includes('low_stock') || severity === 'critical') {
    return { icon: AlertTriangle, tone: 'risk' }
  }
  if (k.includes('slow') || k.includes('discount') || k.includes('cooling') || k.includes('thin_margin')) {
    return { icon: Snowflake, tone: 'risk' }
  }
  if (k.includes('performance') || k.includes('margin') || k.includes('rising')) {
    return { icon: TrendingUp, tone: 'growth' }
  }
  if (severity === 'warning') return { icon: AlertTriangle, tone: 'risk' }
  return { icon: Lightbulb, tone: 'focus' }
}

/** Map insight kinds / action copy to in-app routes. */
export function insightDeepLink(
  kind?: string,
  action?: string | null,
): { href: string; label: string } {
  const text = `${kind || ''} ${action || ''}`.toLowerCase()
  if (
    text.includes('ledger') ||
    text.includes('audit discount') ||
    text.includes('discount ticket')
  ) {
    return { href: '/app/sales', label: 'Open Ledger' }
  }
  if (
    text.includes('stock') ||
    text.includes('reorder') ||
    text.includes('inventory') ||
    text.includes('product') ||
    text.includes('reprice') ||
    text.includes('restock') ||
    text.includes('receive')
  ) {
    return { href: '/app/products', label: 'Open Inventory' }
  }
  if (
    text.includes('checkout') ||
    text.includes('sell') ||
    text.includes('counter') ||
    text.includes('bundle') ||
    text.includes('upsell') ||
    text.includes('ticket') ||
    text.includes('promo')
  ) {
    return { href: '/app/checkout', label: 'Open Sell' }
  }
  if (
    text.includes('pulse') ||
    text.includes('insight') ||
    text.includes('ask') ||
    text.includes('money leak') ||
    text.includes('leak')
  ) {
    return { href: '/app/insights', label: 'Open Pulse' }
  }
  if (text.includes('slow') || text.includes('cool') || text.includes('falling')) {
    return { href: '/app/products', label: 'Review Inventory' }
  }
  if (text.includes('margin') || text.includes('discount')) {
    return { href: '/app/sales', label: 'Open Ledger' }
  }
  return { href: '/app/insights', label: 'Open Pulse' }
}

export function InsightCard({
  id,
  title,
  summary,
  impact,
  action,
  severity,
  kind,
  tone,
  href,
  ctaLabel,
  onDismiss,
  onDone,
  busy,
  embedded = false,
}: InsightCardProps) {
  const derived = metaFromKind(kind, severity)
  const resolvedTone = tone || derived.tone
  const Icon = tone ? toneIcons[tone] : derived.icon
  const link = href
    ? { href, label: ctaLabel || 'Take action' }
    : insightDeepLink(kind, action || ctaLabel)

  return (
    <article
      className={`${
        embedded
          ? 'rounded-xl border p-3.5 sm:p-4'
          : 'nx-card border p-5'
      } ${toneStyles[resolvedTone]}`}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card/90 text-royal shadow-sm">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-ink">{title}</h3>
            {severity ? (
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                  severity === 'critical'
                    ? 'bg-red-500/15 text-danger'
                    : severity === 'warning'
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                      : 'bg-brand-soft text-royal'
                }`}
              >
                {severity}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{summary}</p>
          {impact ? (
            <p className="mt-2 text-sm text-ink">
              <strong>Impact:</strong> {impact}
            </p>
          ) : null}
          {action ? (
            <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-royal">
              <Target className="h-3.5 w-3.5" />
              {action}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              to={link.href}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-royal px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-deep"
            >
              {link.label}
            </Link>
            {onDone ? (
              <Button
                type="button"
                variant="secondary"
                className="min-h-9 px-3 py-1.5 text-xs"
                disabled={busy}
                onClick={() => onDone(id)}
              >
                <Check className="h-3.5 w-3.5" />
                Done
              </Button>
            ) : null}
            {onDismiss ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-9 px-3 py-1.5 text-xs"
                disabled={busy}
                onClick={() => onDismiss(id)}
              >
                <X className="h-3.5 w-3.5" />
                Dismiss
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
