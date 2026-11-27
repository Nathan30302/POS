import { useEffect, useId, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowRight,
  ChevronDown,
  Menu,
  Moon,
  Sun,
  X,
} from 'lucide-react'
import { NexoraMark } from '@/components/NexoraMark'
import { RealBusinessVideo } from '@/components/RealBusinessVideo'
import {
  DayLiveStage,
  LiveCommandDemo,
  LivePhoneTillDemo,
  LivePulseStrip,
  LiveStockDemo,
  LiveTillDemo,
} from '@/components/landing/LiveDemos'
import { useAuth } from '@/context/AuthContext'
import {
  getLandingLook,
  landingHeadline,
  type LandingLook,
} from '@/lib/landingLook'
import { businessHomePath } from '@/lib/permissions'
import '@/styles/landing.css'

const THEME_KEY = 'nexora-landing-theme'

type LandingTheme = 'dark' | 'light'

function getLandingTheme(): LandingTheme {
  try {
    const v = localStorage.getItem(THEME_KEY)
    return v === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

function setLandingTheme(theme: LandingTheme) {
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* ignore */
  }
}

const navAnchors = [
  { href: '#home', label: 'Home' },
  { href: '#how', label: 'How it works' },
  { href: '#why', label: 'Why NEXORA' },
  { href: '#trade', label: 'For your trade' },
  { href: '#faq', label: 'FAQ' },
  { href: '#contact', label: 'Contact' },
] as const

const fits = [
  {
    title: 'One busy counter',
    body: 'A shop that has outgrown a notebook. Live catalogue, barcode or tap-to-add, cash and mobile money, and a receipt that carries the shop name.',
  },
  {
    title: 'Several doors',
    body: 'Switch branches, compare void and discount rates, and transfer stock to the counter that is actually short — one login, not a stack of spreadsheets.',
  },
  {
    title: 'Pharmacy or fresh food',
    body: 'The business type you register unlocks the extra screens. Pharmacies get lots, expiry, FEFO, and Rx notes. Grocery gets perishable lots. Retail stays lean.',
  },
  {
    title: 'A team, not only the owner',
    body: 'Invite cashiers and managers. Permissions decide who may sell, void, open Pulse, or manage the team. A manager PIN guards the sensitive actions.',
  },
]

const day = [
  {
    id: 'open',
    index: '01',
    title: 'Open the shift',
    body: 'Morning starts on Sell. Type the opening float — the cash already in the drawer — and tap Open shift. That figure is the target when the drawer is counted at close. Owners can read Command once before the first customer.',
    points: [
      'Opening float is the starting cash, not the day’s sales.',
      'Closed means the cash session has not started.',
      'The same Sell screen is the till on a laptop and on a phone.',
    ],
    caption: 'Try it live — set the float and open the shift.',
  },
  {
    id: 'sell',
    index: '02',
    title: 'Take the sale',
    body: 'Scan a barcode, type a name and press Enter, or tap a catalogue tile. Hold a tile to add five. Choose Cash, MTN MoMo, Airtel Money, card, or credit, then tap Complete. The price comes from the server, so the till cannot invent a cheaper one.',
    points: [
      'USB gun, live camera, or the search box — same cart.',
      'Cash received prints the change. Exact means they paid the total.',
      'A large discount needs permission and a written reason.',
    ],
    caption: 'Try it live — tap products, pick payment, Complete.',
  },
  {
    id: 'stock',
    index: '03',
    title: 'Stock moves with the sale',
    body: 'Complete drops quantity immediately. When a delivery arrives, Receive it from Inventory — history keeps the movement. Low stock warns you before the shelf is empty. Pharmacies and grocers track lots and expiry; transfers move goods between branches.',
    points: [
      'Stock at cost is what you paid. Stock at selling is list price.',
      'Search by name, barcode, or SKU. Import a catalogue by CSV.',
      'FEFO dispensing and Rx notes appear only for pharmacy shops.',
    ],
    caption: 'Try it live — sell drops qty, Receive puts stock back.',
  },
  {
    id: 'watch',
    index: '04',
    title: 'Read the day before you lock up',
    body: 'Close the shift and count the drawer. Command shows revenue, gross profit, live tickets, and each branch’s void and discount rate. Money leaks flag profit walking out — selling below cost is marked critical. Trust points at the cashier or branch that does not look like the others, and opens their Ledger.',
    points: [
      'A void always asks for a reason and puts the stock back.',
      'Audit records who changed what.',
      'Pulse adds health, reorder ideas, and a plain-language question.',
    ],
    caption: 'Try it live — tap a money-leak card on the owner desk.',
  },
] as const

const journey = [
  {
    n: '01',
    title: 'Create your shop',
    body: 'Sign up with the business type that matches your counter. Retail stays lean; pharmacy and grocery unlock lots when goods can expire.',
  },
  {
    n: '02',
    title: 'Get approved',
    body: 'A NEXORA admin confirms the shop before the till goes live — so every live workspace is intentional, not abandoned sandboxes.',
  },
  {
    n: '03',
    title: 'Open the shift',
    body: 'Type the opening float. That number is tonight’s target when you count the drawer.',
  },
  {
    n: '04',
    title: 'Sell · stock · Command',
    body: 'Complete drops stock. Deliveries raise it. Command and Trust keep voids, discounts, and leaks visible.',
  },
] as const

const industries = [
  {
    title: 'Retail',
    body: 'General shops that need a fast sell, clean counts, and customer loyalty. Lot and expiry screens stay out of the way.',
    specs: [
      { k: 'Modules', v: 'Sell · Inventory · Customers' },
      { k: 'Lots', v: 'Off by default' },
      { k: 'Focus', v: 'Speed + loyalty' },
    ],
  },
  {
    title: 'Pharmacy',
    body: 'Lots, expiry warnings, FEFO dispensing, and Rx notes — only when the business type is pharmacy, chemist, or a clinic dispensary.',
    specs: [
      { k: 'Modules', v: 'Lots · FEFO · Rx notes' },
      { k: 'Expiry', v: 'Warned on dispense' },
      { k: 'Focus', v: 'Compliance + speed' },
    ],
  },
  {
    title: 'Grocery',
    body: 'Perishable lots and expiry alerts for fresh goods, with the same sell speed as a corner counter.',
    specs: [
      { k: 'Modules', v: 'Perishable lots · Transfers' },
      { k: 'Expiry', v: 'Fresh-goods alerts' },
      { k: 'Focus', v: 'Shelf life + volume' },
    ],
  },
  {
    title: 'Stationery',
    body: 'Catalogue presets, barcode labels, branches, audit, and Pulse. The integrity stack, without pharmacy fields you will never use.',
    specs: [
      { k: 'Modules', v: 'Labels · Catalogue · Team' },
      { k: 'Lots', v: 'Not required' },
      { k: 'Focus', v: 'SKU density' },
    ],
  },
]

const experienceBeats = [
  {
    title: 'The first Complete',
    body: 'Scan, take MoMo or cash, finish. The receipt carries the shop name — not a generic till slip.',
  },
  {
    title: 'The first stock drop',
    body: 'Quantity falls with the sale. The next cashier sells from the same number the storeroom just lost.',
  },
  {
    title: 'The first leak you catch',
    body: 'Command flags selling below cost or a void spike. You open Ledger already filtered — not a rumour at month-end.',
  },
]

const stockFacts = [
  'Add a product with name, sell price, cost, and barcode — or bring a catalogue in by CSV.',
  'Receive a delivery and the on-hand count and history update together.',
  'Low-stock warnings fire at the threshold you set. Pulse turns the same signal into a reorder list.',
  'Pharmacy and chemist shops track lots, expiry, and FEFO, with Rx notes on the dispense.',
  'Grocery shops track perishable lots without taking on the pharmacy screens.',
  'Transfers move quantity from one branch to another. Conflicts surface when two counts disagree.',
]

const trustFacts = [
  {
    title: 'Ledger',
    body: 'Every finished ticket. Filter today, seven days, or thirty. Search a cashier. Reprint, or void with a reason. A void right after a large cash sale is visible, not a rumour.',
  },
  {
    title: 'Money leaks',
    body: 'Command lists where profit is escaping. Selling below cost is critical — fix the price or ask who discounted. The amount at risk sits next to the signal.',
  },
  {
    title: 'Trust',
    body: 'Cashiers and branches are compared on void percent and discount percent. Open the person who stands apart and you land in their Ledger, already filtered.',
  },
  {
    title: 'Audit and Pulse',
    body: 'Audit is the chain of who did what. Pulse is the advisor beside the desk: shop health, the same leaks, what to reorder, and a question in ordinary language.',
  },
]

const productTruths = [
  {
    title: 'Prices are not invented at the till',
    body: 'Unit sell price comes from the server catalogue. A real discount is a separate, permission-gated field with a written reason.',
  },
  {
    title: 'Every void leaves a trail',
    body: 'A void asks why, puts stock back, and stays visible in Ledger next to the original ticket — not a silent delete.',
  },
  {
    title: 'The drawer has a starting number',
    body: 'Opening float is typed once at shift open. Close compares that target to the counted drawer so variance is a fact, not a feeling.',
  },
  {
    title: 'Offline does not mean double entry',
    body: 'A mid-sale network drop can queue the ticket on the device. When the link returns, stock catches up. Conflicts surface for a manager — cashiers do not retype the sale.',
  },
  {
    title: 'Industry modules unlock, they do not clutter',
    body: 'Pharmacy lots, FEFO, and Rx notes appear only for the business types that need them. Stationery never clicks past expiry to reach Sell.',
  },
  {
    title: 'Head office is a view, not a second SKU',
    body: 'Switch branch, transfer stock, compare void and discount rates on Command. One workspace, one set of permissions per person.',
  },
]

type FaqCat = 'product' | 'day' | 'team' | 'start'

const faqs: Array<{ cat: FaqCat; q: string; a: string }> = [
  {
    cat: 'product',
    q: 'What is NEXORA?',
    a: 'NEXORA is a shop operating system — till, stock, ledger, customers, expenses, and an owner desk in one workspace. Cashiers and managers share a live catalogue, so a sale on the floor and a count in the back stay on the same numbers.',
  },
  {
    cat: 'product',
    q: 'Who is it for?',
    a: 'Busy counters that have outgrown a notebook or a disconnected spreadsheet: single shops, multi-branch retail, pharmacies, grocery, and specialty trades. The business type you register unlocks only the screens that trade needs.',
  },
  {
    cat: 'product',
    q: 'Does it work with more than one branch?',
    a: 'Yes. Switch the active branch, compare void and discount rates on Command, and move goods with Transfers. Head office is a view inside the same login — not a second product to buy.',
  },
  {
    cat: 'day',
    q: 'Can I sell from a phone if the laptop is the till?',
    a: 'Sell can show a QR. A phone on the same shop Wi‑Fi opens that cart and scans with the camera while the laptop stays the till. Complete stays stuck to the bottom of the phone for one-thumb checkout.',
  },
  {
    cat: 'day',
    q: 'What happens when Wi‑Fi drops mid-sale?',
    a: 'The ticket can queue on the device. Do not type it a second time. When the connection returns, the queue syncs and stock catches up. Conflicts appear only when two offline actions fight over the same stock — a manager resolves those.',
  },
  {
    cat: 'day',
    q: 'How do inventory and sales stay connected?',
    a: 'Complete drops quantity immediately. Receive raises it when a delivery arrives. History keeps every movement. Low stock warns before the shelf is empty; Pulse can turn the same signal into a reorder list.',
  },
  {
    cat: 'team',
    q: 'How do roles and permissions work?',
    a: 'Owners invite staff and assign a role plus permissions. Cashiers often get Sell only. Managers may get Ledger, void, discounts, and stock. A manager PIN guards sensitive actions. Each login opens only the tools it is allowed to use — including How to use.',
  },
  {
    cat: 'team',
    q: 'Is my shop data safe?',
    a: 'Sessions use signed-in access with role permissions. Sensitive actions leave an audit trail. We do not invent prices at the till — sell price comes from the server. Treat staff logins like keys: invite carefully, rotate passwords, and use manager PIN for voids and large discounts.',
  },
  {
    cat: 'start',
    q: 'How do I get started?',
    a: 'Create a shop on signup, then a NEXORA admin approves it before the till goes live. After approval, sign in, set the shop name on receipts, invite staff, and open Sell. The public How to use guide walks a full day on the real screens — and you can listen to it.',
  },
  {
    cat: 'start',
    q: 'What does it cost?',
    a: 'There is no public price list on this page. Create a shop to start onboarding, or sign in if you already have access. A platform admin confirms the shop before live selling.',
  },
]

const faqCats: Array<{ id: FaqCat | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'product', label: 'Product' },
  { id: 'day', label: 'Shop day' },
  { id: 'team', label: 'Team & trust' },
  { id: 'start', label: 'Getting started' },
]

function LandingFaq() {
  const baseId = useId()
  const [open, setOpen] = useState<number | null>(0)
  const [cat, setCat] = useState<FaqCat | 'all'>('all')
  const list = cat === 'all' ? faqs : faqs.filter((f) => f.cat === cat)

  useEffect(() => {
    setOpen(0)
  }, [cat])

  return (
    <section
      id="faq"
      className="nx-section nx-surface-deep"
      aria-labelledby={`${baseId}-heading`}
    >
      <div className="nx-wrap">
        <p className="nx-eyebrow">Frequently asked</p>
        <h2 id={`${baseId}-heading`} className="nx-h2">
          Straight answers before you open the counter.
        </h2>
        <p className="nx-lede">
          What NEXORA is, who it fits, and how a normal shop day runs. Expand a
          question — or open How to use for the full click-by-click guide.
        </p>

        <div className="nx-faq-cats" role="tablist" aria-label="FAQ categories">
          {faqCats.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={cat === c.id}
              data-active={cat === c.id}
              className="nx-chip"
              onClick={() => setCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="nx-faq-list">
          {list.map((item, i) => {
            const panelId = `${baseId}-panel-${i}`
            const buttonId = `${baseId}-btn-${i}`
            const expanded = open === i
            return (
              <div key={item.q} className="nx-faq-item">
                <h3>
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpen(expanded ? null : i)}
                    className="nx-faq-q"
                  >
                    <span>{item.q}</span>
                    <ChevronDown className="nx-faq-chevron h-5 w-5" aria-hidden />
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!expanded}
                  className="nx-faq-a"
                >
                  {expanded ? <p>{item.a}</p> : null}
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-10 text-sm" style={{ color: 'var(--nx-ink-faint)' }}>
          Still learning the screens?{' '}
          <Link
            to="/guide"
            className="font-semibold underline-offset-4 hover:underline"
            style={{ color: 'var(--nx-blue)' }}
          >
            Open How to use
          </Link>
          .
        </p>
      </div>
    </section>
  )
}

export function LandingPage() {
  const { user, loading } = useAuth()
  const [look, setLook] = useState<LandingLook>(() => getLandingLook())
  const [theme, setTheme] = useState<LandingTheme>(() => getLandingTheme())
  const [menuOpen, setMenuOpen] = useState(false)
  const [dayId, setDayId] = useState<(typeof day)[number]['id']>('open')
  const [dayPaused, setDayPaused] = useState(false)
  const [tradeId, setTradeId] = useState<(typeof industries)[number]['title']>(
    'Retail',
  )

  useEffect(() => {
    setLook(getLandingLook())
    const sync = () => setLook(getLandingLook())
    window.addEventListener('storage', sync)
    window.addEventListener('nexora-prefs', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('nexora-prefs', sync)
    }
  }, [])

  useEffect(() => {
    if (dayPaused) return
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const order = day.map((d) => d.id)
    const id = window.setInterval(() => {
      setDayId((current) => {
        const i = order.indexOf(current)
        return order[(i + 1) % order.length] ?? 'open'
      })
    }, 9000)
    return () => window.clearInterval(id)
  }, [dayPaused])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  if (!loading && user) {
    return (
      <Navigate
        to={
          user.kind === 'platform'
            ? '/platform'
            : businessHomePath(user.permissions, user.role)
        }
        replace
      />
    )
  }

  const copy = landingHeadline(look.tone)
  const useVideo = look.background === 'video'
  const useMinimal = look.background === 'minimal'
  const step = day.find((item) => item.id === dayId) ?? day[0]
  const accent = '#21C77A'
  const themeClass =
    theme === 'light' ? 'nx-landing nx-landing--light' : 'nx-landing'

  function toggleTheme() {
    const next: LandingTheme = theme === 'dark' ? 'light' : 'dark'
    setLandingTheme(next)
    setTheme(next)
  }

  return (
    <div className={`${themeClass} relative min-h-screen overflow-x-hidden`}>
      <header className="nx-nav">
        <div className="nx-nav-inner">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2"
            aria-label="NEXORA home"
          >
            <NexoraMark className="h-8 w-8 sm:h-9 sm:w-9" />
            <span className="nx-display hidden text-[0.95rem] font-extrabold tracking-[-0.04em] min-[380px]:inline sm:text-lg">
              NEXORA
            </span>
          </Link>

          <nav className="nx-nav-center" aria-label="Sections">
            {navAnchors.map((a) => (
              <a key={a.href} href={a.href} className="nx-nav-link">
                {a.label}
              </a>
            ))}
          </nav>

          <div className="nx-nav-actions">
            <button
              type="button"
              className="nx-theme-btn"
              onClick={toggleTheme}
              aria-label={
                theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
              }
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" aria-hidden />
              ) : (
                <Moon className="h-4 w-4" aria-hidden />
              )}
            </button>
            <Link
              to="/login"
              className="nx-btn nx-btn-ghost hidden sm:inline-flex"
            >
              Sign in
            </Link>
            <Link to="/signup" className="nx-btn nx-btn-green">
              Create shop
            </Link>
            <button
              type="button"
              className="nx-theme-btn nx-menu-btn"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? (
                <X className="h-4 w-4" aria-hidden />
              ) : (
                <Menu className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="nx-drawer" data-open={menuOpen}>
        <button
          type="button"
          className="nx-drawer-backdrop"
          aria-label="Close menu"
          tabIndex={menuOpen ? 0 : -1}
          onClick={() => setMenuOpen(false)}
        />
        <div className="nx-drawer-panel" role="dialog" aria-label="Menu">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="nx-display text-sm font-bold tracking-tight">
              Menu
            </span>
            <button
              type="button"
              className="nx-theme-btn"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          {navAnchors.map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="nx-drawer-link"
              onClick={() => setMenuOpen(false)}
            >
              {a.label}
            </a>
          ))}
          <div className="mt-4 grid gap-2 border-t border-[var(--nx-hairline)] pt-4">
            <Link
              to="/guide"
              className="nx-btn nx-btn-ghost"
              onClick={() => setMenuOpen(false)}
            >
              How to use
            </Link>
            <Link
              to="/login"
              className="nx-btn nx-btn-ghost"
              onClick={() => setMenuOpen(false)}
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="nx-btn nx-btn-green"
              onClick={() => setMenuOpen(false)}
            >
              Create shop
            </Link>
          </div>
        </div>
      </div>

      <section id="home" className="nx-hero">
        {useVideo ? (
          <>
            <RealBusinessVideo clip="shop-floor" scrim="cinematic" />
            <div className="nx-hero-scrim" />
          </>
        ) : (
          <div
            className="nx-hero-atmosphere"
            style={
              useMinimal
                ? {
                    background:
                      theme === 'light'
                        ? 'linear-gradient(165deg, #f5f7fa 0%, #eef2f7 100%)'
                        : 'linear-gradient(165deg, #071426 0%, #0b1b30 55%, #071426 100%)',
                  }
                : undefined
            }
          />
        )}

        <div className="nx-hero-grid">
          <div className="nx-rise">
            <div className="nx-announce">
              <span className="nx-announce-dot">Shop OS</span>
              Sell · stock · trust — one workspace
            </div>

            <div className="nx-hero-brand">
              <NexoraMark className="mb-1 h-11 w-11 shrink-0 sm:h-14 sm:w-14 lg:h-16 lg:w-16" />
              <h1 className="nx-hero-name">NEXORA</h1>
            </div>
            <span className="nx-hero-rule" />

            <p className="nx-hero-headline">{copy.headline}</p>
            <p className="nx-hero-support">{copy.support}</p>

            <div className="nx-hero-ctas">
              <Link to="/signup" className="nx-btn nx-btn-green nx-btn-lg">
                Create shop
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link to="/login" className="nx-btn nx-btn-ghost nx-btn-lg">
                Sign in
              </Link>
              <Link to="/guide" className="nx-btn nx-btn-ghost nx-btn-lg">
                How to use
              </Link>
            </div>

            <p className="nx-trust-line">
              Self-serve signup · admin approval before live selling · receipt
              carries your shop name
            </p>
          </div>

          <div className="nx-hero-visual nx-rise-delay">
            <LiveTillDemo accent={accent} />
          </div>
        </div>
      </section>

      <LivePulseStrip />

      <div className="nx-stats" aria-label="Product truths">
        {[
          {
            k: 'Workspace',
            v: 'Till · stock · ledger · Command',
          },
          {
            k: 'Payments',
            v: 'Cash · MoMo · Airtel · card · credit',
          },
          {
            k: 'Integrity',
            v: 'Server prices · voids leave a trail',
          },
          {
            k: 'Floor link',
            v: 'Phone till · offline queue ready',
          },
        ].map((s) => (
          <div key={s.k} className="nx-stat">
            <p className="nx-stat-k">{s.k}</p>
            <p className="nx-stat-v">{s.v}</p>
          </div>
        ))}
      </div>

      <section id="trade" className="nx-section nx-surface-page">
        <div className="nx-wrap">
          <p className="nx-eyebrow nx-eyebrow-blue">Find your path</p>
          <h2 className="nx-h2">The OS changes with the shop you register.</h2>
          <p className="nx-lede">
            Business type is chosen at signup. It unlocks only the modules that
            trade needs — a stationery counter never clicks past pharmacy lots
            to reach Sell.
          </p>

          <div className="nx-path-grid">
            {industries.map((item) => (
              <button
                key={item.title}
                type="button"
                className="nx-path-card"
                data-active={tradeId === item.title}
                onClick={() => setTradeId(item.title)}
              >
                <h3 className="nx-path-title">{item.title}</h3>
                <p className="nx-path-body">{item.body}</p>
                <dl className="nx-path-specs">
                  {item.specs.map((spec) => (
                    <div key={spec.k} className="nx-path-spec">
                      <dt>{spec.k}</dt>
                      <dd>{spec.v}</dd>
                    </div>
                  ))}
                </dl>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="why" className="nx-section nx-surface-deep">
        <div className="nx-wrap">
          <p className="nx-eyebrow">{copy.whyEyebrow}</p>
          <h2 className="nx-h2">{copy.whyTitle}</h2>

          <div className="nx-why-grid">
            <div className="nx-why-copy">
              <p>
                NEXORA is a shop operating system for businesses that sell all
                day across Africa’s busy counters — and anywhere the queue does
                not wait for software. One workspace runs the till, the stock,
                the ledger, the customers, the expenses, and the owner desk.
                Cashiers and managers share a live catalogue.
              </p>
              <p>
                A new shop is created in self-serve signup, then a platform
                admin approves it before the till goes live. After that, the
                floor and the back office stay on the same numbers — including
                the hour the Wi‑Fi drops and the sale has to queue.
              </p>
              <p>
                Customers carry loyalty and credit. Expenses sit beside sales
                so the month is not only the till tape. Pulse answers a plain
                question about your own data. Command is where the owner looks
                when they are not on the floor.
              </p>
            </div>
            <div className="nx-why-list">
              {fits.map((item) => (
                <div key={item.title} className="nx-why-item">
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="nx-beats">
            <p className="nx-eyebrow">What people remember</p>
            <h3 className="nx-h2" style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.85rem)' }}>
              It is not a feature list. It is the first clean day.
            </h3>
            <div className="nx-beats-grid">
              {experienceBeats.map((beat, i) => (
                <div key={beat.title}>
                  <p className="nx-beat-n">{String(i + 1).padStart(2, '0')}</p>
                  <h4 className="nx-beat-title">{beat.title}</h4>
                  <p className="nx-beat-body">{beat.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="nx-section nx-surface-page">
        <div className="nx-wrap">
          <p className="nx-eyebrow">How it works</p>
          <h2 className="nx-h2">From signup to a shop day you can trust.</h2>
          <p className="nx-lede">
            Four moves to get live — then the same four moves every day on the
            floor. Pick a step and use the live panel, not a screenshot.
          </p>

          <ol className="mt-12 grid gap-8 border-t border-[var(--nx-hairline)] pt-8 sm:grid-cols-2 lg:grid-cols-4">
            {journey.map((item) => (
              <li key={item.n}>
                <p
                  className="nx-display text-sm font-semibold"
                  style={{ color: 'var(--nx-green)' }}
                >
                  {item.n}
                </p>
                <h3 className="nx-display mt-2 text-xl font-semibold tracking-tight">
                  {item.title}
                </h3>
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: 'var(--nx-ink-soft)' }}
                >
                  {item.body}
                </p>
              </li>
            ))}
          </ol>

          <div className="mt-16 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="nx-eyebrow">A shop day</p>
              <h3 className="nx-h2">Open, sell, stock, then look.</h3>
            </div>
            <p
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]"
              style={{ color: 'var(--nx-muted)' }}
            >
              <span className="nx-live-dot" aria-hidden />
              {dayPaused ? 'Paused on your step' : 'Auto-walking the day'}
            </p>
          </div>

          {!dayPaused ? (
            <div className="nx-day-progress" aria-hidden>
              <span key={step.id} />
            </div>
          ) : (
            <div className="nx-day-progress" aria-hidden>
              <span style={{ transform: 'scaleX(1)', animation: 'none' }} />
            </div>
          )}

          <div className="nx-day-layout">
            <div>
              <div
                role="tablist"
                aria-label="A shop day on NEXORA"
                className="nx-day-tabs"
              >
                {day.map((item) => {
                  const selected = item.id === step.id
                  return (
                    <button
                      key={item.id}
                      id={`day-tab-${item.id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      aria-controls="day-panel"
                      className="nx-day-tab"
                      onClick={() => {
                        setDayPaused(true)
                        setDayId(item.id)
                      }}
                    >
                      <span className="nx-day-index">{item.index}</span>
                      <span className="nx-day-title">{item.title}</span>
                    </button>
                  )
                })}
              </div>
              <div
                key={step.id}
                id="day-panel"
                role="tabpanel"
                aria-labelledby={`day-tab-${step.id}`}
                className="nx-fade mt-6 max-w-xl"
              >
                <p
                  className="text-sm leading-relaxed sm:text-base"
                  style={{ color: 'var(--nx-ink-soft)' }}
                >
                  {step.body}
                </p>
                <ul className="mt-5 space-y-2.5">
                  {step.points.map((point) => (
                    <li key={point} className="nx-bullet">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div
              className="nx-fade lg:sticky lg:top-24"
              key={step.id}
              onPointerDown={() => setDayPaused(true)}
            >
              <DayLiveStage stepId={step.id} accent={accent} />
              <p
                className="mt-3 text-xs tracking-wide"
                style={{ color: 'var(--nx-muted)' }}
              >
                {step.caption}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="experience" className="nx-section nx-surface-deep">
        <div className="nx-wrap">
          <p className="nx-eyebrow">Experience</p>
          <h2 className="nx-h2">The till, the shelf, and the owner desk.</h2>
          <p className="nx-lede">
            Interactive demos of the real loops — not marketing screenshots.
            Tap, sell, receive, and open a leak card.
          </p>

          <div className="nx-split mt-14">
            <div>
              <p className="nx-eyebrow">Sell</p>
              <h3 className="nx-h2" style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.1rem)' }}>
                The till is where the day is won.
              </h3>
              <p className="nx-lede">
                Most hours are spent here. Scan, pay, finish. Barcode gun,
                camera, or typed name — same cart. Prices come from the server.
              </p>
            </div>
            <LiveTillDemo accent={accent} />
          </div>

          <div className="nx-split mt-20">
            <div className="lg:order-2">
              <p className="nx-eyebrow nx-eyebrow-blue">Stock</p>
              <h3 className="nx-h2" style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.1rem)' }}>
                The shelf and the screen agree.
              </h3>
              <p className="nx-lede">
                A sale, a delivery, and a transfer all write the same stock
                figure the next cashier will sell from.
              </p>
              <ul className="nx-fact-list">
                {stockFacts.slice(0, 4).map((fact) => (
                  <li key={fact} className="nx-bullet">
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:order-1">
              <LiveStockDemo accent={accent} />
            </div>
          </div>

          <div className="nx-split mt-20">
            <div>
              <p className="nx-eyebrow">Trust and leaks</p>
              <h3 className="nx-h2" style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.1rem)' }}>
                Shrinkage stops being a surprise.
              </h3>
              <p className="nx-lede">
                Voids, discounts, and odd stock drops leave a trail. Tap the
                live leak cards — that is the same idea as Command.
              </p>
              <div className="mt-8 grid gap-6">
                {trustFacts.map((item) => (
                  <div key={item.title} className="nx-why-item">
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
            <LiveCommandDemo accent={accent} />
          </div>

          <div className="nx-split mt-20">
            <div>
              <p className="nx-eyebrow">Phone till and offline</p>
              <h3 className="nx-h2" style={{ fontSize: 'clamp(1.5rem, 2.8vw, 2.1rem)' }}>
                A phone on the counter. A sale that survives a dead network.
              </h3>
              <p className="nx-lede">
                Sell can show a QR. A phone on the same shop Wi‑Fi opens that
                cart and scans with the camera. If the network drops mid-sale,
                the ticket can queue — do not type it a second time.
              </p>
            </div>
            <LivePhoneTillDemo accent={accent} />
          </div>
        </div>
      </section>

      <section className="nx-atmosphere">
        <RealBusinessVideo clip="checkout" dim={0.62} />
        <div className="nx-atmosphere-copy">
          <p className="nx-eyebrow">On the floor</p>
          <h2 className="nx-h2">The queue does not wait for software.</h2>
          <p className="nx-lede">
            People are already at the belt. NEXORA is built for that minute:
            scan, pay, finish, next. The owner’s questions happen after the
            receipt, not in the middle of it.
          </p>
        </div>
      </section>

      <section className="nx-section nx-surface-page">
        <div className="nx-wrap">
          <p className="nx-eyebrow">Product truths</p>
          <h2 className="nx-h2">Credibility without invented reviews.</h2>
          <p className="nx-lede">
            No staged testimonials. These are behaviours the software already
            enforces on the floor — the same rules the live demos let you try.
          </p>
          <div className="nx-truth-grid">
            {productTruths.map((item) => (
              <div key={item.title} className="nx-truth-item">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LandingFaq />

      <section className="nx-section nx-surface-secondary">
        <div className="nx-wrap">
          <div className="nx-close">
            <div className="max-w-xl">
              <p className="nx-close-title">Open the counter.</p>
              <p className="nx-lede">
                Create a shop, then a NEXORA admin approves it. Sign in and
                Sell. The owner guide walks a full day on the real screens —
                and you can listen to it.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/guide" className="nx-btn nx-btn-ghost nx-btn-lg">
                How to use
              </Link>
              <Link to="/signup" className="nx-btn nx-btn-green nx-btn-lg">
                Create shop
              </Link>
              <Link to="/login" className="nx-btn nx-btn-blue nx-btn-lg">
                Sign in
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer id="contact" className="nx-footer">
        <div className="nx-wrap">
          <div className="nx-footer-grid">
            <div>
              <div className="flex items-center gap-2">
                <NexoraMark className="h-8 w-8" />
                <p className="nx-footer-brand">NEXORA</p>
              </div>
              <p className="nx-footer-blurb">
                Shop OS — sell, stock, and integrity for busy counters.
              </p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                <li>
                  <a href="#how">How it works</a>
                </li>
                <li>
                  <a href="#experience">Experience</a>
                </li>
                <li>
                  <a href="#trade">For your trade</a>
                </li>
                <li>
                  <a href="#faq">FAQ</a>
                </li>
              </ul>
            </div>
            <div>
              <h4>Get started</h4>
              <ul>
                <li>
                  <Link to="/signup">Create shop</Link>
                </li>
                <li>
                  <Link to="/login">Sign in</Link>
                </li>
                <li>
                  <Link to="/guide">How to use</Link>
                </li>
                <li>
                  <a href="/docs/NEXORA-for-business.pdf" download>
                    For business owners
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4>Contact</h4>
              <ul>
                <li>
                  <a href="mailto:hello@nexora.shop">hello@nexora.shop</a>
                </li>
                <li>
                  <a href="#home">Back to top</a>
                </li>
              </ul>
            </div>
          </div>
          <div className="nx-footer-bottom">
            <p>© {new Date().getFullYear()} NEXORA · Shop OS</p>
            <p className="mt-1">
              Floor footage: Pexels — Kiwi and Camera, Travel Oyo. Pexels
              License.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
