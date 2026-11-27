import { CloudOff, Download, RefreshCw, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { exportQueueJson, type QueuedSale } from '@/lib/offlineQueue'
import { formatZMW } from '@/lib/money'

type Props = {
  online: boolean
  queue: QueuedSale[]
  syncing: boolean
  pendingCount: number
  conflictCount: number
  lastSyncAt: string | null
  lastSyncError: string
  onSync: () => void
  onRetryConflict: (clientSaleId: string) => void
  onDrop: (clientSaleId: string) => void
}

function lineTotal(sale: QueuedSale) {
  const sub = sale.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  return Math.max(0, sub - (sale.discount || 0))
}

export function OfflineQueuePanel({
  online,
  queue,
  syncing,
  pendingCount,
  conflictCount,
  lastSyncAt,
  lastSyncError,
  onSync,
  onRetryConflict,
  onDrop,
}: Props) {
  if (online && pendingCount === 0) return null

  async function downloadExport() {
    const json = await exportQueueJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nexora-offline-queue-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        online
          ? conflictCount > 0
            ? 'border-amber-500/35 bg-amber-500/10 text-ink'
            : 'border-amber-500/30 bg-amber-500/10 text-ink'
          : 'border-red-500/30 bg-red-500/10 text-ink'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-start gap-2">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
          <div>
            <p className="font-semibold">
              {online
                ? `${pendingCount} sale${pendingCount === 1 ? '' : 's'} waiting to sync`
                : 'Offline — sales queue on this device'}
            </p>
            {conflictCount > 0 ? (
              <p className="mt-0.5 text-xs text-ink-soft">
                {conflictCount} stock conflict
                {conflictCount === 1 ? '' : 's'} — accept shortfall or resolve in{' '}
                <Link to="/app/conflicts" className="font-semibold text-royal underline">
                  Conflicts
                </Link>
              </p>
            ) : null}
            {lastSyncAt ? (
              <p className="mt-0.5 text-[10px] text-ink-soft">
                Last sync {new Date(lastSyncAt).toLocaleTimeString()}
              </p>
            ) : null}
            {lastSyncError ? (
              <p className="mt-0.5 text-xs text-danger">{lastSyncError}</p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {online && pendingCount > 0 ? (
            <Button
              type="button"
              variant="secondary"
              className="min-h-9 rounded-xl text-xs"
              disabled={syncing}
              onClick={() => onSync()}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="min-h-9 rounded-xl text-xs"
            onClick={() => void downloadExport()}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      {queue.length > 0 ? (
        <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
          {queue.map((sale) => (
            <li
              key={sale.clientSaleId}
              className="rounded-xl border border-line/80 bg-card/80 px-3 py-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tabular-nums text-ink">
                    {formatZMW(lineTotal(sale))} ·{' '}
                    <span className="uppercase tracking-wide text-ink-soft">
                      {sale.status}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[10px] text-ink-soft">
                    {new Date(sale.createdAt).toLocaleString()} ·{' '}
                    {sale.lines.length} line{sale.lines.length === 1 ? '' : 's'} ·{' '}
                    {sale.clientSaleId.slice(0, 8)}…
                  </p>
                  {sale.lastError ? (
                    <p className="mt-0.5 text-[10px] text-danger">{sale.lastError}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sale.status === 'conflict' ? (
                    <Button
                      type="button"
                      className="min-h-8 rounded-lg px-2 text-[10px]"
                      disabled={syncing}
                      onClick={() => onRetryConflict(sale.clientSaleId)}
                    >
                      Accept shortfall
                    </Button>
                  ) : null}
                  {(sale.status === 'failed' || sale.status === 'conflict') &&
                  sale.attempts >= 2 ? (
                    <button
                      type="button"
                      className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-danger hover:bg-danger/10"
                      onClick={() => {
                        if (
                          window.confirm(
                            'Remove this queued sale from this device? It will not sync.',
                          )
                        ) {
                          onDrop(sale.clientSaleId)
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                      Drop
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
