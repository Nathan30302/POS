/** Durable offline sale queue (IndexedDB). Survives refresh. */

const DB_NAME = 'nexora-offline-v1'
const STORE = 'sale_queue'
const DB_VERSION = 2

export type QueuedSaleLine = {
  productId: string
  quantity: number
  productName: string
  unitPrice: number
}

export type QueuedSaleStatus =
  | 'pending'
  | 'syncing'
  | 'synced'
  | 'failed'
  | 'conflict'

export type QueuedSale = {
  clientSaleId: string
  /** When the sale happened on device (not sync time). */
  createdAt: string
  discount: number
  discountReason?: string
  paymentMethod: string
  notes?: string
  customerId?: string
  loyaltyPtsRedeemed?: number
  prescriptionNote?: string
  lines: QueuedSaleLine[]
  status: QueuedSaleStatus
  lastError?: string
  serverSaleId?: string
  attempts: number
  /** Branch where sale was taken (null = unset / HO). */
  branchId?: string | null
  /** Device fingerprint for multi-device debugging. */
  deviceId?: string
  /** When last sync attempt finished. */
  syncedAt?: string
  /** Manager chose to retry accepting stock shortfall. */
  allowStockConflict?: boolean
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'clientSaleId' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'))
  })
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('IndexedDB tx failed'))
    tx.onabort = () => reject(tx.error || new Error('IndexedDB tx aborted'))
  })
}

export function getOrCreateDeviceId(): string {
  const key = 'nexora-device-id'
  try {
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now()}`
    localStorage.setItem(key, id)
    return id
  } catch {
    return `dev-${Date.now()}`
  }
}

export async function enqueueSale(
  sale: Omit<QueuedSale, 'status' | 'attempts' | 'createdAt' | 'deviceId'> & {
    createdAt?: string
    deviceId?: string
  },
): Promise<QueuedSale> {
  const row: QueuedSale = {
    ...sale,
    createdAt: sale.createdAt || new Date().toISOString(),
    deviceId: sale.deviceId || getOrCreateDeviceId(),
    status: 'pending',
    attempts: 0,
  }
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put(row)
  await txDone(tx)
  db.close()
  return row
}

export async function listQueuedSales(): Promise<QueuedSale[]> {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readonly')
  const req = tx.objectStore(STORE).getAll()
  const rows = await new Promise<QueuedSale[]>((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as QueuedSale[]) || [])
    req.onerror = () => reject(req.error)
  })
  await txDone(tx)
  db.close()
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function updateQueuedSale(
  clientSaleId: string,
  patch: Partial<QueuedSale>,
) {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  const existing = await new Promise<QueuedSale | undefined>((resolve, reject) => {
    const req = store.get(clientSaleId)
    req.onsuccess = () => resolve(req.result as QueuedSale | undefined)
    req.onerror = () => reject(req.error)
  })
  if (!existing) {
    db.close()
    return null
  }
  const next = { ...existing, ...patch }
  store.put(next)
  await txDone(tx)
  db.close()
  return next
}

export async function removeQueuedSale(clientSaleId: string) {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).delete(clientSaleId)
  await txDone(tx)
  db.close()
}

export async function clearSyncedOrDrop(clientSaleId: string) {
  await removeQueuedSale(clientSaleId)
}

/** Export queue JSON for support / recovery (never includes secrets). */
export async function exportQueueJson(): Promise<string> {
  const rows = await listQueuedSales()
  const safe = rows.map((r) => ({
    clientSaleId: r.clientSaleId,
    createdAt: r.createdAt,
    syncedAt: r.syncedAt,
    status: r.status,
    attempts: r.attempts,
    lastError: r.lastError,
    branchId: r.branchId,
    deviceId: r.deviceId,
    discount: r.discount,
    paymentMethod: r.paymentMethod,
    lineCount: r.lines.length,
    lines: r.lines.map((l) => ({
      productId: l.productId,
      productName: l.productName,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    })),
  }))
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), count: safe.length, sales: safe },
    null,
    2,
  )
}

export function isProbablyOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export function isStockConflictError(message: string) {
  return /stock conflict/i.test(message)
}
