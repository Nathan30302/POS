/**
 * Stagger JsBarcode work so printing 200–300 labels does not freeze the UI.
 * Callers enqueue encode jobs; the queue drains in small rAF batches.
 */

type Job = () => void

const queue: Job[] = []
let pumping = false
const CHUNK = 10

function pump() {
  if (pumping) return
  pumping = true

  const tick = () => {
    const batch = queue.splice(0, CHUNK)
    for (const job of batch) {
      try {
        job()
      } catch {
        // ignore encode errors — label component handles fallbacks
      }
    }
    if (queue.length > 0) {
      requestAnimationFrame(() => {
        // Yield to input/paint between chunks
        window.setTimeout(tick, 0)
      })
    } else {
      pumping = false
      flushWaiters()
    }
  }

  tick()
}

const waiters: Array<() => void> = []

function flushWaiters() {
  const done = waiters.splice(0, waiters.length)
  for (const w of done) w()
}

/** Enqueue a synchronous encode callback; returns a cancel handle. */
export function enqueueBarcodeEncode(job: Job): () => void {
  let cancelled = false
  const wrapped: Job = () => {
    if (!cancelled) job()
  }
  queue.push(wrapped)
  pump()
  return () => {
    cancelled = true
    const i = queue.indexOf(wrapped)
    if (i >= 0) queue.splice(i, 1)
    if (queue.length === 0 && !pumping) flushWaiters()
  }
}

/** Resolves when the encode queue is empty (all pending jobs finished). */
export function whenBarcodeQueueIdle(): Promise<void> {
  if (queue.length === 0 && !pumping) return Promise.resolve()
  return new Promise((resolve) => {
    waiters.push(resolve)
  })
}
