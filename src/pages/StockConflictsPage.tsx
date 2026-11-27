import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { EmptyState, LoadingBlock } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { useOfflineSync } from '@/context/OfflineSyncContext'
import { OfflineQueuePanel } from '@/components/OfflineQueuePanel'
import { api } from '@/lib/api'

type Conflict = {
  id: string
  productName: string
  productId: string
  requestedQty: number
  availableQty: number
  clientSaleId: string | null
  status: string
  resolution: string | null
  createdAt: string
}

export function StockConflictsPage() {
  const [rows, setRows] = useState<Conflict[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const offline = useOfflineSync()

  async function load() {
    setError('')
    const data = await api<{ conflicts: Conflict[] }>('/sales/conflicts')
    setRows(data.conflicts)
  }

  useEffect(() => {
    void load()
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load conflicts'),
      )
      .finally(() => setLoading(false))
  }, [])

  async function resolve(
    id: string,
    status: 'ACCEPTED_NEGATIVE' | 'ADJUSTED' | 'DISMISSED',
  ) {
    setBusyId(id)
    try {
      await api(`/sales/conflicts/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          resolution: status.replace(/_/g, ' ').toLowerCase(),
        }),
      })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resolve failed')
    } finally {
      setBusyId('')
    }
  }

  const open = rows.filter((r) => r.status === 'OPEN')

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
      <PageHero
        eyebrow="Stock integrity"
        title="Conflicts & offline sync"
        actions={
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setLoading(true)
              void load()
                .catch((err) =>
                  setError(
                    err instanceof Error ? err.message : 'Failed to load',
                  ),
                )
                .finally(() => setLoading(false))
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <OfflineQueuePanel
        online={offline.online}
        queue={offline.queue}
        syncing={offline.syncing}
        pendingCount={offline.pendingCount}
        conflictCount={offline.conflictCount}
        lastSyncAt={offline.lastSyncAt}
        lastSyncError={offline.lastSyncError}
        onSync={() => void offline.syncAll()}
        onRetryConflict={(id) => void offline.retryWithConflictAccept(id)}
        onDrop={(id) => void offline.dropSale(id)}
      />

      {error ? <FormBanner tone="error">{error}</FormBanner> : null}

      {loading ? (
        <div className="nx-card">
          <LoadingBlock />
        </div>
      ) : open.length === 0 ? (
        <div className="nx-card">
          <EmptyState icon={AlertTriangle} title="No open conflicts" />
        </div>
      ) : (
        <ul className="nx-card divide-y divide-line overflow-hidden">
          {open.map((c) => (
            <li key={c.id} className="space-y-3 px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{c.productName}</p>
                  <p className="text-xs text-ink-soft">
                    Requested {c.requestedQty} · available {c.availableQty}
                    {c.clientSaleId
                      ? ` · offline ${c.clientSaleId.slice(0, 8)}…`
                      : ''}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-soft">
                    Shortfall {Math.max(0, c.requestedQty - c.availableQty)}
                  </p>
                </div>
                <time className="text-xs text-ink-soft">
                  {new Date(c.createdAt).toLocaleString()}
                </time>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-xl text-xs"
                  disabled={busyId === c.id}
                  onClick={() => void resolve(c.id, 'DISMISSED')}
                >
                  Dismiss
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-xl text-xs"
                  disabled={busyId === c.id}
                  onClick={() => void resolve(c.id, 'ADJUSTED')}
                >
                  Mark adjusted
                </Button>
                <Button
                  type="button"
                  className="rounded-xl text-xs"
                  disabled={busyId === c.id}
                  onClick={() => void resolve(c.id, 'ACCEPTED_NEGATIVE')}
                >
                  Accept shortfall
                </Button>
                {c.clientSaleId ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-xl text-xs"
                    disabled={offline.syncing}
                    onClick={() =>
                      void offline.retryWithConflictAccept(c.clientSaleId!)
                    }
                  >
                    Retry offline sale
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {rows.some((r) => r.status !== 'OPEN') ? (
        <details className="nx-card p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-ink">
            Resolved history ({rows.filter((r) => r.status !== 'OPEN').length})
          </summary>
          <ul className="mt-3 space-y-2 text-xs text-ink-soft">
            {rows
              .filter((r) => r.status !== 'OPEN')
              .map((c) => (
                <li key={c.id}>
                  {c.productName} · {c.status} ·{' '}
                  {new Date(c.createdAt).toLocaleDateString()}
                </li>
              ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
