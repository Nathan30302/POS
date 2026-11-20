/** Durable offline sale queue (IndexedDB). Survives refresh. */

const DB_NAME = 'nexora-offline-v1'
const STORE = 'sale_queue'

export type QueuedSaleLine = { productId: string; quantity: number; productName: string; unitPrice: number }

export type QueuedSale = {
  clientSaleId: string
  createdAt: string
  discount: number
  paymentMethod: string
  notes?: string
  customerId?: string
  lines: QueuedSaleLine[]
  status: 'pending' | 'syncing' | 'synced' | 'failed'
  lastError?: string
  serverSaleId?: string
  attempts: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
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

export async function enqueueSale(
  sale: Omit<QueuedSale, 'status' | 'attempts' | 'createdAt'> & {
    createdAt?: string
  },
): Promise<QueuedSale> {
  const row: QueuedSale = {
    ...sale,
    createdAt: sale.createdAt || new Date().toISOString(),
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

export function isProbablyOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}
