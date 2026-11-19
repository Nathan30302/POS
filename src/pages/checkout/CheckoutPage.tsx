import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Eraser,
  Minus,
  PackageOpen,
  Plus,
  ScanLine,
  Search,
  Smartphone,
  Trash2,
} from 'lucide-react'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { EmptyState } from '@/components/EmptyState'
import { PhonePairPanel } from '@/components/PhonePairPanel'
import { SaleReceiptPanel } from '@/components/SaleReceiptPanel'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { useProducts } from '@/hooks/useProducts'
import { api } from '@/lib/api'
import { buildProductIndex, findProductByCode } from '@/lib/findProduct'
import { formatZMW } from '@/lib/money'
import type { ScanResult } from '@/lib/peerRoom'
import {
  playErrorBuzz,
  playScanBeep,
  playSuccessChime,
  unlockAudio,
} from '@/lib/sounds'
import {
  fetchShopProfile,
  type ShopReceiptProfile,
} from '@/lib/shopProfile'
import type {
  CartLine,
  PaymentMethod,
  SaleWithItems,
} from '@/types/database'
import { PAYMENT_API, PAYMENT_METHODS, PRODUCT_CATEGORIES } from '@/types/database'

type ScanStatus = {
  message: string
  tone: 'ok' | 'error' | 'idle'
}

export function CheckoutPage() {
  const { push } = useToast()
  const { can } = useAuth()
  const canDiscount = can('discounts')
  const { products, loading, refresh, applyStockDeltas } = useProducts()
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState(0)
  const [cashReceived, setCashReceived] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [scanOpen, setScanOpen] = useState(false)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [phoneStatus, setPhoneStatus] = useState<
    'waiting' | 'connected' | 'error'
  >('waiting')
  const [scanStatus, setScanStatus] = useState<ScanStatus>({
    message: 'Point at barcode',
    tone: 'idle',
  })
  const [flash, setFlash] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState<SaleWithItems | null>(null)
  const [completedChange, setCompletedChange] = useState<number | null>(null)
  const [completedCash, setCompletedCash] = useState<number | null>(null)
  const [shop, setShop] = useState<ShopReceiptProfile | null>(null)
  const [catalogueQuery, setCatalogueQuery] = useState('')
  const [catalogueCategory, setCatalogueCategory] = useState('All')
  const [lastCart, setLastCart] = useState<CartLine[]>([])
  const [showPathTip, setShowPathTip] = useState(() => {
    try {
      return localStorage.getItem('nexora-sell-path-tip') !== '1'
    } catch {
      return true
    }
  })
  const isPhone =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  const barcodeTimerRef = useRef<number | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const keepScanOpenRef = useRef(false)
  const cartRef = useRef(cart)
  cartRef.current = cart
  const productsRef = useRef(products)
  productsRef.current = products

  const productIndex = useMemo(() => buildProductIndex(products), [products])
  const productIndexRef = useRef(productIndex)
  productIndexRef.current = productIndex

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

  const cartItemCount = useMemo(
    () => cart.reduce((n, line) => n + line.quantity, 0),
    [cart],
  )

  const cartQtyById = useMemo(() => {
    const map = new Map<string, number>()
    for (const line of cart) map.set(line.product.id, line.quantity)
    return map
  }, [cart])

  const catalogue = useMemo(() => {
    const q = catalogueQuery.trim().toLowerCase()
    return products.filter((p) => {
      const matchesCategory =
        catalogueCategory === 'All' || p.category === catalogueCategory
      const matchesQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? '').includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q)
      return matchesCategory && matchesQuery
    })
  }, [products, catalogueQuery, catalogueCategory])

  const subtotal = cart.reduce(
    (sum, line) => sum + line.product.selling_price * line.quantity,
    0,
  )
  const safeDiscount = canDiscount
    ? Math.min(Math.max(0, discount), subtotal)
    : 0
  const total = subtotal - safeDiscount
  const cashValue = Number(cashReceived)
  const needsCashTender =
    paymentMethod === 'cash' ||
    paymentMethod === 'mtn' ||
    paymentMethod === 'airtel'
  const change =
    needsCashTender && Number.isFinite(cashValue) && cashReceived !== ''
      ? cashValue - total
      : null

  const momoAgent =
    paymentMethod === 'mtn'
      ? {
          network: 'MTN MoMo',
          number: shop?.mtnAgentNumber,
          code: shop?.mtnAgentCode,
        }
      : paymentMethod === 'airtel'
        ? {
            network: 'Airtel Money',
            number: shop?.airtelAgentNumber,
            code: shop?.airtelAgentCode,
          }
        : null

  const completeSaleRef = useRef<() => Promise<void>>(async () => undefined)

  useEffect(() => {
    void fetchShopProfile()
      .then(setShop)
      .catch(() => undefined)
  }, [])

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
    (productId: string, source: 'scan' | 'manual' = 'manual'): ScanResult => {
      setError('')
      const product =
        productIndexRef.current.byId.get(productId) ||
        productsRef.current.find((p) => p.id === productId)
      if (!product) {
        const message = 'Product not found'
        setError(message)
        if (source === 'scan') {
          playErrorBuzz()
          setScanStatus({ message, tone: 'error' })
        } else {
          push(message, 'error')
        }
        return { ok: false, message }
      }
      if (product.stock_quantity <= 0) {
        const message = `${product.name} is out of stock`
        setError(message)
        if (source === 'scan') {
          playErrorBuzz()
          setScanStatus({ message, tone: 'error' })
        } else {
          push(message, 'error')
        }
        return { ok: false, label: product.name, message }
      }

      const existing = cartRef.current.find((line) => line.product.id === productId)
      if (existing && existing.quantity >= product.stock_quantity) {
        const message = `Only ${product.stock_quantity} left · ${product.name}`
        setError(message)
        if (source === 'scan') {
          playErrorBuzz()
          setScanStatus({ message, tone: 'error' })
        } else {
          push(message, 'error')
        }
        return { ok: false, label: product.name, message }
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

      unlockAudio()
      playScanBeep()
      try {
        navigator.vibrate?.(source === 'scan' ? 28 : 18)
      } catch {
        // ignore
      }
      const label = `${product.name} · ${formatZMW(product.selling_price)}`
      const message = `+ ${label}`
      setFlash(message)
      window.setTimeout(() => setFlash(''), 900)
      if (source === 'scan') {
        setScanStatus({ message: `✓ ${label}`, tone: 'ok' })
      }
      setQuery('')
      return { ok: true, label: product.name, message }
    },
    [push],
  )

  const handleLookup = useCallback(
    (raw: string, source: 'scan' | 'manual' = 'manual'): ScanResult => {
      const code = raw.trim()
      if (!code) return { ok: false, message: 'Empty code' }

      const product = findProductByCode(code, productIndexRef.current)
      if (product) {
        return addProduct(product.id, source)
      }

      const message = `Not in catalogue: ${code}`
      setError(message)
      push(message, 'error')
      playErrorBuzz()
      if (source === 'scan') {
        setScanStatus({
          message: `${message} — add under Inventory first`,
          tone: 'error',
        })
      }
      return { ok: false, message }
    },
    [addProduct, push],
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
      needsCashTender &&
      cashReceived !== '' &&
      Number.isFinite(cashValue) &&
      cashValue < total &&
      paymentMethod === 'cash'
    ) {
      const msg = 'Cash received is less than the total'
      setError(msg)
      push(msg, 'error')
      return
    }
    setBusy(true)
    setError('')
    try {
      const noteParts: string[] = []
      if (cashReceived !== '' && Number.isFinite(cashValue)) {
        noteParts.push(`Cash given: ${cashValue.toFixed(2)}`)
      }
      if (change !== null) {
        noteParts.push(`Change: ${change.toFixed(2)}`)
      }
      if (momoAgent?.number) {
        noteParts.push(`${momoAgent.network} agent: ${momoAgent.number}`)
      }
      if (momoAgent?.code) {
        noteParts.push(`Agent code: ${momoAgent.code}`)
      }

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
          paymentMethod: PAYMENT_API[paymentMethod],
          notes: noteParts.length ? noteParts.join(' · ') : undefined,
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
      setCompletedCash(
        cashReceived !== '' && Number.isFinite(cashValue) ? cashValue : null,
      )
      setCompletedChange(change !== null ? change : null)
      setCompleted(mapped)
      setLastCart(cart.map((line) => ({ ...line })))
      // Optimistic stock — no full catalogue reload (keeps Sell snappy)
      applyStockDeltas(
        cart.map((line) => ({
          productId: line.product.id,
          delta: -line.quantity,
        })),
      )
      setCart([])
      setDiscount(0)
      setCashReceived('')
      setPaymentMethod('cash')
      // Background reconcile — don’t block the next customer
      window.setTimeout(() => {
        void refresh({ silent: true })
      }, 2500)
      // Keep the live camera session ready for the next customer
      if (scanOpen) keepScanOpenRef.current = true
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
    <div className="mx-auto grid max-w-6xl gap-4 pb-24 sm:gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:pb-0">
      <section className="space-y-4">
        <div className="relative overflow-hidden rounded-[24px] border border-line bg-[#0b1224] p-5 text-white sm:p-6">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-6 top-0 h-32 w-32 rounded-full bg-royal/40 blur-3xl interior-orb" />
            <div className="absolute bottom-0 left-8 h-28 w-28 rounded-full bg-teal/30 blur-3xl interior-orb-delay" />
          </div>
          <div className="relative z-10">
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Sell · live floor
            </p>
            <h2 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Sell
            </h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              {isPhone
                ? 'You’re signed in on this phone — tap products or open Camera. Sales save to the shop instantly.'
                : 'Click the catalogue, open Webcam, or link a phone gun. Sales sync for the whole shop.'}
              {!isPhone ? (
                <>
                  {' '}
                  Shortcuts:{' '}
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
                    F2
                  </kbd>{' '}
                  search ·{' '}
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-xs">
                    F4
                  </kbd>{' '}
                  complete
                </>
              ) : null}
            </p>
          </div>
        </div>

        {showPathTip ? (
          <div className="rounded-2xl border border-teal/30 bg-teal/10 px-4 py-3 text-sm text-ink">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">Best path for Sell</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {isPhone
                    ? 'Stay logged in on this phone → Live scan or tap catalogue → Complete. No QR pairing needed.'
                    : 'Sign in on a shop phone and open Sell (recommended). QR “phone as gun” is optional for counter-only setups. HTTPS setup: see PHONE-SETUP.md.'}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-ink-soft hover:bg-card hover:text-ink"
                onClick={() => {
                  setShowPathTip(false)
                  try {
                    localStorage.setItem('nexora-sell-path-tip', '1')
                  } catch {
                    // ignore
                  }
                }}
              >
                Got it
              </button>
            </div>
          </div>
        ) : null}

        {flash ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {flash}
          </div>
        ) : null}

        <div className="nx-card border-royal/25 bg-gradient-to-br from-royal/10 via-card to-teal/10 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-royal">
              Add products
            </p>
            {phoneOpen && phoneStatus === 'connected' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Phone live
              </span>
            ) : null}
          </div>

          {isPhone ? (
            <div className="mb-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
              <p className="font-semibold">Phone checkout mode</p>
              <p className="mt-1 text-xs opacity-90">
                No QR pairing needed — you’re logged in. Tap catalogue tiles or
                Camera. Complete the sale here; the shop ledger updates for
                everyone.
              </p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  unlockAudio()
                  setPhoneOpen(true)
                  setPhoneStatus('waiting')
                }}
                className={`mb-3 flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                  phoneOpen && phoneStatus === 'connected'
                    ? 'border-emerald-500/40 bg-emerald-500/10'
                    : 'border-royal/30 bg-royal/10 hover:bg-royal/15'
                }`}
              >
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    phoneOpen && phoneStatus === 'connected'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-royal text-white'
                  }`}
                >
                  <Smartphone className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">
                    {phoneOpen && phoneStatus === 'connected'
                      ? 'Phone gun linked'
                      : 'Phone as barcode gun (no login)'}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-soft">
                    {phoneOpen && phoneStatus === 'connected'
                      ? 'Keep scanning — items land in this laptop cart'
                      : 'Optional · QR link · or just sign in on the phone and open Sell'}
                  </span>
                </span>
              </button>

              {phoneOpen ? (
                <div className="mb-3 rounded-2xl border border-line bg-card p-4">
                  <PhonePairPanel
                    onScan={(code) => handleLookup(code, 'scan')}
                    onClose={() => {
                      setPhoneOpen(false)
                      setPhoneStatus('waiting')
                    }}
                    onStatusChange={setPhoneStatus}
                  />
                </div>
              ) : null}
            </>
          )}

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
                placeholder={
                  isPhone
                    ? 'Type barcode or name…'
                    : 'USB gun or type barcode / name…'
                }
                className="w-full rounded-2xl border border-line bg-card py-4 pl-12 pr-4 text-lg text-ink outline-none transition focus:border-royal focus:ring-4 focus:ring-royal/20"
                autoFocus={!isPhone}
              />
            </div>
            <Button
              type="button"
              className={`rounded-2xl px-5 py-4 ${isPhone ? 'min-h-14 flex-1 bg-[#3563E9] text-base hover:bg-[#2f58d4] sm:flex-none' : ''}`}
              variant={isPhone ? 'primary' : 'secondary'}
              onClick={() => {
                unlockAudio()
                setScanStatus({
                  message: 'Point at barcode',
                  tone: 'idle',
                })
                setScanOpen(true)
              }}
            >
              <ScanLine className="h-5 w-5" />
              {isPhone ? 'Live scan' : 'Webcam'}
            </Button>
          </div>
          {scanStatus.tone !== 'idle' ? (
            <div
              className={`mt-3 rounded-xl border px-4 py-3 text-sm font-semibold ${
                scanStatus.tone === 'ok'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                  : 'border-red-500/30 bg-red-500/10 text-danger'
              }`}
            >
              {scanStatus.message}
            </div>
          ) : null}
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
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-semibold text-ink">Shop catalogue</h3>
              <p className="mt-0.5 text-xs text-ink-soft">
                Click (or tap) a product to add it — click again to add another.
                Works with mouse or touchscreen.
              </p>
            </div>
            {loading ? (
              <span className="text-xs text-ink-soft">Loading…</span>
            ) : (
              <span className="text-xs text-ink-soft">
                {catalogue.length} shown · {products.length} total
              </span>
            )}
          </div>

          <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input
                value={catalogueQuery}
                onChange={(e) => setCatalogueQuery(e.target.value)}
                placeholder="Filter catalogue…"
                className="w-full rounded-xl border border-line bg-surface py-2.5 pl-10 pr-3 text-sm outline-none focus:border-royal focus:ring-4 focus:ring-royal/15"
              />
            </div>
            <select
              value={catalogueCategory}
              onChange={(e) => setCatalogueCategory(e.target.value)}
              className="rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-royal"
            >
              <option value="All">All categories</option>
              {PRODUCT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {!loading && products.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title="No products yet"
              body="Add stock in Inventory so staff can click products onto the cart."
            />
          ) : !loading && catalogue.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title="No matches"
              body="Try another filter or category."
            />
          ) : (
            <div className="max-h-[min(58vh,480px)] overflow-y-auto overscroll-contain pr-1">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {catalogue.map((product) => {
                  const inCart = cartQtyById.get(product.id) || 0
                  const low =
                    product.stock_quantity <= product.low_stock_threshold
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProduct(product.id)}
                      className={`relative rounded-xl border px-3 py-3 text-left transition active:scale-[0.98] ${
                        inCart
                          ? 'border-royal/40 bg-royal/10 hover:bg-royal/15'
                          : 'border-line hover:border-brand hover:bg-brand-soft/40'
                      }`}
                    >
                      {inCart > 0 ? (
                        <span className="absolute right-2 top-2 inline-flex min-w-6 items-center justify-center rounded-full bg-royal px-1.5 py-0.5 text-[11px] font-bold text-white">
                          {inCart}
                        </span>
                      ) : null}
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt=""
                          className="mb-2 h-16 w-full rounded-lg object-cover bg-surface"
                          loading="lazy"
                        />
                      ) : (
                        <div className="mb-2 flex h-12 items-center justify-center rounded-lg bg-surface text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                          {product.category}
                        </div>
                      )}
                      <p className="line-clamp-2 text-sm font-medium text-ink">
                        {product.name}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-brand">
                        {formatZMW(product.selling_price)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-soft">
                        Stock {product.stock_quantity}
                        {low ? ' · low' : ''}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div className="nx-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-ink">
              Cart
              {cartItemCount ? ` · ${cartItemCount}` : ''}
            </h3>
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
            <div className="mt-2 space-y-3">
              <EmptyState
                icon={Smartphone}
                title="Ready for the next customer"
                body={
                  isPhone
                    ? 'Tap Live scan or a catalogue tile. Sales save to the shop instantly.'
                    : 'Tap catalogue, Webcam, USB scan, or optional phone gun.'
                }
              />
              {lastCart.length > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full rounded-2xl"
                  onClick={() => {
                    setCart(lastCart.map((line) => ({ ...line })))
                    push('Same as last — adjust qty if needed', 'info')
                  }}
                >
                  Same as last · {lastCart.reduce((n, l) => n + l.quantity, 0)}{' '}
                  items
                </Button>
              ) : null}
            </div>
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
            {canDiscount ? (
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
            ) : null}
            <div className="flex justify-between text-lg font-bold text-ink">
              <span>Total</span>
              <span>{formatZMW(total)}</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-ink">Payment</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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

          {momoAgent ? (
            <div className="mt-4 space-y-2 rounded-xl border border-royal/25 bg-royal/5 p-3 text-sm">
              <p className="font-semibold text-ink">{momoAgent.network} agent</p>
              <p className="text-xs text-ink-soft">
                Customer sends money to your shop number, or withdraws cash and
                you take cash at the counter.
              </p>
              <div className="rounded-lg bg-card px-3 py-2">
                <p className="text-xs text-ink-soft">Shop MoMo number</p>
                <p className="font-mono text-base font-bold text-ink">
                  {momoAgent.number || 'Not set'}
                </p>
                {momoAgent.code ? (
                  <p className="mt-1 text-xs text-ink-soft">
                    Agent code:{' '}
                    <span className="font-semibold text-ink">{momoAgent.code}</span>
                  </p>
                ) : null}
                {!momoAgent.number ? (
                  <Link
                    to="/app/settings"
                    className="mt-2 inline-block text-xs font-semibold text-royal hover:underline"
                  >
                    Add in Settings → Mobile money
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}

          {needsCashTender ? (
            <div className="mt-4 space-y-2 rounded-xl bg-surface p-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink-soft">
                  {paymentMethod === 'cash'
                    ? 'Cash received'
                    : 'Cash handed over'}
                </span>
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
                  Optional — enter cash given to calculate change for the receipt.
                </p>
              )}
            </div>
          ) : null}

          <Button
            type="button"
            className="mt-5 hidden w-full rounded-2xl py-3.5 text-base lg:inline-flex"
            disabled={busy || cart.length === 0}
            onClick={() => void completeSale()}
          >
            {busy
              ? 'Recording sale…'
              : cart.length === 0
                ? 'Add items to sell'
                : `Complete · ${formatZMW(total)}`}
          </Button>
        </div>
      </section>

      {/* Sticky Complete — above bottom nav on phones */}
      {cart.length > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-card/95 px-3 py-2.5 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-ink-soft">
                {cartItemCount} item{cartItemCount === 1 ? '' : 's'}
              </p>
              <p className="font-display text-lg font-bold tabular-nums text-ink">
                {formatZMW(total)}
              </p>
            </div>
            <Button
              type="button"
              className="shrink-0 rounded-2xl px-5 py-3.5 text-base"
              disabled={busy}
              onClick={() => void completeSale()}
            >
              {busy ? 'Saving…' : 'Complete sale'}
            </Button>
          </div>
        </div>
      ) : null}

      {scanOpen && !completed ? (
        <Modal
          title="Live scan"
          onClose={() => {
            keepScanOpenRef.current = false
            setScanOpen(false)
          }}
          wide
        >
          <BarcodeScanner
            continuous
            statusMessage={scanStatus.message}
            statusTone={scanStatus.tone}
            onScan={(code) => {
              handleLookup(code, 'scan')
            }}
            onClose={() => {
              keepScanOpenRef.current = false
              setScanOpen(false)
            }}
          />
        </Modal>
      ) : null}

      {completed ? (
        <Modal
          title="Sale complete"
          onClose={() => {
            setCompleted(null)
            setCompletedChange(null)
            setCompletedCash(null)
            if (keepScanOpenRef.current) setScanOpen(true)
          }}
        >
          <SaleReceiptPanel
            sale={completed}
            shop={shop ?? undefined}
            cashGiven={completedCash ?? undefined}
            changeDue={completedChange ?? undefined}
            onDone={() => {
              setCompleted(null)
              setCompletedChange(null)
              setCompletedCash(null)
              if (keepScanOpenRef.current) setScanOpen(true)
            }}
          />
        </Modal>
      ) : null}
    </div>
  )
}
