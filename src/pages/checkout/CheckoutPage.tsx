import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Eraser,
  Minus,
  Plus,
  ScanLine,
  Search,
  Smartphone,
  Trash2,
} from 'lucide-react'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { PhonePairModal } from '@/components/PhonePairModal'
import { SaleReceiptPanel } from '@/components/SaleReceiptPanel'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useProducts } from '@/hooks/useProducts'
import { api } from '@/lib/api'
import { findProductByCode } from '@/lib/findProduct'
import { formatZMW } from '@/lib/money'
import {
  playErrorBuzz,
  playScanBeep,
  playSuccessChime,
  unlockAudio,
} from '@/lib/sounds'
import type {
  CartLine,
  PaymentMethod,
  SaleWithItems,
} from '@/types/database'
import { PAYMENT_METHODS } from '@/types/database'

type ScanStatus = {
  message: string
  tone: 'ok' | 'error' | 'idle'
}

export function CheckoutPage() {
  const { push } = useToast()
  const { products, loading, refresh } = useProducts()
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState(0)
  const [cashReceived, setCashReceived] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [scanOpen, setScanOpen] = useState(false)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [scanStatus, setScanStatus] = useState<ScanStatus>({
    message: 'Ready to scan…',
    tone: 'idle',
  })
  const [flash, setFlash] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState<SaleWithItems | null>(null)
  const [completedChange, setCompletedChange] = useState<number | null>(null)
  const barcodeTimerRef = useRef<number | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode ?? '').includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [products, query])

  const subtotal = cart.reduce(
    (sum, line) => sum + line.product.selling_price * line.quantity,
    0,
  )
  const safeDiscount = Math.min(Math.max(0, discount), subtotal)
  const total = subtotal - safeDiscount
  const cashValue = Number(cashReceived)
  const change =
    paymentMethod === 'cash' && Number.isFinite(cashValue) && cashReceived !== ''
      ? cashValue - total
      : null

  const completeSaleRef = useRef<() => Promise<void>>(async () => undefined)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
      if (e.key === 'F4') {
        e.preventDefault()
        void completeSaleRef.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const addProduct = useCallback(
    (productId: string, source: 'scan' | 'manual' = 'manual') => {
      setError('')
      const product = products.find((p) => p.id === productId)
      if (!product) {
        setError('Product not found')
        push('Product not found', 'error')
        if (source === 'scan') {
          playErrorBuzz()
          setScanStatus({ message: 'Product not found', tone: 'error' })
        }
        return false
      }
      if (product.stock_quantity <= 0) {
        const msg = `${product.name} is out of stock`
        setError(msg)
        push(msg, 'error')
        if (source === 'scan') {
          playErrorBuzz()
          setScanStatus({ message: msg, tone: 'error' })
        }
        return false
      }

      const existing = cart.find((line) => line.product.id === productId)
      if (existing && existing.quantity >= product.stock_quantity) {
        const msg = `Only ${product.stock_quantity} in stock for ${product.name}`
        setError(msg)
        push(msg, 'error')
        if (source === 'scan') {
          playErrorBuzz()
          setScanStatus({ message: msg, tone: 'error' })
        }
        return false
      }

      setCart((prev) => {
        const current = prev.find((line) => line.product.id === productId)
        if (current) {
          return prev.map((line) =>
            line.product.id === productId
              ? { ...line, quantity: line.quantity + 1 }
              : line,
          )
        }
        return [...prev, { product, quantity: 1 }]
      })

      playScanBeep()
      const label = `${product.name} · ${formatZMW(product.selling_price)}`
      setFlash(`Added ${label}`)
      window.setTimeout(() => setFlash(''), 1800)
      if (source === 'scan') {
        setScanStatus({ message: `✓ ${label}`, tone: 'ok' })
      }
      setQuery('')
      return true
    },
    [cart, products, push],
  )

  const handleLookup = useCallback(
    (raw: string, source: 'scan' | 'manual' = 'manual') => {
      const code = raw.trim()
      if (!code) return

      if (source === 'scan') {
        setScanStatus({ message: `Read ${code}…`, tone: 'idle' })
      }

      const product = findProductByCode(code, products)
      if (product) {
        addProduct(product.id, source)
        return
      }

      const msg = `Not in catalogue: ${code}`
      setError(msg)
      push(msg, 'error')
      playErrorBuzz()
      if (source === 'scan') {
        setScanStatus({
          message: `${msg} — add it under Products first`,
          tone: 'error',
        })
      }
    },
    [addProduct, products, push],
  )

  function setQty(productId: string, quantity: number) {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.product.id !== productId) return line
          const max = line.product.stock_quantity
          return { ...line, quantity: Math.min(Math.max(1, quantity), max) }
        })
        .filter((line) => line.quantity > 0),
    )
  }

  async function completeSale() {
    if (!cart.length) {
      setError('Add at least one item')
      push('Add at least one item', 'error')
      return
    }
    if (
      paymentMethod === 'cash' &&
      cashReceived !== '' &&
      Number.isFinite(cashValue) &&
      cashValue < total
    ) {
      const msg = 'Cash received is less than the total'
      setError(msg)
      push(msg, 'error')
      return
    }
    setBusy(true)
    setError('')
    try {
      const paymentMap = {
        cash: 'CASH',
        card: 'CARD',
        eft: 'MTN_MOMO',
        other: 'OTHER',
      } as const
      const data = await api<{
        sale: {
          id: string
          total: number
          discount: number
          payment_method?: string
          paymentMethod: string
          created_at?: string
          createdAt: string
          notes: string | null
          items: Array<{
            id: string
            sale_id?: string
            saleId: string
            product_id?: string
            productId: string
            product_name?: string
            productName: string
            quantity: number
            unit_price?: number
            unitPrice: number
            line_total?: number
            lineTotal: number
          }>
        }
      }>('/sales', {
        method: 'POST',
        body: JSON.stringify({
          lines: cart.map((line) => ({
            productId: line.product.id,
            quantity: line.quantity,
          })),
          discount: safeDiscount,
          paymentMethod: paymentMap[paymentMethod],
        }),
      })
      const sale = data.sale
      const mapped = {
        id: sale.id,
        total: sale.total,
        discount: sale.discount,
        payment_method: paymentMethod,
        notes: sale.notes,
        created_at: sale.createdAt || sale.created_at || new Date().toISOString(),
        items: sale.items.map((item) => ({
          id: item.id,
          sale_id: item.saleId || item.sale_id || sale.id,
          product_id: item.productId || item.product_id || '',
          product_name: item.productName || item.product_name || '',
          quantity: item.quantity,
          unit_price: item.unitPrice ?? item.unit_price ?? 0,
          line_total: item.lineTotal ?? item.line_total ?? 0,
        })),
      }
      playSuccessChime()
      push(`Sale complete · ${formatZMW(mapped.total)}`, 'ok')
      setCompletedChange(
        paymentMethod === 'cash' && change !== null && change >= 0
          ? change
          : null,
      )
      setCompleted(mapped)
      setCart([])
      setDiscount(0)
      setCashReceived('')
      setPaymentMethod('cash')
      await refresh()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sale failed'
      setError(msg)
      push(msg, 'error')
    } finally {
      setBusy(false)
    }
  }

  completeSaleRef.current = completeSale

  function clearCart() {
    if (!cart.length) return
    if (!window.confirm('Clear the whole cart?')) return
    setCart([])
    setDiscount(0)
    setCashReceived('')
    setError('')
    push('Cart cleared', 'info')
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="space-y-4">
        <div className="relative overflow-hidden rounded-[24px] border border-line bg-[#0b1224] p-5 text-white sm:p-6">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-6 top-0 h-32 w-32 rounded-full bg-royal/40 blur-3xl interior-orb" />
            <div className="absolute bottom-0 left-8 h-28 w-28 rounded-full bg-teal/30 blur-3xl interior-orb-delay" />
          </div>
          <div className="relative z-10">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Sell · live counter
            </p>
            <h2 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Counter
            </h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Fastest: <strong className="text-white">Connect phone</strong> (phone
              camera → this counter). Or USB gun into the box. Shortcuts:{' '}
              <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs">F2</kbd> focus ·{' '}
              <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs">F4</kbd> complete sale
            </p>
          </div>
        </div>

        {flash ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {flash}
          </div>
        ) : null}

        <div className="nx-card border-royal/25 bg-gradient-to-br from-royal/10 via-card to-teal/10 p-4 sm:p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-royal">
            Barcode reader
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  const next = e.target.value
                  setQuery(next)
                  if (barcodeTimerRef.current) {
                    window.clearTimeout(barcodeTimerRef.current)
                  }
                  if (/^\d{8,14}$/.test(next.trim())) {
                    barcodeTimerRef.current = window.setTimeout(() => {
                      handleLookup(next, 'manual')
                      setQuery('')
                    }, 60)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleLookup(query, 'manual')
                    setQuery('')
                  }
                }}
                placeholder="Scan or type barcode here…"
                className="w-full rounded-2xl border border-line bg-card py-4 pl-12 pr-4 text-lg text-ink outline-none transition focus:border-royal focus:ring-4 focus:ring-royal/20"
                autoFocus
              />
            </div>
            <Button
              type="button"
              className="rounded-2xl px-5 py-4"
              onClick={() => {
                unlockAudio()
                setPhoneOpen(true)
              }}
            >
              <Smartphone className="h-5 w-5" />
              Phone
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rounded-2xl px-5 py-4"
              onClick={() => {
                unlockAudio()
                setScanStatus({
                  message: 'Hold barcode close to the camera…',
                  tone: 'idle',
                })
                setScanOpen(true)
              }}
            >
              <ScanLine className="h-5 w-5" />
              Webcam
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-soft">
            Demo: 6001001001002 blue pen · 6001001002001 notebook · 6001001001001 black pen
          </p>
        </div>

        {query.trim() && suggestions.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
            {suggestions.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product.id)}
                className="flex w-full items-center justify-between gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-brand-soft/50"
              >
                <div>
                  <p className="font-medium text-ink">{product.name}</p>
                  <p className="text-xs text-ink-soft">
                    Stock {product.stock_quantity} ·{' '}
                    {product.barcode || product.sku}
                  </p>
                </div>
                <p className="font-semibold text-brand">
                  {formatZMW(product.selling_price)}
                </p>
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="nx-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-ink">Quick picks</h3>
            {loading ? (
              <span className="text-xs text-ink-soft">Loading…</span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {products.slice(0, 9).map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product.id)}
                className="rounded-xl border border-line px-3 py-3 text-left transition hover:border-brand hover:bg-brand-soft/40 active:scale-[0.99]"
              >
                <p className="line-clamp-2 text-sm font-medium text-ink">
                  {product.name}
                </p>
                <p className="mt-1 text-sm font-semibold text-brand">
                  {formatZMW(product.selling_price)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="nx-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-ink">Cart</h3>
            {cart.length > 0 ? (
              <button
                type="button"
                onClick={clearCart}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-ink-soft hover:bg-brand-soft hover:text-ink"
              >
                <Eraser className="h-3.5 w-3.5" />
                Clear
              </button>
            ) : null}
          </div>

          {cart.length === 0 ? (
            <p className="mt-6 text-sm text-ink-soft">
              Cart is empty. Scan or search to add items.
            </p>
          ) : (
            <ul className="mt-4 max-h-[40vh] space-y-3 overflow-y-auto pr-1">
              {cart.map((line) => (
                <li
                  key={line.product.id}
                  className="rounded-xl border border-line px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-ink">{line.product.name}</p>
                      <p className="text-xs text-ink-soft">
                        {formatZMW(line.product.selling_price)} each
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-ink-soft hover:bg-red-50 hover:text-danger"
                      onClick={() =>
                        setCart((prev) =>
                          prev.filter((l) => l.product.id !== line.product.id),
                        )
                      }
                      aria-label="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="inline-flex items-center gap-2 rounded-xl bg-surface p-1">
                      <button
                        type="button"
                        className="rounded-lg p-2 hover:bg-card"
                        onClick={() =>
                          setQty(line.product.id, line.quantity - 1)
                        }
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-8 text-center font-semibold">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        className="rounded-lg p-2 hover:bg-card"
                        onClick={() =>
                          setQty(line.product.id, line.quantity + 1)
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="font-semibold">
                      {formatZMW(line.product.selling_price * line.quantity)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
            <div className="flex justify-between text-ink-soft">
              <span>Subtotal</span>
              <span>{formatZMW(subtotal)}</span>
            </div>
            <label className="flex items-center justify-between gap-3">
              <span className="text-ink-soft">Discount</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-28 rounded-xl border border-line px-3 py-2 text-right outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
              />
            </label>
            <div className="flex justify-between text-lg font-bold text-ink">
              <span>Total</span>
              <span>{formatZMW(total)}</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-ink">Payment</p>
            <div className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value)}
                  className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    paymentMethod === method.value
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-line text-ink-soft hover:bg-brand-soft/50'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === 'cash' ? (
            <div className="mt-4 space-y-2 rounded-xl bg-surface p-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-soft">Cash received</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="0.00"
                  className="w-28 rounded-xl border border-line bg-card px-3 py-2 text-right outline-none focus:border-brand focus:ring-4 focus:ring-brand/15"
                />
              </label>
              {change !== null ? (
                <p
                  className={`text-sm font-semibold ${
                    change < 0 ? 'text-danger' : 'text-ok'
                  }`}
                >
                  Change: {formatZMW(change)}
                </p>
              ) : (
                <p className="text-xs text-ink-soft">
                  Optional — enter cash to calculate change.
                </p>
              )}
            </div>
          ) : null}

          <Button
            type="button"
            className="mt-5 w-full rounded-2xl py-3.5 text-base"
            disabled={busy || cart.length === 0}
            onClick={() => void completeSale()}
          >
            {busy ? 'Saving sale…' : `Complete sale · ${formatZMW(total)}`}
          </Button>
        </div>
      </section>

      {phoneOpen ? (
        <Modal title="Connect phone scanner" onClose={() => setPhoneOpen(false)} wide>
          <PhonePairModal
            onCode={(code) => handleLookup(code, 'scan')}
            onClose={() => setPhoneOpen(false)}
          />
        </Modal>
      ) : null}

      {scanOpen ? (
        <Modal title="Scan products" onClose={() => setScanOpen(false)} wide>
          <BarcodeScanner
            continuous
            statusMessage={scanStatus.message}
            statusTone={scanStatus.tone}
            onScan={(code) => handleLookup(code, 'scan')}
            onClose={() => setScanOpen(false)}
          />
        </Modal>
      ) : null}

      {completed ? (
        <Modal
          title="Receipt"
          onClose={() => {
            setCompleted(null)
            setCompletedChange(null)
          }}
        >
          <SaleReceiptPanel
            sale={completed}
            changeDue={completedChange ?? undefined}
            onDone={() => {
              setCompleted(null)
              setCompletedChange(null)
            }}
          />
        </Modal>
      ) : null}
    </div>
  )
}
