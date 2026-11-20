import { useEffect, useState } from 'react'
import { ScrollText } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { api } from '@/lib/api'

type AuditRow = {
  id: string
  action: string
  entity: string | null
  entityId: string | null
  createdAt: string
  user: { id: string; fullName: string; email: string } | null
  meta: Record<string, unknown>
}

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHero
        eyebrow="Accountability"
        title="Audit log"
        subtitle="Who changed sales, stock, team, and shop settings — with before/after where recorded."
      />

      <div className="flex flex-wrap gap-2">
        {['', 'sale.', 'product.', 'team.', 'business.'].map((value) => (
          <button
            key={value || 'all'}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
              filter === value
                ? 'border-royal bg-royal/15 text-royal'
                : 'border-line text-ink-soft hover:border-royal/40'
            }`}
          >
            {value ? value.replace(/\.$/, '') : 'All'}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="nx-card space-y-3 p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-brand-soft/60" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit events yet"
          body="Sales, voids, inventory edits, and team changes will appear here for managers."
        />
      ) : (
        <div className="nx-card overflow-hidden">
          <ul className="divide-y divide-line">
            {logs.map((log) => (
              <li key={log.id} className="px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{log.action}</p>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {log.user?.fullName || 'Unknown user'}
                      {log.entity ? ` · ${log.entity}` : ''}
                      {log.entityId ? ` · ${log.entityId.slice(0, 8)}…` : ''}
                    </p>
                  </div>
                  <time className="text-xs text-ink-soft">
                    {new Date(log.createdAt).toLocaleString()}
                  </time>
                </div>
                {log.meta && Object.keys(log.meta).length > 0 ? (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-surface px-3 py-2 text-[11px] text-ink-soft">
                    {JSON.stringify(log.meta, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
