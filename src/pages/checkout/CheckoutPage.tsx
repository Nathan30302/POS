import {
  lazy,
  Suspense,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Eraser,
  PackageOpen,
  ScanLine,
  Search,
  Smartphone,
} from 'lucide-react'

/** ZXing lives here — keep Sell chunk lean until Scan opens */
const BarcodeScanner = lazy(() =>
  import('@/components/BarcodeScanner').then((m) => ({
    default: m.BarcodeScanner,
  })),
)
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { PhonePairPanel } from '@/components/PhonePairPanel'
import { OfflineQueuePanel } from '@/components/OfflineQueuePanel'
import { PhoneShopLink } from '@/components/PhoneShopLink'
import { SaleReceiptPanel } from '@/components/SaleReceiptPanel'
import { ShiftDrawerPanel } from '@/components/ShiftDrawerPanel'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/context/AuthContext'
import { useOfflineSync } from '@/context/OfflineSyncContext'
import { useCheckoutCart } from '@/hooks/useCheckoutCart'
import { useProducts } from '@/hooks/useProducts'
import { useVirtualGrid } from '@/hooks/useVirtualGrid'
import { CartLineRow } from '@/pages/checkout/CartLineRow'
import { CatalogueTile } from '@/pages/checkout/CatalogueTile'
import { api } from '@/lib/api'
import { buildProductIndex, findProductByCode } from '@/lib/findProduct'
import { getActiveBranchId } from '@/lib/branch'
import { enqueueSale, isProbablyOffline } from '@/lib/offlineQueue'
import { formatZMW } from '@/lib/money'
import { loyaltyDiscountKwacha, suggestTenders } from '@/lib/tender'
import type { ScanResult } from '@/lib/peerRoom'
import {
  playAddBeep,
  playErrorBuzz,
  playRemoveBeep,
  playSuccessChime,
  unlockAudio,
} from '@/lib/sounds'
import { speakSaleThanks } from '@/lib/voiceThanks'
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
  const { user, can } = useAuth()
  const canDiscount = can('discounts')
  const canCredit = can('credit_sales')
  const {
    products,
    loading,
    error: productsError,
    refresh,
    applyStockDeltas,
  } = useProducts({ lean: true })
  const {
    cart,
    setCart,
    setQty,
    removeLine,
    clearCart: emptyCart,
    restoreCart,
  } = useCheckoutCart()
  const [query, setQuery] = useState('')
  const [discount, setDiscount] = useState(0)
  const [discountReason, setDiscountReason] = useState('')
  const [prescriptionNote, setPrescriptionNote] = useState('')
  const [managerPin, setManagerPin] = useState('')
  const [managerPinConfigured, setManagerPinConfigured] = useState(false)
  const [cashReceived, setCashReceived] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [scanOpen, setScanOpen] = useState(false)
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [phoneStatus, setPhoneStatus] = useState<
    'waiting' | 'connected' | 'error'
  >('waiting')
  const [scanStatus, setScanStatus] = useState<ScanStatus>({
    message: '',
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
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [customerLabel, setCustomerLabel] = useState('')
  const [customerPts, setCustomerPts] = useState(0)
  const [customerBalance, setCustomerBalance] = useState(0)
  const [customerCreditLimit, setCustomerCreditLimit] = useState(0)
  const [customerBusy, setCustomerBusy] = useState(false)
  const {
    online,
    queue,
    pendingCount,
    conflictCount,
    syncing,
    lastSyncAt,
    lastSyncError,
    syncAll,
    retryWithConflictAccept,
    dropSale,
  } = useOfflineSync()
  const isPhone =
    typeof navigator !== 'undefined' &&
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  const barcodeTimerRef = useRef<number | null>(null)
  const barcodeBurstRef = useRef(false)
  const lastBarcodeKeyAtRef = useRef(0)
  /**
   * HID wedge inter-key gap. Laptops/USB guns often 20–90ms; keep burst detection
   * wide enough to stitch the code, then settle fast on desktop only.
   * Phone path uses the same burst flag but slower settle below — do not tighten
   * phone camera UX here.
   */
  const WEDGE_BURST_MS = isPhone ? 85 : 110
  const searchRef = useRef<HTMLInputElement | null>(null)
  const catalogueScrollRef = useRef<HTMLDivElement | null>(null)
  const [catalogueCols, setCatalogueCols] = useState(isPhone ? 2 : 3)
  const keepScanOpenRef = useRef(false)
  /** Last successful scan-add — rescan same product within window undoes −1 */
  const lastScanAddRef = useRef<{ productId: string; at: number } | null>(null)
  const cartRef = useRef(cart)
  cartRef.current = cart
  const productsRef = useRef(products)
  productsRef.current = products
  const scanOpenRef = useRef(scanOpen)
  scanOpenRef.current = scanOpen
  const completedRef = useRef(completed)
  completedRef.current = completed

  const productIndex = useMemo(() => buildProductIndex(products), [products])
  const productIndexRef = useRef(productIndex)
  productIndexRef.current = productIndex

  // Defer name-search filtering so USB wedge digits don't thrash the catalogue UI
  const deferredQuery = useDeferredValue(query)
  const suggestions = useMemo(() => {
    if (barcodeBurstRef.current) return []
    const q = deferredQuery.trim().toLowerCase()
    if (!q) return []
    // Digit-only bursts are barcodes — skip expensive name filter
    if (/^\d{4,}$/.test(q)) return []
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode ?? '').includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [products, deferredQuery])

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

  useEffect(() => {
    const el = catalogueScrollRef.current
    if (!el) return
    const update = () => {
      const w = el.clientWidth
      setCatalogueCols(w < 420 ? 2 : w < 720 ? 3 : 4)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [products.length, loading])

  useEffect(() => {
    void api<{ configured: boolean }>('/team/manager-pin/status')
      .then((d) => setManagerPinConfigured(d.configured))
      .catch(() => setManagerPinConfigured(false))
  }, [])

  const virtualCatalogue = useVirtualGrid(catalogue, {
    containerRef: catalogueScrollRef,
    rowHeight: isPhone ? 220 : 236,
    columns: catalogueCols,
    overscan: 3,
  })

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

  const tenderSuggestions = useMemo(
    () => (paymentMethod === 'cash' ? suggestTenders(total) : []),
    [paymentMethod, total],
  )

  const loyaltyOffer = useMemo(
    () =>
      canDiscount ? loyaltyDiscountKwacha(customerPts, subtotal) : 0,
    [canDiscount, customerPts, subtotal],
  )

  const cartNeedsRx = useMemo(
    () =>
      Boolean(user?.modules?.pharmacy) &&
      cart.some((l) => l.product.requires_prescription),
    [cart, user?.modules?.pharmacy],
  )

  const recentProducts = useMemo(() => {
    const seen = new Set<string>()
    const out: typeof products = []
    for (const line of lastCart) {
      const id = line.product.id
      if (seen.has(id)) continue
      seen.add(id)
      const fresh = productIndex.byId.get(id)
      if (fresh) out.push(fresh)
      if (out.length >= 8) break
    }
    return out
  }, [lastCart, productIndex, products])

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
      .then((profile) => {
        setShop({
          ...profile,
          // Always prefer live session business name on receipt
          name: user?.businessName?.trim() || profile.name,
        })
      })
      .catch(() => {
        if (user?.businessName) {
          setShop({
            name: user.businessName,
            currency: 'ZMW',
          })
        }
      })
  }, [user?.businessName])

  const clearBarcodeTimer = useCallback(() => {
    if (barcodeTimerRef.current) {
      window.clearTimeout(barcodeTimerRef.current)
      barcodeTimerRef.current = null
    }
  }, [])

  const focusSearch = useCallback((select = false) => {
    const el = searchRef.current
    if (!el) return
    el.focus()
    if (select) el.select()
  }, [])

  const clearCustomer = useCallback(() => {
    setCustomerId(null)
    setCustomerLabel('')
    setCustomerPhone('')
    setCustomerPts(0)
  }, [])

  const addProduct = useCallback(
    (
      productId: string,
      source: 'scan' | 'manual' = 'manual',
      qty = 1,
    ): ScanResult => {
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
      const already = existing?.quantity || 0
      const room = product.stock_quantity - already
      if (room <= 0) {
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

      const addQty = Math.min(Math.max(1, qty), room)

      setCart((prev) => {
        const current = prev.find((line) => line.product.id === productId)
        if (current) {
          return prev.map((line) =>
            line.product.id === productId
              ? { ...line, quantity: line.quantity + addQty }
              : line,
          )
        }
        return [...prev, { product, quantity: addQty }]
      })

      unlockAudio()
      playAddBeep()
      try {
        navigator.vibrate?.(source === 'scan' ? 28 : addQty > 1 ? 36 : 18)
      } catch {
        // ignore
      }
      const label = `${product.name} · ${formatZMW(product.selling_price)}`
      const message = addQty > 1 ? `+${addQty} ${label}` : `+ ${label}`
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

  const removeOneByScan = useCallback(
    (productId: string, productName: string): ScanResult => {
      const inCart = cartRef.current.find((l) => l.product.id === productId)
      if (!inCart) {
        const message = `${productName} isn’t in the cart`
        setScanStatus({ message, tone: 'error' })
        playErrorBuzz()
        return { ok: false, label: productName, message }
      }
      const nextQty = inCart.quantity - 1
      setCart((lines) =>
        lines
          .map((line) =>
            line.product.id === productId
              ? { ...line, quantity: nextQty }
              : line,
          )
          .filter((line) => line.quantity > 0),
      )
      lastScanAddRef.current = null
      unlockAudio()
      playRemoveBeep()
      try {
        navigator.vibrate?.([30, 40, 30])
      } catch {
        // ignore
      }
      const message =
        nextQty > 0
          ? `−1 ${productName} · now ×${nextQty}`
          : `Removed ${productName}`
      setFlash(message)
      window.setTimeout(() => setFlash(''), 1200)
      setScanStatus({ message, tone: 'ok' })
      return { ok: true, label: productName, message }
    },
    [],
  )

  const handleLookup = useCallback(
    (
      raw: string,
      source: 'scan' | 'manual' = 'manual',
      intent: 'add' | 'remove' = 'add',
    ): ScanResult => {
      const code = raw.trim()
      if (!code) return { ok: false, message: 'Empty code' }

      const product = findProductByCode(code, productIndexRef.current)
      if (!product) {
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
      }

      if (source === 'scan' && intent === 'remove') {
        return removeOneByScan(product.id, product.name)
      }

      const result = addProduct(product.id, source)
      if (result.ok && source === 'scan') {
        lastScanAddRef.current = { productId: product.id, at: Date.now() }
      }
      if (result.ok && !isPhone) {
        window.requestAnimationFrame(() => focusSearch())
      }
      return result
    },
    [addProduct, focusSearch, isPhone, push, removeOneByScan],
  )

  const submitBarcodeSearch = useCallback(
    (raw: string) => {
      clearBarcodeTimer()
      barcodeBurstRef.current = false
      const code = raw.trim()
      if (!code) return
      handleLookup(code, 'manual')
      setQuery('')
      window.requestAnimationFrame(() => focusSearch())
    },
    [clearBarcodeTimer, focusSearch, handleLookup],
  )

  const scheduleBarcodeAutoSubmit = useCallback(
    (next: string) => {
      clearBarcodeTimer()
      const trimmed = next.trim()
      if (!trimmed) return
      const digitBarcode = /^\d{6,18}$/.test(trimmed)
      const burstReady = barcodeBurstRef.current && trimmed.length >= 6
      if (!digitBarcode && !burstReady) return
      // Complete retail lengths settle fast; partial codes wait a bit longer.
      // Laptop/tablet-as-desktop: snappier USB wedge; phone keep prior timing.
      const completeLen =
        /^\d{8}$/.test(trimmed) ||
        /^\d{12}$/.test(trimmed) ||
        /^\d{13}$/.test(trimmed) ||
        /^\d{14}$/.test(trimmed)
      const settleMs = isPhone
        ? completeLen
          ? 28
          : digitBarcode && trimmed.length >= 10
            ? 45
            : burstReady
              ? 55
              : 90
        : completeLen
          ? 16
          : digitBarcode && trimmed.length >= 10
            ? 32
            : burstReady
              ? 40
              : 70
      barcodeTimerRef.current = window.setTimeout(() => {
        barcodeTimerRef.current = null
        // Live DOM — React state can lag a fast HID wedge
        const live = searchRef.current?.value?.trim() || trimmed
        if (!live) return
        if (
          /^\d{6,18}$/.test(live) ||
          (barcodeBurstRef.current && live.length >= 6)
        ) {
          submitBarcodeSearch(live)
        }
      }, settleMs)
    },
    [clearBarcodeTimer, isPhone, submitBarcodeSearch],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const typing =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        Boolean(target?.isContentEditable)
      if (e.key === 'F2') {
        e.preventDefault()
        focusSearch(true)
      }
      if (e.key === 'F3') {
        e.preventDefault()
        unlockAudio()
        setScanStatus({ message: '', tone: 'idle' })
        setScanOpen(true)
      }
      if (e.key === 'F4') {
        e.preventDefault()
        void completeSaleRef.current()
      }
      if (e.key === 'Escape' && !typing) {
        setQuery('')
        setError('')
      }

      // USB keyboard-wedge: when focus is elsewhere on Sell, still capture the burst
      if (
        typing ||
        scanOpenRef.current ||
        completedRef.current ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return
      }
      if (e.key === 'Enter') {
        const live = searchRef.current?.value ?? ''
        if (live.trim()) {
          e.preventDefault()
          submitBarcodeSearch(live)
        }
        return
      }
      if (e.key.length === 1) {
        e.preventDefault()
        const now = Date.now()
        if (now - lastBarcodeKeyAtRef.current < WEDGE_BURST_MS) {
          barcodeBurstRef.current = true
        }
        lastBarcodeKeyAtRef.current = now
        const el = searchRef.current
        const base = el?.value ?? ''
        const next = `${base}${e.key}`
        // Keep input DOM ahead of React so Enter / settle read the full code
        if (el) el.value = next
        setQuery(next)
        if (document.activeElement !== el) focusSearch()
        scheduleBarcodeAutoSubmit(next)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusSearch, scheduleBarcodeAutoSubmit, submitBarcodeSearch])

  async function lookupCustomer(raw?: string) {
    const phone = (raw ?? customerPhone).trim()
    if (!phone) {
      setCustomerId(null)
      setCustomerLabel('')
      setCustomerPts(0)
      setCustomerBalance(0)
      setCustomerCreditLimit(0)
      return
    }
    if (phone.length < 3) return
    setCustomerBusy(true)
    try {
      const data = await api<{
        customers: Array<{
          id: string
          fullName: string
          phone: string | null
          loyaltyPts: number
          balance: number
          creditLimit: number
        }>
      }>(`/customers?q=${encodeURIComponent(phone)}`)
      const hit = data.customers[0]
      if (!hit) {
        setCustomerId(null)
        setCustomerPts(0)
        setCustomerBalance(0)
        setCustomerCreditLimit(0)
        setCustomerLabel('No customer match')
        return
      }
      setCustomerId(hit.id)
      setCustomerPts(hit.loyaltyPts || 0)
      setCustomerBalance(hit.balance || 0)
      setCustomerCreditLimit(hit.creditLimit || 0)
      const avail = Math.max(0, (hit.creditLimit || 0) - (hit.balance || 0))
      setCustomerLabel(
        `${hit.fullName}${hit.loyaltyPts ? ` · ${hit.loyaltyPts} pts` : ''}${
          hit.balance > 0 ? ` · owes ${formatZMW(hit.balance)}` : ''
        }${
          hit.creditLimit > 0
            ? ` · credit avail ${formatZMW(avail)}`
            : ''
        }`,
      )
    } catch {
      setCustomerLabel('Customer lookup unavailable offline')
    } finally {
      setCustomerBusy(false)
    }
  }

  useEffect(() => {
    const phone = customerPhone.trim()
    if (phone.length < 3) {
      if (!phone) {
        setCustomerId(null)
        setCustomerLabel('')
        setCustomerPts(0)
        setCustomerBalance(0)
        setCustomerCreditLimit(0)
      }
      return
    }
    const t = window.setTimeout(() => {
      void lookupCustomer(phone)
    }, 380)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce phone only
  }, [customerPhone])

  async function completeSale() {
    if (!cart.length) {
      setError('Add at least one item')
      push('Add at least one item', 'error')
      return
    }
    // Default Exact cash so receipts always show money handed + change
    let tenderCash =
      cashReceived !== '' && Number.isFinite(cashValue) ? cashValue : null
    if (paymentMethod === 'cash' && tenderCash === null && total > 0) {
      tenderCash = Number(total.toFixed(2))
    }
    if (
      paymentMethod === 'cash' &&
      tenderCash !== null &&
      tenderCash < total
    ) {
      const msg = 'Cash received is less than the total'
      setError(msg)
      push(msg, 'error')
      return
    }
    if (paymentMethod === 'credit') {
      if (!canCredit) {
        const msg = 'You need credit_sales permission for credit sales'
        setError(msg)
        push(msg, 'error')
        return
      }
      if (!customerId) {
        const msg = 'Credit sale requires a matched customer (phone lookup)'
        setError(msg)
        push(msg, 'error')
        return
      }
      if (customerCreditLimit <= 0) {
        const msg = 'Customer has no credit limit — set one under Customers'
        setError(msg)
        push(msg, 'error')
        return
      }
      if (customerBalance + total > customerCreditLimit + 0.001) {
        const msg = `Credit limit exceeded (owed ${formatZMW(customerBalance)} + ${formatZMW(total)} > ${formatZMW(customerCreditLimit)})`
        setError(msg)
        push(msg, 'error')
        return
      }
    }
    const tenderChange =
      tenderCash !== null ? Number((tenderCash - total).toFixed(2)) : null

    const largeDiscount =
      safeDiscount > 0 &&
      ((subtotal > 0 && safeDiscount / subtotal >= 0.2) || safeDiscount >= 50)
    const reasonTrim = discountReason.trim()
    if (largeDiscount && reasonTrim.length < 3) {
      const msg = 'Large discount needs a short reason (logged for Trust)'
      setError(msg)
      push(msg, 'error')
      return
    }
    if (
      largeDiscount &&
      managerPinConfigured &&
      !/^\d{4,6}$/.test(managerPin.trim())
    ) {
      const msg = 'Large discount needs manager PIN (4–6 digits)'
      setError(msg)
      push(msg, 'error')
      return
    }
    if (cartNeedsRx && prescriptionNote.trim().length < 3) {
      const msg = 'Rx items need a short prescription / dispense note'
      setError(msg)
      push(msg, 'error')
      return
    }

    setBusy(true)
    setError('')
    try {
      const noteParts: string[] = []
      if (tenderCash !== null) {
        noteParts.push(`Cash given: ${tenderCash.toFixed(2)}`)
      }
      if (tenderChange !== null) {
        noteParts.push(`Change: ${tenderChange.toFixed(2)}`)
      }
      if (momoAgent?.number) {
        noteParts.push(`${momoAgent.network} agent: ${momoAgent.number}`)
      }
      if (momoAgent?.code) {
        noteParts.push(`Agent code: ${momoAgent.code}`)
      }
      if (customerLabel) noteParts.push(`Customer: ${customerLabel}`)

      const clientSaleId = crypto.randomUUID()
      const payloadLines = cart.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
        productName: line.product.name,
        unitPrice: line.product.selling_price,
      }))
      const notes = noteParts.length ? noteParts.join(' · ') : undefined
      const paymentApi = PAYMENT_API[paymentMethod]

      // Offline: durable queue, optimistic receipt, sync later
      if (isProbablyOffline() || !online) {
        await enqueueSale({
          clientSaleId,
          discount: safeDiscount,
          discountReason: reasonTrim || undefined,
          paymentMethod: paymentApi,
          notes: reasonTrim
            ? [notes, `Discount reason: ${reasonTrim}`].filter(Boolean).join(' · ')
            : notes,
          customerId: customerId || undefined,
          loyaltyPtsRedeemed:
            reasonTrim.toLowerCase().includes('loyalty') && safeDiscount > 0
              ? Math.floor(safeDiscount) * 10
              : undefined,
          prescriptionNote: cartNeedsRx
            ? prescriptionNote.trim()
            : undefined,
          lines: payloadLines,
          branchId: getActiveBranchId(),
        })
        const offlineMapped = {
          id: clientSaleId,
          total,
          discount: safeDiscount,
          payment_method: paymentMethod,
          notes: notes || 'Queued offline — awaiting sync',
          created_at: new Date().toISOString(),
          items: cart.map((line, i) => ({
            id: `${clientSaleId}-${i}`,
            sale_id: clientSaleId,
            product_id: line.product.id,
            product_name: line.product.name,
            quantity: line.quantity,
            unit_price: line.product.selling_price,
            line_total: line.product.selling_price * line.quantity,
          })),
        }
        playSuccessChime()
        speakSaleThanks()
        push(`Saved offline · sync when online`, 'ok')
        setCompletedCash(tenderCash)
        setCompletedChange(tenderChange)
        setCompleted(offlineMapped)
        setLastCart(cart.map((line) => ({ ...line })))
        applyStockDeltas(
          cart.map((line) => ({
            productId: line.product.id,
            delta: -line.quantity,
          })),
        )
        emptyCart()
        setDiscount(0)
        setDiscountReason('')
        setCashReceived('')
        setPaymentMethod('cash')
        clearCustomer()
        if (scanOpen) keepScanOpenRef.current = true
        return
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
          clientSaleId,
          customerId: customerId || undefined,
          loyaltyPtsRedeemed:
            reasonTrim.toLowerCase().includes('loyalty') && safeDiscount > 0
              ? Math.floor(safeDiscount) * 10
              : undefined,
          lines: payloadLines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
          })),
          discount: safeDiscount,
          discountReason: reasonTrim || undefined,
          prescriptionNote: cartNeedsRx
            ? prescriptionNote.trim()
            : undefined,
          managerPin:
            largeDiscount && managerPinConfigured
              ? managerPin.trim()
              : undefined,
          paymentMethod: paymentApi,
          notes,
        }),
      })
      setManagerPin('')
      setPrescriptionNote('')
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
      speakSaleThanks()
      push(`Sale complete · ${formatZMW(mapped.total)}`, 'ok')
      setCompletedCash(tenderCash)
      setCompletedChange(tenderChange)
      setCompleted(mapped)
      setLastCart(cart.map((line) => ({ ...line })))
      applyStockDeltas(
        cart.map((line) => ({
          productId: line.product.id,
          delta: -line.quantity,
        })),
      )
      emptyCart()
      setDiscount(0)
      setDiscountReason('')
      setCashReceived('')
      setPaymentMethod('cash')
      clearCustomer()
      window.setTimeout(() => {
        void refresh({ silent: true })
      }, 2500)
      if (scanOpen) keepScanOpenRef.current = true
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sale failed'
      // Network failure mid-request → queue locally
      if (/failed to fetch|network|offline/i.test(msg)) {
        try {
          const clientSaleId = crypto.randomUUID()
          await enqueueSale({
            clientSaleId,
            discount: safeDiscount,
            discountReason: reasonTrim || undefined,
            paymentMethod: PAYMENT_API[paymentMethod],
            notes: 'Queued after network error',
            customerId: customerId || undefined,
            loyaltyPtsRedeemed:
              reasonTrim.toLowerCase().includes('loyalty') && safeDiscount > 0
                ? Math.floor(safeDiscount) * 10
                : undefined,
            lines: cart.map((line) => ({
              productId: line.product.id,
              quantity: line.quantity,
              productName: line.product.name,
              unitPrice: line.product.selling_price,
            })),
            branchId: getActiveBranchId(),
          })
          push('Network dropped — sale queued offline', 'info')
          applyStockDeltas(
            cart.map((line) => ({
              productId: line.product.id,
              delta: -line.quantity,
            })),
          )
          setLastCart(cart.map((line) => ({ ...line })))
          emptyCart()
          setDiscount(0)
          setDiscountReason('')
          setCashReceived('')
          clearCustomer()
          setBusy(false)
          return
        } catch {
          // fall through
        }
      }
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
    emptyCart()
    setDiscount(0)
    setDiscountReason('')
    setCashReceived('')
    setError('')
    push('Cart cleared', 'info')
  }

  return (
    <div
      className={`mx-auto grid max-w-6xl gap-4 overflow-x-hidden sm:gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:gap-6 lg:pb-0 ${
        cart.length > 0
          ? 'pb-[calc(11.75rem+env(safe-area-inset-bottom))]'
          : 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]'
      }`}
    >
      <section className="order-1 space-y-3.5 sm:space-y-4">
        <PageHero
          eyebrow="Sell · live floor"
          title="Sell"
          subtitle="Scan, search, or tap the catalogue. Complete stays sticky on phones."
        />

        <ShiftDrawerPanel compact />

        <OfflineQueuePanel
          online={online}
          queue={queue}
          syncing={syncing}
          pendingCount={pendingCount}
          conflictCount={conflictCount}
          lastSyncAt={lastSyncAt}
          lastSyncError={lastSyncError}
          onSync={() => void syncAll()}
          onRetryConflict={(id) => void retryWithConflictAccept(id)}
          onDrop={(id) => void dropSale(id)}
        />

        {!isPhone ? (
          <PhoneShopLink
            path="/login"
            title="Phone Sell link"
            hint="Same Wi‑Fi · sign in · Sell"
          />
        ) : null}

        <div className="nx-card space-y-2 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Customer phone / loyalty
              </span>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                onBlur={() => void lookupCustomer()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void lookupCustomer()
                  }
                }}
                placeholder="097… or name"
                inputMode="tel"
                autoComplete="tel"
                className="nx-field"
              />
            </label>
            {customerBusy || customerLabel ? (
              <p className="pb-2 text-xs text-ink-soft sm:max-w-[14rem]">
                {customerBusy ? 'Looking up…' : customerLabel}
              </p>
            ) : null}
          </div>
          {customerId && loyaltyOffer > 0 && discount < loyaltyOffer ? (
            <button
              type="button"
              onClick={() => {
                setDiscount(loyaltyOffer)
                setDiscountReason((r) => (r.trim() ? r : 'Loyalty redeem'))
                push(`Loyalty applied · ${formatZMW(loyaltyOffer)} off`, 'ok')
              }}
              className="w-full rounded-xl border border-teal/30 bg-teal/10 px-3 py-2 text-left text-sm font-semibold text-ink transition hover:bg-teal/15"
            >
              Apply loyalty · {formatZMW(loyaltyOffer)} off
              <span className="mt-0.5 block text-[11px] font-normal text-ink-soft">
                {customerPts} pts · 10 pts = K1 · max 20% of subtotal
              </span>
            </button>
          ) : null}
        </div>

        {flash ? <FormBanner tone="ok">{flash}</FormBanner> : null}

        <div className="nx-card border-royal/25 bg-gradient-to-br from-royal/10 via-card to-teal/10 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-royal">
                Add products
              </p>
              {isPhone ? (
                <p className="mt-0.5 text-[11px] text-ink-soft">
                  Live scan or type a barcode / name. Other screens are under More.
                </p>
              ) : null}
            </div>
            {isPhone ? (
              <Link
                to="/app/guide"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-teal/30 bg-teal/10 px-2.5 text-xs font-bold text-teal"
              >
                <BookOpen className="h-3.5 w-3.5" />
                How to use
              </Link>
            ) : null}
            {phoneOpen && phoneStatus === 'connected' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Phone live
              </span>
            ) : null}
          </div>

          {isPhone ? null : (
            <>
              <button
                type="button"
                onClick={() => {
                  unlockAudio()
                  setPhoneOpen(true)
                  setPhoneStatus('waiting')
                }}
                className={`mb-3 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
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
                      ? 'Phone linked'
                      : 'Link phone'}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-soft">
                    {phoneOpen && phoneStatus === 'connected'
                      ? 'Scans add to this cart'
                      : 'QR on phone · live on this cart'}
                  </span>
                </span>
              </button>

              {phoneOpen ? (
                <div className="mb-3 rounded-2xl border border-line bg-card p-4">
                  <PhonePairPanel
                    onScan={(code, intent = 'add') =>
                      handleLookup(code, 'scan', intent)
                    }
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
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 z-[1] h-5 w-5 -translate-y-1/2 text-ink-soft sm:left-4"
                aria-hidden
              />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  const next = e.target.value
                  const now = Date.now()
                  if (now - lastBarcodeKeyAtRef.current < WEDGE_BURST_MS) {
                    barcodeBurstRef.current = true
                  }
                  lastBarcodeKeyAtRef.current = now
                  setQuery(next)
                  scheduleBarcodeAutoSubmit(next)
                }}
                onPaste={(e) => {
                  // Laptop scanners / clipboard paste — submit as soon as digits land
                  if (isPhone) return
                  const text = e.clipboardData?.getData('text')?.trim() ?? ''
                  if (!/^\d{6,18}$/.test(text) && text.length < 6) return
                  e.preventDefault()
                  clearBarcodeTimer()
                  if (searchRef.current) searchRef.current.value = text
                  setQuery(text)
                  barcodeBurstRef.current = true
                  submitBarcodeSearch(text)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    clearBarcodeTimer()
                    // Live DOM value — React state can lag behind a fast gun
                    const raw = searchRef.current?.value ?? query
                    submitBarcodeSearch(raw)
                  }
                }}
                placeholder={
                  isPhone
                    ? 'Barcode or name'
                    : 'Scan barcode or type name · Enter'
                }
                aria-label="Search barcode or product name"
                className="nx-field nx-field-icon-lg rounded-2xl py-3.5 pr-4 text-base sm:py-4 sm:text-lg"
                autoFocus={!isPhone}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode={isPhone ? undefined : 'search'}
              />
            </div>
            <Button
              type="button"
              className={`rounded-2xl px-5 py-4 ${isPhone ? 'min-h-14 flex-1 text-base sm:flex-none' : ''}`}
              variant={isPhone ? 'primary' : 'secondary'}
              onClick={() => {
                unlockAudio()
                const secure = window.isSecureContext
                setScanStatus({
                  message: secure
                    ? ''
                    : 'Live camera needs HTTPS — open the public shop link on this phone.',
                  tone: secure ? 'idle' : 'error',
                })
                setScanOpen(true)
              }}
            >
              <ScanLine className="h-5 w-5" />
              {isPhone ? 'Live scan' : 'Scan'}
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

        {error ? <FormBanner tone="error">{error}</FormBanner> : null}
        {productsError ? (
          <FormBanner tone="error">
            Could not load products: {productsError}.{' '}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => void refresh()}
            >
              Retry
            </button>
          </FormBanner>
        ) : null}

        <div className="nx-card p-3.5 sm:p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-semibold text-ink">Catalogue</h3>
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
              <Search
                className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-ink-soft"
                aria-hidden
              />
              <input
                value={catalogueQuery}
                onChange={(e) => setCatalogueQuery(e.target.value)}
                placeholder={isPhone ? 'Filter…' : 'Filter catalogue…'}
                aria-label="Filter catalogue"
                className="nx-field nx-field-icon bg-surface py-2.5 pr-3"
              />
            </div>
            <select
              value={catalogueCategory}
              onChange={(e) => setCatalogueCategory(e.target.value)}
              className="nx-field bg-surface"
            >
              <option value="All">All categories</option>
              {PRODUCT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {recentProducts.length > 0 &&
          catalogueCategory === 'All' &&
          !catalogueQuery.trim() ? (
            <div className="mb-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                Last sale
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {recentProducts.map((product) => {
                  const inCart = cartQtyById.get(product.id) || 0
                  return (
                    <button
                      key={`recent-${product.id}`}
                      type="button"
                      onClick={() => addProduct(product.id)}
                      className={`shrink-0 max-w-[9.5rem] rounded-xl border px-3 py-2 text-left transition active:scale-[0.98] ${
                        inCart
                          ? 'border-royal/40 bg-royal/10'
                          : 'border-line bg-surface hover:border-brand'
                      }`}
                    >
                      <p className="line-clamp-1 text-xs font-semibold text-ink">
                        {product.name}
                      </p>
                      <p className="text-[11px] text-brand">
                        {formatZMW(product.selling_price)}
                        {inCart ? ` · ×${inCart}` : ''}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {!loading && productsError ? (
            <EmptyState
              compact
              icon={PackageOpen}
              title="Catalogue unavailable"
              body="Check your connection, then retry loading products."
            />
          ) : !loading && products.length === 0 ? (
            <EmptyState
              compact
              icon={PackageOpen}
              title="No products yet"
              body="Add stock in Inventory so staff can click products onto the cart."
            />
          ) : !loading && catalogue.length === 0 ? (
            <EmptyState
              compact
              icon={PackageOpen}
              title="No matches"
              body="Try another filter or category."
            />
          ) : (
            <div
              ref={catalogueScrollRef}
              className="max-h-[min(52vh,440px)] overflow-y-auto overscroll-contain pr-0.5 sm:max-h-[min(58vh,480px)]"
            >
              <div
                style={{ height: virtualCatalogue.totalHeight, position: 'relative' }}
              >
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${catalogueCols}, minmax(0, 1fr))`,
                    transform: `translateY(${virtualCatalogue.offsetY}px)`,
                  }}
                >
                  {virtualCatalogue.visible.map((product) => (
                    <CatalogueTile
                      key={product.id}
                      product={product}
                      inCart={cartQtyById.get(product.id) || 0}
                      onAdd={(id, qty = 1) => addProduct(id, 'manual', qty)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="order-2 space-y-4 lg:sticky lg:top-6 lg:self-start">
        <div id="sell-cart-panel" className="nx-card scroll-mt-20 p-3.5 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-ink">
              Cart
              {cartItemCount ? ` · ${cartItemCount}` : ''}
            </h3>
            {cart.length > 0 ? (
              <button
                type="button"
                onClick={clearCart}
                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-brand-soft hover:text-ink"
              >
                <Eraser className="h-3.5 w-3.5" />
                Clear
              </button>
            ) : null}
          </div>

          {cart.length === 0 ? (
            <div className="mt-1 space-y-3">
              <EmptyState
                compact
                icon={Smartphone}
                title="Ready for the next customer"
                body={isPhone ? 'Tap Live scan or a catalogue tile.' : undefined}
              />
              {lastCart.length > 0 ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full rounded-2xl"
                  onClick={() => {
                    restoreCart(lastCart)
                    push('Same as last — adjust qty if needed', 'info')
                  }}
                >
                  Same as last · {lastCart.reduce((n, l) => n + l.quantity, 0)}{' '}
                  items
                </Button>
              ) : null}
            </div>
          ) : (
            <ul className="mt-3 max-h-[36vh] space-y-2 overflow-y-auto overscroll-contain pr-0.5 sm:mt-4 sm:max-h-[40vh] sm:space-y-2.5">
              {cart.map((line) => (
                <CartLineRow
                  key={line.product.id}
                  line={line}
                  onSetQty={setQty}
                  onRemove={removeLine}
                />
              ))}
            </ul>
          )}

          <div className="mt-4 space-y-2.5 border-t border-line pt-3.5 text-sm sm:mt-5 sm:space-y-3 sm:pt-4">
            {cartNeedsRx ? (
              <label className="block space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Rx / dispense note
                </span>
                <input
                  value={prescriptionNote}
                  onChange={(e) => setPrescriptionNote(e.target.value)}
                  placeholder="Script #, doctor, or counsel note"
                  className="nx-field w-full py-2"
                />
              </label>
            ) : null}
            <div className="flex justify-between text-ink-soft">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatZMW(subtotal)}</span>
            </div>
            {canDiscount ? (
              <div className="space-y-2">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-ink-soft">Discount</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="nx-field w-28 py-2 text-right"
                  />
                </label>
                {safeDiscount > 0 &&
                ((subtotal > 0 && safeDiscount / subtotal >= 0.2) ||
                  safeDiscount >= 50) ? (
                  <>
                    <input
                      type="text"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="Reason (Trust / Audit)"
                      className="nx-field w-full py-2 text-sm"
                      maxLength={200}
                    />
                    {managerPinConfigured ? (
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        value={managerPin}
                        onChange={(e) => setManagerPin(e.target.value)}
                        placeholder="Manager PIN"
                        className="nx-field w-full py-2 text-sm"
                        maxLength={6}
                      />
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
            <div className="flex justify-between text-lg font-bold text-ink">
              <span>Total</span>
              <span className="tabular-nums">{formatZMW(total)}</span>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-ink">Payment</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PAYMENT_METHODS.filter(
                (m) => m.value !== 'credit' || canCredit,
              ).map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value)}
                  className={`min-h-12 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                    paymentMethod === method.value
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-line text-ink-soft hover:bg-brand-soft/50'
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
            {paymentMethod === 'credit' ? (
              <p className="mt-2 text-xs text-ink-soft">
                Credit requires a customer with available limit. Audited with
                cashier + customer.
                {customerId
                  ? ` Available ${formatZMW(Math.max(0, customerCreditLimit - customerBalance))}.`
                  : ' Look up customer by phone first.'}
              </p>
            ) : null}
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
                  className="nx-field w-28 py-2 text-right"
                />
              </label>
              {tenderSuggestions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tenderSuggestions.map((amount, i) => {
                    const selected =
                      cashReceived !== '' &&
                      Math.abs(Number(cashReceived) - amount) < 0.001
                    const isExact = i === 0
                    return (
                      <button
                        key={`${amount}-${i}`}
                        type="button"
                        onClick={() => setCashReceived(amount.toFixed(2))}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold tabular-nums transition ${
                          selected
                            ? 'border-royal bg-royal text-white'
                            : 'border-line bg-card text-ink hover:border-royal/40'
                        }`}
                      >
                        {isExact ? 'Exact' : formatZMW(amount)}
                      </button>
                    )
                  })}
                </div>
              ) : null}
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
                  Tap Exact or a note — change prints on the receipt.
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

      {/* Sticky Complete — above bottom nav; extra padding on page so nothing is clipped */}
      {cart.length > 0 ? (
        <div className="nx-chrome-blur fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 border-t border-line/70 bg-card/95 px-3 py-2.5 shadow-[0_-10px_36px_rgba(15,23,42,0.12)] backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-lg items-center gap-3">
            <button
              type="button"
              className="min-h-12 min-w-0 flex-1 rounded-xl px-1 text-left"
              onClick={() => {
                document
                  .getElementById('sell-cart-panel')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              <p className="truncate text-xs text-ink-soft">
                {cartItemCount} item{cartItemCount === 1 ? '' : 's'}
                {' · '}
                {PAYMENT_METHODS.find((m) => m.value === paymentMethod)?.label ||
                  paymentMethod}
              </p>
              <p className="font-display text-xl font-bold tabular-nums text-ink">
                {formatZMW(total)}
              </p>
            </button>
            <Button
              type="button"
              className="min-h-12 shrink-0 rounded-2xl px-5 text-sm font-bold sm:min-h-14 sm:px-6 sm:text-base"
              disabled={busy}
              onClick={() => void completeSale()}
            >
              {busy ? 'Saving…' : 'Complete'}
            </Button>
          </div>
        </div>
      ) : null}

      {scanOpen && !completed ? (
        <Modal
          title="Live scan"
          wide
          fullScreen={isPhone}
          onClose={() => {
            keepScanOpenRef.current = false
            setScanOpen(false)
          }}
          headerAction={
            <button
              type="button"
              className="min-h-10 rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-deep"
              onClick={() => {
                keepScanOpenRef.current = false
                setScanOpen(false)
              }}
            >
              Done
            </button>
          }
          footer={
            <Button
              type="button"
              className="min-h-12 w-full rounded-2xl text-base font-bold shadow-md"
              onClick={() => {
                keepScanOpenRef.current = false
                setScanOpen(false)
              }}
            >
              Done
              {cartItemCount
                ? ` · ${cartItemCount} · ${formatZMW(total)}`
                : ''}
            </Button>
          }
        >
          <Suspense
            fallback={
              <div className="flex min-h-[16rem] items-center justify-center text-sm text-ink-soft">
                Opening camera…
              </div>
            }
          >
            <BarcodeScanner
              continuous
              statusMessage={
                scanStatus.tone === 'idle' ? undefined : scanStatus.message
              }
              statusTone={scanStatus.tone}
              cartHint={
                cartItemCount
                  ? `${cartItemCount} · ${formatZMW(total)}`
                  : undefined
              }
              onScan={(code, intent = 'add') => {
                handleLookup(code, 'scan', intent)
              }}
              onClose={() => {
                keepScanOpenRef.current = false
                setScanOpen(false)
              }}
            />
          </Suspense>
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
            cashierName={user?.fullName ?? null}
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
