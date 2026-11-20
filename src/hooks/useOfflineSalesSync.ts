import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api'
import {
  listQueuedSales,
  removeQueuedSale,
  updateQueuedSale,
  type QueuedSale,
} from '@/lib/offlineQueue'

export function useOfflineSalesSync(enabled = true) {
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [queue, setQueue] = useState<QueuedSale[]>([])
  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setQueue(await listQueuedSales())
    } catch {
      setQueue([])
    }
  }, [])

  const syncAll = useCallback(async () => {
    if (!online || syncing) return
    setSyncing(true)
    try {
      const rows = await listQueuedSales()
      const pending = rows.filter((r) => r.status === 'pending' || r.status === 'failed')
      for (const row of pending) {
        await updateQueuedSale(row.clientSaleId, {
          status: 'syncing',
          attempts: row.attempts + 1,
        })
        try {
          const data = await api<{ sale: { id: string }; deduped?: boolean }>(
            '/sales',
            {
              method: 'POST',
              body: JSON.stringify({
                clientSaleId: row.clientSaleId,
                discount: row.discount,
                paymentMethod: row.paymentMethod,
                notes: row.notes,
                customerId: row.customerId,
                lines: row.lines.map((l) => ({
                  productId: l.productId,
                  quantity: l.quantity,
                })),
                allowStockConflict: false,
              }),
            },
          )
          await updateQueuedSale(row.clientSaleId, {
            status: 'synced',
            serverSaleId: data.sale.id,
            lastError: undefined,
          })
          // Keep synced rows briefly then drop
          await removeQueuedSale(row.clientSaleId)
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Sync failed'
          // Stock conflicts stay failed for manager review
          await updateQueuedSale(row.clientSaleId, {
            status: 'failed',
            lastError: msg,
          })
        }
      }
      await refresh()
    } finally {
      setSyncing(false)
    }
  }, [online, refresh, syncing])

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
    (q) => q.status === 'pending' || q.status === 'failed' || q.status === 'syncing',
  ).length

  return { online, queue, pendingCount, syncing, refresh, syncAll }
}
