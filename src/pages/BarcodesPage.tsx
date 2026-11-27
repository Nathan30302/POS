import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Layers,
  PackagePlus,
  Printer,
  RefreshCw,
  Tag,
} from 'lucide-react'
import { BarcodeLabel } from '@/components/BarcodeLabel'
import { EmptyState, LoadingBlock } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { useProducts } from '@/hooks/useProducts'
import { api } from '@/lib/api'
import { whenBarcodeQueueIdle } from '@/lib/barcodeEncodeQueue'

type BatchSummary = {
  id: string
  label: string | null
  quantity: number
  status: 'READY' | 'PRINTED' | 'EXHAUSTED'
  printedAt: string | null
  exhaustedAt: string | null
  createdAt: string
  available: number
  claimed: number
}

type BatchDetail = BatchSummary & {
  codes: {
    id: string
    code: string
    status: 'AVAILABLE' | 'CLAIMED'
    productId: string | null
    claimedAt: string | null
  }[]
}

type Tab = 'blank' | 'products'

const DEFAULT_PRESETS = [10, 20, 50, 100, 200, 300]

export function BarcodesPage() {
  const { products, loading: productsLoading } = useProducts()
  const [tab, setTab] = useState<Tab>('blank')
  const [batches, setBatches] = useState<BatchSummary[]>([])
  const [presets, setPresets] = useState<number[]>(DEFAULT_PRESETS)
  const [availableTotal, setAvailableTotal] = useState(0)
  const [listLoading, setListLoading] = useState(true)
  const [count, setCount] = useState(50)
  const [customCount, setCustomCount] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [activeBatch, setActiveBatch] = useState<BatchDetail | null>(null)
  const [printMode, setPrintMode] = useState(false)
  const [printPreparing, setPrintPreparing] = useState(false)
  const printRequestedRef = useRef(false)

  const withCodes = useMemo(
    () => products.filter((p) => (p.barcode ?? '').trim().length > 0),
    [products],
  )
  const missing = products.length - withCodes.length

  const loadBatches = useCallback(async () => {
    setListLoading(true)
    setError('')
    try {
      const data = await api<{
        batches: BatchSummary[]
        availableTotal: number
        countPresets: number[]
      }>('/barcode-batches')
      setBatches(data.batches)
      setAvailableTotal(data.availableTotal)
      if (data.countPresets?.length) setPresets(data.countPresets)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load batches')
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBatches()
  }, [loadBatches])

  useEffect(() => {
    if (!printMode || !printRequestedRef.current) return
    let cancelled = false
    const onAfterPrint = () => {
      setPrintMode(false)
      setPrintPreparing(false)
      printRequestedRef.current = false
    }
    window.addEventListener('afterprint', onAfterPrint)

    // Wait for staggered JsBarcode queue to drain, then print
    void (async () => {
      setPrintPreparing(true)
      // Let React mount the print sheet + enqueue encode jobs first
      await new Promise((r) => requestAnimationFrame(() => r(undefined)))
      await new Promise((r) => requestAnimationFrame(() => r(undefined)))
      await new Promise((r) => window.setTimeout(r, 0))
      await whenBarcodeQueueIdle()
      // One more paint so SVGs are in the DOM for the print renderer
      await new Promise((r) => requestAnimationFrame(() => r(undefined)))
      if (cancelled) return
      setPrintPreparing(false)
      window.print()
    })()

    return () => {
      cancelled = true
      window.removeEventListener('afterprint', onAfterPrint)
    }
  }, [printMode, activeBatch?.id])

  const resolvedCount = useMemo(() => {
    const custom = Number(customCount)
    if (customCount.trim() && Number.isFinite(custom)) {
      return Math.min(500, Math.max(1, Math.floor(custom)))
    }
    return count
  }, [count, customCount])

  async function generateBatch() {
    setGenerating(true)
    setError('')
    try {
      const data = await api<{ batch: BatchDetail }>('/barcode-batches', {
        method: 'POST',
        body: JSON.stringify({ count: resolvedCount }),
      })
      setActiveBatch(data.batch)
      setTab('blank')
      setCustomCount('')
      await loadBatches()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generate failed')
    } finally {
      setGenerating(false)
    }
  }

  async function openBatch(id: string) {
    setError('')
    try {
      const data = await api<{ batch: BatchDetail }>(`/barcode-batches/${id}`)
      setActiveBatch(data.batch)
      setTab('blank')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open batch')
    }
  }

  async function markStatus(status: 'PRINTED' | 'EXHAUSTED' | 'READY') {
    if (!activeBatch) return
    setError('')
    try {
      const data = await api<{ batch: BatchSummary }>(
        `/barcode-batches/${activeBatch.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        },
      )
      setActiveBatch((prev) =>
        prev ? { ...prev, ...data.batch, codes: prev.codes } : prev,
      )
      await loadBatches()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  function printActiveBatch() {
    if (!activeBatch || printPreparing) return
    printRequestedRef.current = true
    setPrintMode(true)
    void markStatus('PRINTED')
  }

  const printCodes = activeBatch?.codes ?? []

  return (
    <div
      className={`mx-auto max-w-5xl space-y-4 sm:space-y-5 ${printMode ? 'barcode-print-root' : ''}`}
    >
      <div className="print:hidden">
        <PageHero
          eyebrow="Labels · shelf ready"
          title="Barcode labels"
          actions={
            tab === 'blank' && activeBatch ? (
              <Button
                type="button"
                onClick={printActiveBatch}
                disabled={printPreparing}
              >
                <Printer className="h-4 w-4" />
                {printPreparing ? 'Preparing…' : 'Print blank sheet'}
              </Button>
            ) : tab === 'products' && withCodes.length > 0 ? (
              <Button
                type="button"
                disabled={printPreparing}
                onClick={() => {
                  void (async () => {
                    setPrintPreparing(true)
                    await whenBarcodeQueueIdle()
                    await new Promise((r) =>
                      requestAnimationFrame(() => r(undefined)),
                    )
                    setPrintPreparing(false)
                    window.print()
                  })()
                }}
              >
                <Printer className="h-4 w-4" />
                {printPreparing ? 'Preparing…' : 'Print product sheet'}
              </Button>
            ) : null
          }
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab('blank')}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
              tab === 'blank'
                ? 'bg-brand text-white'
                : 'border border-line bg-card text-ink-soft hover:text-ink'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              Blank label batches
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('products')}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
              tab === 'products'
                ? 'bg-brand text-white'
                : 'border border-line bg-card text-ink-soft hover:text-ink'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <Tag className="h-4 w-4" />
              Product labels
            </span>
          </button>
        </div>

        {error ? (
          <div className="mt-3">
            <FormBanner tone="error">{error}</FormBanner>
          </div>
        ) : null}
      </div>

      {tab === 'blank' ? (
        <div className="space-y-4 print:hidden">
          <section className="nx-card space-y-4 p-4 sm:p-5">
            <div>
              <h3 className="nx-section-title">Generate label batch</h3>
              <p className="mt-1 text-sm text-ink-soft">
                Print → stick → assign in Inventory. Keeps unlabeled stock
                trackable.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {presets.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setCount(n)
                    setCustomCount('')
                  }}
                  className={`min-h-10 rounded-xl px-3 text-sm font-semibold transition ${
                    !customCount.trim() && count === n
                      ? 'bg-brand text-white'
                      : 'border border-line bg-card text-ink hover:border-brand/40'
                  }`}
                >
                  {n}
                </button>
              ))}
              <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
                Custom
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={customCount}
                  onChange={(e) => setCustomCount(e.target.value)}
                  placeholder="e.g. 75"
                  className="nx-field w-24 py-2"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={() => void generateBatch()}
                disabled={generating}
              >
                <RefreshCw
                  className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`}
                />
                {generating
                  ? 'Generating…'
                  : `Generate ${resolvedCount} unique codes`}
              </Button>
              <p className="text-xs text-ink-soft">
                {availableTotal} unused codes ready to assign · never reuses
                prior batches
              </p>
            </div>
          </section>

          <section className="nx-card space-y-3 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="nx-section-title">Batch history</h3>
              <Button
                type="button"
                variant="ghost"
                className="!min-h-9 !px-2 !py-1 text-xs"
                onClick={() => void loadBatches()}
              >
                Refresh
              </Button>
            </div>

            {listLoading ? (
              <LoadingBlock label="Loading batches…" />
            ) : batches.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No batches yet"
                body="Generate your first blank label batch above, then print and cut stickers."
              />
            ) : (
              <ul className="divide-y divide-line">
                {batches.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-ink">
                        {b.label || `Batch of ${b.quantity}`}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {new Date(b.createdAt).toLocaleString()} ·{' '}
                        {b.available} unused / {b.claimed} claimed ·{' '}
                        <StatusPill status={b.status} />
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="!min-h-9 !px-3 !py-1.5 text-xs"
                        onClick={() => void openBatch(b.id)}
                      >
                        Open / print
                      </Button>
                      {b.status !== 'EXHAUSTED' && b.available === 0 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="!min-h-9 !px-3 !py-1.5 text-xs"
                          onClick={() => {
                            setActiveBatch(null)
                            void (async () => {
                              await api(`/barcode-batches/${b.id}`, {
                                method: 'PATCH',
                                body: JSON.stringify({ status: 'EXHAUSTED' }),
                              })
                              await loadBatches()
                            })()
                          }}
                        >
                          Mark exhausted
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {batches.some((b) => b.status === 'EXHAUSTED') ? (
              <p className="text-xs text-ink-soft">
                Used-up batches stay in history. Generate a new batch for fresh
                unused codes — old codes are never reused.
              </p>
            ) : null}
          </section>

          {activeBatch ? (
            <section className="nx-card space-y-4 p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="nx-section-title">
                    {activeBatch.label || `Batch of ${activeBatch.quantity}`}
                  </h3>
                  <p className="mt-1 text-sm text-ink-soft">
                    {activeBatch.codes.length} codes · {activeBatch.available}{' '}
                    unused · <StatusPill status={activeBatch.status} />
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={printActiveBatch}
                    disabled={printPreparing}
                  >
                    <Printer className="h-4 w-4" />
                    {printPreparing ? 'Preparing…' : 'Print sheet'}
                  </Button>
                  {activeBatch.status !== 'PRINTED' ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void markStatus('PRINTED')}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark printed
                    </Button>
                  ) : null}
                  {activeBatch.status !== 'EXHAUSTED' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void markStatus('EXHAUSTED')}
                    >
                      Mark exhausted
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => void generateBatch()}
                      disabled={generating}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Generate next batch
                    </Button>
                  )}
                </div>
              </div>

              {/* Cap on-screen work; print sheet encodes the rest via stagger queue */}
              <div className="barcode-label-sheet grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeBatch.codes.slice(0, 36).map((c) => (
                  <div key={c.id} className="relative">
                    <BarcodeLabel
                      value={c.code}
                      sticker
                      height={40}
                      deferEncode
                    />
                    {c.status === 'CLAIMED' ? (
                      <span className="absolute right-1 top-1 rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        claimed
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
              {activeBatch.codes.length > 36 ? (
                <p className="text-xs text-ink-soft">
                  Showing first 36 of {activeBatch.codes.length} on screen —
                  Print sheet includes every code.
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : productsLoading ? (
        <div className="nx-card print:hidden">
          <LoadingBlock label="Preparing labels…" />
        </div>
      ) : withCodes.length === 0 ? (
        <div className="nx-card print:hidden">
          <EmptyState
            icon={Tag}
            title="No product barcodes to print"
            body="Add barcodes on Inventory products, or print blank stickers first and assign unused codes when you add stock."
            action={
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => setTab('blank')}>
                  <Layers className="h-4 w-4" />
                  Blank batches
                </Button>
                <Link to="/app/products">
                  <Button type="button" variant="secondary">
                    <PackagePlus className="h-4 w-4" />
                    Open Inventory
                  </Button>
                </Link>
              </div>
            }
          />
        </div>
      ) : (
        <>
          {missing > 0 ? (
            <p className="text-xs text-ink-soft print:hidden">
              Showing {withCodes.length} labeled products · {missing} still need
              a barcode in Inventory.
            </p>
          ) : null}
          <div className="barcode-label-sheet grid gap-4 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
            {withCodes.map((product) => (
              <BarcodeLabel
                key={product.id}
                value={product.barcode!}
                label={product.name}
                deferEncode={withCodes.length > 24}
              />
            ))}
          </div>
        </>
      )}

      {/* Print-only blank sheet — barcodes encode via stagger queue before print() */}
      {printMode && printCodes.length > 0 ? (
        <div className="hidden print:block">
          <div className="barcode-label-sheet barcode-sticker-sheet">
            {printCodes.map((c) => (
              <BarcodeLabel
                key={`print-${c.id}`}
                value={c.code}
                sticker
                height={38}
                deferEncode
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'EXHAUSTED'
      ? 'text-ink-soft'
      : status === 'PRINTED'
        ? 'text-teal'
        : 'text-brand'
  return <span className={`font-semibold uppercase tracking-wide ${tone}`}>{status}</span>
}
