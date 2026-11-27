import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, Minus, Plus, RotateCcw } from 'lucide-react'

type Accent = string

const CATALOGUE = [
  { id: 'pen', name: 'Blue pen', price: 5, sku: 'PEN-01' },
  { id: 'soap', name: 'Bar soap', price: 12, sku: 'SOAP-2' },
  { id: 'rice', name: 'Rice 2kg', price: 48, sku: 'RICE-2' },
  { id: 'oil', name: 'Cooking oil', price: 65, sku: 'OIL-1' },
] as const

function money(n: number) {
  return `K ${n.toFixed(n % 1 === 0 ? 0 : 2)}`
}

function Shell({
  title,
  eyebrow,
  children,
  footer,
}: {
  title: string
  eyebrow: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="nx-demo-shell">
      <div className="nx-demo-head">
        <div className="min-w-0">
          <p className="nx-demo-eye">{eyebrow}</p>
          <p className="nx-demo-title truncate">{title}</p>
        </div>
        <span className="nx-demo-live" aria-label="Interactive live demo">
          <span className="nx-live-dot" aria-hidden />
          Live
        </span>
      </div>
      <div className="nx-demo-body">{children}</div>
      {footer ? <div className="nx-demo-foot">{footer}</div> : null}
    </div>
  )
}

/** Soft live strip — product truths that tick, not fake shopper counts. */
export function LivePulseStrip() {
  const [now, setNow] = useState(() => new Date())
  const [lane, setLane] = useState(0)
  const [inView, setInView] = useState(true)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { rootMargin: '40px', threshold: 0.05 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Minute clock is enough — 1Hz was re-rendering the whole strip forever
    const clock = window.setInterval(() => setNow(new Date()), 30_000)
    if (reduced) return () => window.clearInterval(clock)
    const lanes = window.setInterval(() => setLane((n) => (n + 1) % 4), 4800)
    return () => {
      window.clearInterval(clock)
      window.clearInterval(lanes)
    }
  }, [inView])

  const clock = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  const highlights = [
    { label: 'Shop clock', value: clock },
    { label: 'Workspace', value: 'Till · stock · ledger · Command' },
    { label: 'Payments', value: 'Cash · MoMo · Airtel · card · credit' },
    { label: 'Floor link', value: 'Phone till · offline queue ready' },
  ]

  const active = highlights[lane] ?? highlights[0]

  const rail = [
    'Sell price comes from the server',
    'Complete drops stock immediately',
    'Void asks for a reason',
    'Opening float is tonight’s target',
    'Branches share one catalogue',
    'Manager PIN for sensitive actions',
    'Pharmacy unlocks lots & FEFO',
    'Wi‑Fi drop → queue, don’t retype',
  ]

  return (
    <div
      ref={rootRef}
      className="border-t"
      style={{
        borderColor: 'var(--nx-hairline)',
        background: 'var(--nx-deep)',
      }}
    >
      <div className="nx-wrap grid gap-4 py-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8 sm:py-6">
        <div className="flex items-center gap-2.5">
          <span className="nx-live-dot" aria-hidden />
          <div>
            <p className="nx-demo-eye">Live desk</p>
            <p className="nx-display text-sm font-semibold">
              The OS is built to stay on while the queue moves
            </p>
          </div>
        </div>
        <div
          className="nx-fade grid gap-1 rounded-xl border px-3.5 py-3 sm:text-right"
          key={active.label}
          style={{
            borderColor: 'var(--nx-hairline)',
            background: 'var(--nx-card)',
          }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: 'var(--nx-muted)' }}
          >
            {active.label}
          </p>
          <p className="nx-display text-sm font-semibold tabular-nums sm:text-base">
            {active.value}
          </p>
        </div>
      </div>
      <div
        className="overflow-hidden border-t"
        style={{
          borderColor: 'var(--nx-hairline)',
          background: 'rgba(0,0,0,0.12)',
        }}
        aria-hidden
      >
        <div
          className="nx-pulse-marquee gap-10 py-2.5 text-[11px] font-medium tracking-wide"
          style={{ color: 'var(--nx-muted)' }}
        >
          {[...rail, ...rail].map((item, i) => (
            <span key={`${item}-${i}`} className="inline-flex items-center gap-10">
              <span>{item}</span>
              <span style={{ opacity: 0.45 }}>·</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Morning open — type float, open shift, see OPEN. */
export function LiveOpenShiftDemo({ accent = '#21C77A' }: { accent?: Accent }) {
  const [float, setFloat] = useState('100')
  const [open, setOpen] = useState(false)
  const [pulse, setPulse] = useState(false)

  function openShift() {
    setOpen(true)
    setPulse(true)
    window.setTimeout(() => setPulse(false), 600)
  }

  return (
    <Shell
      eyebrow="Sell · morning"
      title="Open the cash session"
      footer="Try it: set the float, tap Open shift — that number is tonight’s target."
    >
      <div
        className={`rounded-xl border px-4 py-3 transition ${pulse ? 'nx-live-pop' : ''}`}
        style={{
          borderColor: open ? 'rgba(33,199,122,0.4)' : 'var(--nx-hairline)',
          background: open ? 'rgba(33,199,122,0.1)' : 'var(--nx-card)',
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--nx-muted)' }}
            >
              Shift
            </p>
            <p className="nx-display text-lg font-semibold">
              {open ? 'OPEN' : 'CLOSED'}
            </p>
          </div>
          <p className="text-right text-sm" style={{ color: 'var(--nx-ink-soft)' }}>
            {open ? (
              <>
                Float{' '}
                <span className="font-semibold" style={{ color: 'var(--nx-ink)' }}>
                  {money(Number(float) || 0)}
                </span>
              </>
            ) : (
              'No open shift'
            )}
          </p>
        </div>
      </div>

      {!open ? (
        <div className="mt-4 space-y-3">
          <label
            className="block text-xs font-semibold"
            style={{ color: 'var(--nx-ink-soft)' }}
          >
            Opening float
            <input
              type="number"
              min={0}
              value={float}
              onChange={(e) => setFloat(e.target.value)}
              className="nx-demo-input mt-1.5 text-base"
            />
          </label>
          <button
            type="button"
            onClick={openShift}
            className="nx-btn nx-btn-green inline-flex min-h-11 w-full"
            style={{ background: accent }}
          >
            Open shift
          </button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <p
            className="flex flex-1 items-center gap-2 text-sm"
            style={{ color: 'var(--nx-green)' }}
          >
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            Drawer is tracked. Ready for the first customer.
          </p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="nx-btn nx-btn-ghost min-h-10 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            Reset
          </button>
        </div>
      )}
    </Shell>
  )
}

/** Interactive till — tap products, pay, complete, see receipt. */
export function LiveTillDemo({ accent = '#21C77A' }: { accent?: Accent }) {
  const [qty, setQty] = useState<Record<string, number>>({})
  const [pay, setPay] = useState<'cash' | 'momo' | 'card'>('cash')
  const [exact, setExact] = useState(true)
  const [cashGiven, setCashGiven] = useState('')
  const [done, setDone] = useState(false)

  const lines = useMemo(
    () =>
      CATALOGUE.map((p) => ({
        ...p,
        quantity: qty[p.id] || 0,
        line: (qty[p.id] || 0) * p.price,
      })).filter((l) => l.quantity > 0),
    [qty],
  )
  const total = lines.reduce((s, l) => s + l.line, 0)
  const given = exact ? total : Number(cashGiven) || 0
  const change = pay === 'cash' ? Math.max(0, given - total) : 0

  function add(id: string, n = 1) {
    setDone(false)
    setQty((q) => ({ ...q, [id]: (q[id] || 0) + n }))
  }

  function complete() {
    if (total <= 0) return
    setDone(true)
  }

  function reset() {
    setQty({})
    setDone(false)
    setExact(true)
    setCashGiven('')
    setPay('cash')
  }

  return (
    <Shell
      eyebrow="Sell · live till"
      title="Tap a product · take payment · Complete"
      footer="Prices come from the catalogue — the till never invents a cheaper unit price."
    >
      {!done ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            {CATALOGUE.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => add(p.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  add(p.id, 5)
                }}
                className="nx-demo-tile active:scale-[0.98]"
              >
                <p
                  className="text-[10px] font-medium"
                  style={{ color: 'var(--nx-muted)' }}
                >
                  {p.sku}
                </p>
                <p className="mt-0.5 text-sm font-semibold">{p.name}</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--nx-green)' }}>
                  {money(p.price)}
                </p>
                {(qty[p.id] || 0) > 0 ? (
                  <p
                    className="mt-1 text-[11px] font-semibold"
                    style={{ color: 'var(--nx-ink-soft)' }}
                  >
                    ×{qty[p.id]} in cart
                  </p>
                ) : null}
              </button>
            ))}
          </div>

          <div className="nx-demo-panel mt-4">
            <div
              className="flex items-center justify-between text-xs"
              style={{ color: 'var(--nx-muted)' }}
            >
              <span>Cart</span>
              <span>{lines.length ? `${lines.length} lines` : 'Empty'}</span>
            </div>
            {lines.length ? (
              <ul className="mt-2 space-y-1.5">
                {lines.map((l) => (
                  <li
                    key={l.id}
                    className="flex justify-between gap-2 text-sm"
                    style={{ color: 'var(--nx-ink)' }}
                  >
                    <span>
                      {l.name}{' '}
                      <span style={{ color: 'var(--nx-muted)' }}>
                        ×{l.quantity}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">
                      {money(l.line)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm" style={{ color: 'var(--nx-muted)' }}>
                Tap a tile. Hold / right-click adds five.
              </p>
            )}
            <div
              className="mt-3 flex justify-between border-t pt-3 text-sm font-bold"
              style={{ borderColor: 'var(--nx-hairline)' }}
            >
              <span>Total</span>
              <span className="tabular-nums">{money(total)}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(
              [
                ['cash', 'Cash'],
                ['momo', 'MTN MoMo'],
                ['card', 'Card'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPay(id)}
                className={`min-h-9 rounded-lg px-3 text-xs font-semibold transition ${
                  pay === id ? '' : 'nx-btn-ghost border'
                }`}
                style={
                  pay === id
                    ? {
                        background: 'var(--nx-ink)',
                        color: 'var(--nx-page)',
                      }
                    : {
                        borderColor: 'var(--nx-hairline)',
                        color: 'var(--nx-ink-soft)',
                      }
                }
              >
                {label}
              </button>
            ))}
          </div>

          {pay === 'cash' && total > 0 ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setExact(true)
                  setCashGiven(String(total))
                }}
                className="min-h-9 rounded-lg px-3 text-xs font-semibold"
                style={
                  exact
                    ? {
                        background: 'rgba(33,199,122,0.18)',
                        color: 'var(--nx-green)',
                      }
                    : {
                        border: '1px solid var(--nx-hairline)',
                        color: 'var(--nx-ink-soft)',
                      }
                }
              >
                Exact
              </button>
              <label
                className="min-w-[7rem] flex-1 text-[11px] font-semibold"
                style={{ color: 'var(--nx-muted)' }}
              >
                Cash received
                <input
                  type="number"
                  value={exact ? String(total) : cashGiven}
                  onChange={(e) => {
                    setExact(false)
                    setCashGiven(e.target.value)
                  }}
                  className="nx-demo-input mt-1 py-2 text-sm"
                />
              </label>
              <p
                className="pb-2 text-xs"
                style={{ color: 'var(--nx-ink-soft)' }}
              >
                Change{' '}
                <span className="font-semibold" style={{ color: 'var(--nx-ink)' }}>
                  {money(change)}
                </span>
              </p>
            </div>
          ) : null}

          <button
            type="button"
            disabled={total <= 0}
            onClick={complete}
            className="nx-btn nx-btn-green mt-4 inline-flex min-h-11 w-full disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: accent }}
          >
            Complete
          </button>
        </>
      ) : (
        <div className="nx-live-pop space-y-3 text-center">
          <div
            className="mx-auto max-w-xs rounded-xl border px-4 py-5"
            style={{
              borderColor: 'var(--nx-hairline)',
              background: '#fff',
              color: '#0f172a',
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Sale receipt
            </p>
            <p className="nx-display mt-1 text-xl font-bold">Blessing Mart</p>
            <p className="mt-1 text-xs text-slate-500">Tel 097 000 0000</p>
            <ul className="mt-4 space-y-1 border-t border-slate-200 pt-3 text-left text-sm">
              {lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-2">
                  <span>
                    {l.name} ×{l.quantity}
                  </span>
                  <span className="font-semibold">{money(l.line)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t-2 border-slate-900 pt-2 text-sm font-bold">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
            {pay === 'cash' ? (
              <div className="mt-2 rounded-lg bg-emerald-50 px-2.5 py-2 text-left text-xs text-emerald-900">
                <div className="flex justify-between">
                  <span>Cash received</span>
                  <span className="font-semibold">{money(given)}</span>
                </div>
                <div className="mt-1 flex justify-between font-bold">
                  <span>Change</span>
                  <span>{money(change)}</span>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500 capitalize">
                Paid · {pay === 'momo' ? 'MTN MoMo' : pay}
              </p>
            )}
            <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Powered by NEXORA
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="nx-btn nx-btn-ghost min-h-10 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            New sale
          </button>
        </div>
      )}
    </Shell>
  )
}

/** Stock that moves when you sell or receive. */
export function LiveStockDemo({ accent = '#21C77A' }: { accent?: Accent }) {
  const [stock, setStock] = useState({
    pen: 42,
    soap: 18,
    rice: 9,
    oil: 4,
  })
  const [flash, setFlash] = useState<string | null>(null)
  const low = Object.entries(stock).filter(([, q]) => q <= 5)

  function sellOne(id: keyof typeof stock) {
    setStock((s) => ({ ...s, [id]: Math.max(0, s[id] - 1) }))
    setFlash(`${id}-sell`)
    window.setTimeout(() => setFlash(null), 400)
  }

  function receive(id: keyof typeof stock, n = 10) {
    setStock((s) => ({ ...s, [id]: s[id] + n }))
    setFlash(`${id}-recv`)
    window.setTimeout(() => setFlash(null), 400)
  }

  const labels: Record<keyof typeof stock, string> = {
    pen: 'Blue pen',
    soap: 'Bar soap',
    rice: 'Rice 2kg',
    oil: 'Cooking oil',
  }

  return (
    <Shell
      eyebrow="Inventory · live"
      title="Shelf counts move with the till"
      footer="Tap −1 sale to drop qty. Receive bumps the shelf. Low stock lights up at 5."
    >
      <ul className="space-y-2">
        {(Object.keys(stock) as Array<keyof typeof stock>).map((id) => {
          const q = stock[id]
          const isLow = q <= 5
          return (
            <li
              key={id}
              className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 transition ${
                flash?.startsWith(id) ? 'nx-live-pop' : ''
              }`}
              style={{
                borderColor: isLow
                  ? 'rgba(245,158,11,0.35)'
                  : 'var(--nx-hairline)',
                background: isLow
                  ? 'rgba(245,158,11,0.1)'
                  : 'var(--nx-card)',
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{labels[id]}</p>
                <p className="text-[11px]" style={{ color: 'var(--nx-muted)' }}>
                  On hand{' '}
                  <span
                    className="font-bold tabular-nums"
                    style={{
                      color: isLow ? '#fbbf24' : 'var(--nx-green)',
                    }}
                  >
                    {q}
                  </span>
                  {isLow ? ' · low' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => sellOne(id)}
                disabled={q <= 0}
                className="nx-btn nx-btn-ghost min-h-9 px-2.5 text-xs disabled:opacity-40"
              >
                <Minus className="h-3.5 w-3.5" aria-hidden />
                Sale
              </button>
              <button
                type="button"
                onClick={() => receive(id)}
                className="nx-btn nx-btn-green min-h-9 px-2.5 text-xs"
                style={{ background: accent }}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Receive
              </button>
            </li>
          )
        })}
      </ul>
      {low.length ? (
        <p className="mt-3 text-xs" style={{ color: '#fbbf24' }}>
          {low.length} item{low.length > 1 ? 's' : ''} at or under the low-stock
          line — Pulse would suggest a reorder.
        </p>
      ) : (
        <p className="mt-3 text-xs" style={{ color: 'var(--nx-muted)' }}>
          All lines above the warning threshold.
        </p>
      )}
    </Shell>
  )
}

/** Command desk — animated KPIs + expandable leaks. */
export function LiveCommandDemo({ accent = '#21C77A' }: { accent?: Accent }) {
  const [leak, setLeak] = useState<string | null>('below-cost')
  const [tick, setTick] = useState(0)
  const [active, setActive] = useState(true)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => setActive(Boolean(entry?.isIntersecting)),
      { rootMargin: '60px', threshold: 0.05 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!active) return
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const id = window.setInterval(() => setTick((t) => t + 1), 3200)
    return () => window.clearInterval(id)
  }, [active])

  const revenue = 18420 + (tick % 5) * 35
  const tickets = 86 + (tick % 4)
  const voids = 2.4 + (tick % 3) * 0.1

  const leaks = [
    {
      id: 'below-cost',
      level: 'Critical',
      title: 'Sold below cost',
      detail:
        'Cooking oil rang at K 55 while cost is K 58. Fix the price or ask who discounted.',
      amount: 'K 48 at risk',
    },
    {
      id: 'voids',
      level: 'Watch',
      title: 'Void spike · Chanda',
      detail:
        'Three voids after cash sales this afternoon. Open Ledger filtered to that cashier.',
      amount: '3 voids',
    },
    {
      id: 'discount',
      level: 'Watch',
      title: 'Discount % high · Main',
      detail:
        'Main branch discount rate is above the other doors for the same week.',
      amount: '8.2%',
    },
  ]

  return (
    <div ref={rootRef}>
    <Shell
      eyebrow="Command · live"
      title="Money in. Leaks out. Tap a card."
      footer="These numbers animate gently so the desk feels alive — same idea as the real Command screen."
    >
      <div
        className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: 'var(--nx-green)' }}
      >
        <span className="nx-live-dot" aria-hidden />
        Desk updating
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Live today', value: money(revenue) },
          { label: 'Tickets', value: String(tickets) },
          { label: 'Void %', value: `${voids.toFixed(1)}%` },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border px-2.5 py-3"
            style={{
              borderColor: 'var(--nx-hairline)',
              background: 'var(--nx-card)',
            }}
          >
            <p
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--nx-muted)' }}
            >
              {kpi.label}
            </p>
            <p
              key={`${kpi.label}-${kpi.value}`}
              className="nx-display nx-fade mt-1 text-sm font-bold tabular-nums sm:text-base"
            >
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      <p
        className="mt-4 text-[10px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: 'var(--nx-muted)' }}
      >
        Money leaks
      </p>
      <ul className="mt-2 space-y-2">
        {leaks.map((item) => {
          const open = leak === item.id
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setLeak(open ? null : item.id)}
                className="flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition"
                style={{
                  borderColor: open ? accent : 'var(--nx-hairline)',
                  background: 'var(--nx-card)',
                }}
              >
                <span>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      color:
                        item.level === 'Critical'
                          ? '#fbbf24'
                          : 'var(--nx-muted)',
                    }}
                  >
                    {item.level}
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold">
                    {item.title}
                  </span>
                </span>
                <span
                  className="shrink-0 text-xs font-semibold"
                  style={{ color: 'var(--nx-green)' }}
                >
                  {item.amount}
                </span>
              </button>
              {open ? (
                <p
                  className="nx-fade mt-2 px-1 text-xs leading-relaxed"
                  style={{ color: 'var(--nx-ink-soft)' }}
                >
                  {item.detail}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
    </Shell>
    </div>
  )
}

/** Phone chrome with a tiny interactive till. */
export function LivePhoneTillDemo({ accent = '#21C77A' }: { accent?: Accent }) {
  const [lines, setLines] = useState<{ soap: number; pen: number }>({
    soap: 0,
    pen: 0,
  })
  const [tab, setTab] = useState<'sell' | 'stock' | 'sales'>('sell')
  const count = lines.soap + lines.pen
  const total = lines.soap * 12 + lines.pen * 5

  return (
    <div className="mx-auto w-full max-w-[280px]">
      <div className="nx-phone-frame">
        <div
          className="flex justify-center py-2"
          style={{ background: 'rgba(0,0,0,0.25)' }}
        >
          <span
            className="h-1.5 w-16 rounded-full"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          />
        </div>
        <div className="px-3 pb-2 pt-1">
          <p className="nx-demo-eye text-center">Phone till · live</p>
          <p className="nx-display text-center text-sm font-semibold">
            Blessing Mart
          </p>
        </div>

        <div className="min-h-[320px] px-3 pb-3">
          {tab === 'sell' ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setLines((l) => ({ ...l, soap: l.soap + 1 }))}
                className="nx-demo-tile w-full px-3 py-4 active:scale-[0.98]"
              >
                <p className="text-sm font-semibold">Bar soap</p>
                <p className="text-xs" style={{ color: 'var(--nx-green)' }}>
                  Tap to add · {money(12)}
                </p>
              </button>
              <button
                type="button"
                onClick={() => setLines((l) => ({ ...l, pen: l.pen + 1 }))}
                className="nx-demo-tile w-full px-3 py-4 active:scale-[0.98]"
              >
                <p className="text-sm font-semibold">Blue pen</p>
                <p className="text-xs" style={{ color: 'var(--nx-green)' }}>
                  Tap to add · {money(5)}
                </p>
              </button>
              <div className="nx-demo-panel">
                <div className="flex justify-between text-sm">
                  <span>{count} in cart</span>
                  <span className="font-bold tabular-nums">{money(total)}</span>
                </div>
                <button
                  type="button"
                  disabled={count <= 0}
                  onClick={() => setLines({ soap: 0, pen: 0 })}
                  className="nx-btn nx-btn-green mt-2 inline-flex min-h-11 w-full disabled:opacity-40"
                  style={{ background: accent }}
                >
                  Complete
                </button>
              </div>
            </div>
          ) : null}
          {tab === 'stock' ? (
            <div
              className="space-y-2 pt-2 text-sm"
              style={{ color: 'var(--nx-ink-soft)' }}
            >
              <p
                className="rounded-xl border px-3 py-3"
                style={{ borderColor: 'var(--nx-hairline)' }}
              >
                Rice 2kg · <span style={{ color: '#fbbf24' }}>9 left</span>
              </p>
              <p
                className="rounded-xl border px-3 py-3"
                style={{ borderColor: 'var(--nx-hairline)' }}
              >
                Oil · <span style={{ color: '#fbbf24' }}>4 left · low</span>
              </p>
              <p className="text-xs" style={{ color: 'var(--nx-muted)' }}>
                Same catalogue the laptop sells from.
              </p>
            </div>
          ) : null}
          {tab === 'sales' ? (
            <div
              className="space-y-2 pt-2 text-sm"
              style={{ color: 'var(--nx-ink-soft)' }}
            >
              <p
                className="rounded-xl border px-3 py-3"
                style={{ borderColor: 'var(--nx-hairline)' }}
              >
                Today · 14 tickets · {money(1260)}
              </p>
              <p className="text-xs" style={{ color: 'var(--nx-muted)' }}>
                Ledger stays one thumb away after Complete.
              </p>
            </div>
          ) : null}
        </div>

        <div
          className="grid grid-cols-3 border-t"
          style={{
            borderColor: 'var(--nx-hairline)',
            background: 'rgba(0,0,0,0.18)',
          }}
        >
          {(
            [
              ['sell', 'Sell'],
              ['stock', 'Stock'],
              ['sales', 'Sales'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className="min-h-12 text-xs font-semibold"
              style={{
                color: tab === id ? 'var(--nx-green)' : 'var(--nx-muted)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p
        className="mt-3 text-center text-xs"
        style={{ color: 'var(--nx-muted)' }}
      >
        Tap products, switch tabs — the phone till is meant to be used, not just
        shown.
      </p>
    </div>
  )
}

export function DayLiveStage({
  stepId,
  accent,
}: {
  stepId: 'open' | 'sell' | 'stock' | 'watch'
  accent: string
}) {
  if (stepId === 'open') return <LiveOpenShiftDemo accent={accent} />
  if (stepId === 'sell') return <LiveTillDemo accent={accent} />
  if (stepId === 'stock') return <LiveStockDemo accent={accent} />
  return <LiveCommandDemo accent={accent} />
}
