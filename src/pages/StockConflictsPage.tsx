import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
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
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHero
        eyebrow="Inventory integrity"
        title="Stock conflicts"
        subtitle="Offline or concurrent sales that requested more stock than was available. Resolve without silently overwriting inventory."
      />

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="nx-card space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-brand-soft/50" />
          ))}
        </div>
      ) : open.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No open conflicts"
          body="When offline sync hits a stock shortfall, it will appear here for managers."
        />
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
