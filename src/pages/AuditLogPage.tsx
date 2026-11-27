import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ScrollText, ShieldCheck } from 'lucide-react'
import { EmptyState, LoadingBlock } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { api } from '@/lib/api'
import {
  auditActionLabel,
  auditDetailLine,
  auditFilterLabel,
} from '@/lib/auditFormat'

type AuditRow = {
  id: string
  action: string
  entity: string | null
  entityId: string | null
  createdAt: string
  entryHash?: string | null
  prevHash?: string | null
  user: { id: string; fullName: string; email: string } | null
  meta: Record<string, unknown>
}

type VerifyResult = {
  ok: boolean
  total: number
  chained: number
  legacy: number
  breaks: Array<{ id: string; action: string; reason: string }>
  checkedAt: string
}

export function AuditLogPage() {
  const [searchParams] = useSearchParams()
  const initialFilter = searchParams.get('action') || ''
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState(initialFilter)
  const [verify, setVerify] = useState<VerifyResult | null>(null)
  const [verifyBusy, setVerifyBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const q = filter.trim()
      ? `?action=${encodeURIComponent(filter.trim())}`
      : ''
    void api<{ logs: AuditRow[] }>(`/audit${q}`)
      .then((data) => {
        if (!cancelled) setLogs(data.logs)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load audit log')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [filter])

  async function runVerify() {
    setVerifyBusy(true)
    setError('')
    try {
      const data = await api<VerifyResult>('/audit/verify')
      setVerify(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verify failed')
    } finally {
      setVerifyBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 sm:space-y-5">
      <PageHero
        eyebrow="Accountability"
        title="Who did what"
        actions={
          <Button
            type="button"
            variant="secondary"
            disabled={verifyBusy}
            onClick={() => void runVerify()}
          >
            <ShieldCheck className="h-4 w-4" />
            {verifyBusy ? 'Checking…' : 'Verify chain'}
          </Button>
        }
      />

      {verify ? (
        <FormBanner tone={verify.ok ? 'ok' : 'error'}>
          {verify.ok
            ? `Chain intact · ${verify.chained} hashed rows${
                verify.legacy ? ` · ${verify.legacy} legacy (pre-chain)` : ''
              }`
            : `Chain break · ${verify.breaks.length} issue${
                verify.breaks.length === 1 ? '' : 's'
              } (of ${verify.chained} hashed)`}
        </FormBanner>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[
          '',
          'sale.void',
          'sale.',
          'shift.',
          'product.stock_shrink',
          'product.',
          'team.',
          'business.',
        ].map((value) => (
          <button
            key={value || 'all'}
            type="button"
            onClick={() => setFilter(value)}
            className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              filter === value
                ? 'border-royal bg-royal/15 text-royal'
                : 'border-line bg-card text-ink-soft hover:border-royal/40'
            }`}
          >
            {value === 'shift.' ? 'Shifts' : auditFilterLabel(value)}
          </button>
        ))}
      </div>

      {error ? <FormBanner tone="error">{error}</FormBanner> : null}

      {loading ? (
        <div className="nx-card">
          <LoadingBlock />
        </div>
      ) : logs.length === 0 ? (
        <div className="nx-card">
          <EmptyState icon={ScrollText} title="No events yet" />
        </div>
      ) : (
        <div className="nx-card overflow-hidden">
          <ul className="divide-y divide-line">
            {logs.map((log) => {
              const label = auditActionLabel(log.action)
              const detail = auditDetailLine(log.action, log.meta || {}, log.entity)
              const actor = log.user?.fullName || 'Unknown user'
              return (
                <li
                  key={log.id}
                  className="px-4 py-3 sm:px-5 [content-visibility:auto]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{label}</p>
                      <p className="mt-0.5 text-sm text-ink-soft">
                        {actor}
                        {detail ? ` · ${detail}` : ''}
                      </p>
                      {log.entryHash ? (
                        <p className="mt-0.5 font-mono text-[10px] text-ink-soft/80">
                          {log.entryHash.slice(0, 12)}…
                        </p>
                      ) : null}
                    </div>
                    <time className="shrink-0 text-xs text-ink-soft">
                      {new Date(log.createdAt).toLocaleString()}
                    </time>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
