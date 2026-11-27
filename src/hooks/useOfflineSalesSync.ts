import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import {
  isStockConflictError,
  listQueuedSales,
  removeQueuedSale,
  updateQueuedSale,
  type QueuedSale,
} from '@/lib/offlineQueue'

/** Process-wide mutex so accidental double mounts cannot sync in parallel. */
let globalSyncLock = false

export function useOfflineSalesSync(enabled = true) {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [queue, setQueue] = useState<QueuedSale[]>([])
  const [syncing, setSyncing] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [lastSyncError, setLastSyncError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setQueue(await listQueuedSales())
    } catch {
      setQueue([])
    }
  }, [])

  const pushOne = useCallback(async (row: QueuedSale, allowConflict: boolean) => {
    await updateQueuedSale(row.clientSaleId, {
      status: 'syncing',
      attempts: row.attempts + 1,
      allowStockConflict: allowConflict || row.allowStockConflict,
    })
    try {
      const data = await api<{ sale: { id: string }; deduped?: boolean }>(
        '/sales',
        {
          method: 'POST',
          branchId: row.branchId ?? undefined,
          body: JSON.stringify({
            clientSaleId: row.clientSaleId,
            discount: row.discount,
            discountReason: row.discountReason || undefined,
            paymentMethod: row.paymentMethod,
            notes: row.notes,
            customerId: row.customerId,
            loyaltyPtsRedeemed: row.loyaltyPtsRedeemed,
            prescriptionNote: row.prescriptionNote,
            lines: row.lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
            })),
            allowStockConflict: allowConflict || row.allowStockConflict || false,
            occurredAt: row.createdAt,
            deviceId: row.deviceId,
          }),
        },
      )
      await updateQueuedSale(row.clientSaleId, {
        status: 'synced',
        serverSaleId: data.sale.id,
        lastError: undefined,
        syncedAt: new Date().toISOString(),
      })
      await removeQueuedSale(row.clientSaleId)
      return { ok: true as const }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed'
      if (isStockConflictError(msg)) {
        await updateQueuedSale(row.clientSaleId, {
          status: 'conflict',
          lastError: msg,
          syncedAt: new Date().toISOString(),
        })
        return { ok: false as const, conflict: true, error: msg }
      }
      // Cap retries — leave failed for manual recovery
      const nextAttempts = row.attempts + 1
      await updateQueuedSale(row.clientSaleId, {
        status: 'failed',
        lastError: msg,
        attempts: nextAttempts,
        syncedAt: new Date().toISOString(),
      })
      return { ok: false as const, conflict: false, error: msg }
    }
  }, [])

  const syncingRef = useRef(false)

  const syncAll = useCallback(async () => {
    if (!online || syncingRef.current || globalSyncLock) return
    globalSyncLock = true
    syncingRef.current = true
    setSyncing(true)
    setLastSyncError('')
    try {
      const rows = await listQueuedSales()
      const pending = rows.filter(
        (r) =>
          r.status === 'pending' ||
          r.status === 'failed' ||
          (r.status === 'conflict' && r.allowStockConflict),
      )
      let lastErr = ''
      for (const row of pending) {
        // Brief backoff after repeated failures
        if (row.attempts > 0 && row.status === 'failed') {
          await new Promise((r) =>
            setTimeout(r, Math.min(2000, 250 * row.attempts)),
          )
        }
        const result = await pushOne(
          row,
          Boolean(row.allowStockConflict),
        )
        if (!result.ok) lastErr = result.error
      }
      if (lastErr) setLastSyncError(lastErr)
      setLastSyncAt(new Date().toISOString())
      await refresh()
    } finally {
      syncingRef.current = false
      globalSyncLock = false
      setSyncing(false)
    }
  }, [online, pushOne, refresh])

  const retryWithConflictAccept = useCallback(
    async (clientSaleId: string) => {
      const rows = await listQueuedSales()
      const row = rows.find((r) => r.clientSaleId === clientSaleId)
      if (!row) return
      await updateQueuedSale(clientSaleId, {
        allowStockConflict: true,
        status: 'pending',
      })
      setSyncing(true)
      try {
        await pushOne({ ...row, allowStockConflict: true }, true)
        await refresh()
      } finally {
        setSyncing(false)
      }
    },
    [pushOne, refresh],
  )

  const dropSale = useCallback(
    async (clientSaleId: string) => {
      await removeQueuedSale(clientSaleId)
      await refresh()
    },
    [refresh],
  )

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [enabled, refresh])

  useEffect(() => {
    if (!enabled || !online) return
    void syncAll()
  }, [enabled, online, syncAll])

  const pendingCount = queue.filter(
    (q) =>
      q.status === 'pending' ||
      q.status === 'failed' ||
      q.status === 'syncing' ||
      q.status === 'conflict',
  ).length

  const conflictCount = queue.filter((q) => q.status === 'conflict').length

  return {
    online,
    queue,
    pendingCount,
    conflictCount,
    syncing,
    lastSyncAt,
    lastSyncError,
    refresh,
    syncAll,
    retryWithConflictAccept,
    dropSale,
  }
}
