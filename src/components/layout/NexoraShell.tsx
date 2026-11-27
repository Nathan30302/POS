import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeftRight,
  BookOpen,
  Boxes,
  ClipboardList,
  Grid2X2,
  LayoutDashboard,
  LogOut,
  Moon,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  Store,
  Sun,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Pill,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AlertsInbox } from '@/components/AlertsInbox'
import { BranchSwitcher } from '@/components/BranchSwitcher'
import { LiveAmbient } from '@/components/LiveSkyScene'
import { NexoraMark } from '@/components/NexoraMark'
import { OnlineStatus } from '@/components/OnlineStatus'
import { SetupGuideBanner } from '@/components/SetupGuideBanner'
import { useAuth } from '@/context/AuthContext'
import { OfflineSyncProvider } from '@/context/OfflineSyncContext'
import {
  hasLotModule,
  lotNavLabel,
  modulesOf,
} from '@/lib/industry'
import {
  canSeeCommand,
  hasPermission,
  ROLE_LABELS,
} from '@/lib/permissions'
import {
  applyAllPreferences,
  getAmbientEnabled,
  getLiveAmbientVariant,
  getTheme,
  getThemeLabel,
  getThemePreference,
  isLiveTheme,
  isShopTheme,
  toggleTheme,
} from '@/lib/theme'
import type { Permission } from '@/lib/permissions'
import { prefetchRoute } from '@/lib/prefetchRoute'

type NavModule =
  | 'always'
  | 'sell'
  | 'inventory'
  | 'finance'
  | 'crm'
  | 'procurement'
  | 'intelligence'
  | 'employees'
  | 'labels'
  | 'transfers'
  | 'lots'

type NavLinkItem = {
  to: string
  label: string
  short?: string
  icon: typeof LayoutDashboard
  permission: Permission | null
  module: NavModule
}

const links: NavLinkItem[] = [
  { to: '/app/dashboard', label: 'Command', short: 'Command', icon: LayoutDashboard, permission: null, module: 'always' },
  { to: '/app/checkout', label: 'Sell', short: 'Sell', icon: Store, permission: 'sell', module: 'sell' },
  { to: '/app/products', label: 'Inventory', short: 'Stock', icon: Warehouse, permission: 'inventory', module: 'inventory' },
  { to: '/app/pharmacy', label: 'Pharmacy', icon: Pill, permission: 'inventory', module: 'lots' },
  { to: '/app/transfers', label: 'Transfers', icon: ArrowLeftRight, permission: 'transfer_request', module: 'transfers' },
  { to: '/app/purchasing', label: 'Purchasing', icon: ClipboardList, permission: 'inventory', module: 'procurement' },
  { to: '/app/suppliers', label: 'Suppliers', icon: Truck, permission: 'inventory', module: 'procurement' },
  { to: '/app/sales', label: 'Ledger', short: 'Sales', icon: Receipt, permission: 'ledger', module: 'always' },
  { to: '/app/expenses', label: 'Expenses', icon: Wallet, permission: 'expenses', module: 'finance' },
  { to: '/app/customers', label: 'Customers', icon: Users, permission: 'customers', module: 'crm' },
  { to: '/app/insights', label: 'Pulse', icon: Sparkles, permission: 'pulse', module: 'intelligence' },
  { to: '/app/barcodes', label: 'Labels', icon: Boxes, permission: 'labels', module: 'labels' },
  { to: '/app/team', label: 'Team', icon: Shield, permission: 'team', module: 'employees' },
  { to: '/app/audit', label: 'Audit', icon: ScrollText, permission: 'team', module: 'employees' },
  { to: '/app/conflicts', label: 'Conflicts', icon: AlertTriangle, permission: 'team', module: 'inventory' },
  { to: '/app/guide', label: 'How to use', short: 'Guide', icon: BookOpen, permission: null, module: 'always' },
  { to: '/app/settings', label: 'Settings', short: 'Setup', icon: Settings, permission: null, module: 'always' },
]

export function NexoraShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [theme, setTheme] = useState(getTheme())
  const [themePref, setThemePref] = useState(getThemePreference())
  const [liveOn, setLiveOn] = useState(isLiveTheme())
  const [ambientOn, setAmbientOn] = useState(getAmbientEnabled())
  const [now, setNow] = useState(() => new Date())
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    applyAllPreferences()
    setAmbientOn(getAmbientEnabled())
    setTheme(getTheme())
    setThemePref(getThemePreference())
    setLiveOn(isLiveTheme())
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(id)
  }, [])

  // Close the More sheet and scroll to top so modules open at the page head
  useEffect(() => {
    setMoreOpen(false)
    window.scrollTo(0, 0)
    const main = document.querySelector('main.nx-page')
    if (main instanceof HTMLElement) main.scrollTop = 0
  }, [location.pathname])

  useEffect(() => {
    if (!moreOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [moreOpen])

  useEffect(() => {
    const sync = () => {
      setTheme(getTheme())
      setThemePref(getThemePreference())
      setLiveOn(isLiveTheme(getThemePreference()))
      setAmbientOn(getAmbientEnabled())
    }
    window.addEventListener('storage', sync)
    window.addEventListener('nexora-prefs', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('nexora-prefs', sync)
    }
  }, [])

  function cycleShellTheme() {
    setTheme(toggleTheme())
    setThemePref(getThemePreference())
    setLiveOn(isLiveTheme())
    setAmbientOn(getAmbientEnabled())
    window.dispatchEvent(new Event('nexora-prefs'))
  }

  const shellThemeLabel = liveOn || isShopTheme(themePref)
    ? getThemeLabel(themePref)
    : theme === 'dark'
      ? 'Dark mode'
      : 'Light mode'

  const ambientVariant = getLiveAmbientVariant(themePref)

  const mods = modulesOf(user)
  const visibleLinks = useMemo(
    () =>
      links
        .filter((link) => {
          if (link.to === '/app/dashboard' && !canSeeCommand(user?.role)) {
            return false
          }
          if (link.module === 'lots' && !hasLotModule(user)) return false
          if (link.module === 'sell' && !mods.sell) return false
          if (link.module === 'inventory' && !mods.inventory) return false
          if (link.module === 'finance' && !mods.finance) return false
          if (link.module === 'crm' && !mods.crm) return false
          if (link.module === 'procurement' && !mods.procurement) return false
          if (link.module === 'intelligence' && !mods.intelligence) return false
          if (link.module === 'employees' && !mods.employees) return false
          if (link.module === 'labels' && !mods.labels) return false
          if (link.module === 'transfers' && !mods.transfers) return false
          return hasPermission(user?.permissions, user?.role, link.permission)
        })
        .map((link) =>
          link.module === 'lots'
            ? { ...link, label: lotNavLabel(user) }
            : link,
        ),
    [user, mods.sell, mods.inventory, mods.finance, mods.crm, mods.procurement, mods.intelligence, mods.employees, mods.labels, mods.transfers],
  )

  /**
   * Phone bottom bar: Command · Sell · Stock · Sales · More.
   * Command is omitted when the role cannot see it (cashier).
   * Sell / Stock / Sales stay when that role can open them.
   * Setup is not on this bar — it lives in More.
   */
  const mobilePrimary = useMemo(() => {
    const preferred = [
      '/app/dashboard',
      '/app/checkout',
      '/app/products',
      '/app/sales',
    ]
    return preferred
      .map((to) => visibleLinks.find((l) => l.to === to))
      .filter((link): link is NavLinkItem => Boolean(link))
  }, [visibleLinks])

  const bottomLabel: Record<string, string> = {
    '/app/dashboard': 'Command',
    '/app/checkout': 'Sell',
    '/app/products': 'Stock',
    '/app/sales': 'Sales',
  }

  const primaryPaths = useMemo(
    () => new Set(mobilePrimary.map((l) => l.to)),
    [mobilePrimary],
  )
  const moreIsActive =
    moreOpen ||
    (!primaryPaths.has(location.pathname) &&
      visibleLinks.some((l) => l.to === location.pathname))

  return (
    <OfflineSyncProvider>
      <div className="relative isolate min-h-dvh overflow-x-hidden bg-surface pb-[calc(5.25rem+env(safe-area-inset-bottom))] lg:h-dvh lg:max-h-dvh lg:overflow-hidden lg:pb-0">
        {ambientOn ? (
          <div
            className={`pointer-events-none z-0 overflow-hidden ${
              liveOn ? 'fixed inset-0' : 'absolute inset-0'
            }`}
          >
            <LiveAmbient variant={liveOn ? ambientVariant : 'floor'} />
          </div>
        ) : null}

        <div className="relative z-10 min-h-dvh lg:grid lg:h-full lg:max-h-full lg:grid-cols-[260px_minmax(0,1fr)] lg:overflow-hidden">
          {/* Mobile top bar */}
          <header className="nx-chrome-blur sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line/70 bg-card/95 px-3 py-2.5 backdrop-blur-xl sm:px-4 sm:py-3 lg:hidden pt-[max(0.65rem,env(safe-area-inset-top))]">
            <div className="flex min-w-0 items-center gap-2.5">
              <NexoraMark className="h-9 w-9 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-ink">
                  {user?.businessName || 'NEXORA'}
                </p>
                <p className="truncate text-[11px] text-ink-soft">
                  {ROLE_LABELS[user?.role || ''] || user?.role}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <OnlineStatus compact />
              <NavLink
                to="/app/guide"
                className="flex h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-teal/30 bg-teal/10 px-2.5 text-xs font-bold text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/35"
                aria-label="How to use"
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                <span className="hidden min-[420px]:inline">Guide</span>
              </NavLink>
              <AlertsInbox />
            </div>
          </header>

          {/* Desktop sidebar */}
          <aside className="nx-chrome-blur hidden h-full min-h-0 flex-col overflow-hidden border-r border-line/70 bg-card/95 backdrop-blur-xl lg:flex">
            <div className="shrink-0 px-4 py-4 sm:px-5">
              <div className="flex items-center gap-3">
                <NexoraMark className="h-10 w-10 shrink-0" />
                <div>
                  <p className="font-display text-sm font-bold tracking-wide text-ink">
                    NEXORA
                  </p>
                  <p className="text-[11px] text-ink-soft">Shop operating system</p>
                </div>
              </div>
            </div>

            <nav
              className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-3 pb-2"
              aria-label="Main"
            >
              {visibleLinks.map((link) => {
                const Icon = link.icon
                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onPointerEnter={() => prefetchRoute(link.to)}
                    onFocus={() => prefetchRoute(link.to)}
                    className={({ isActive }) =>
                      `inline-flex shrink-0 items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-semibold transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/35 ${
                        isActive
                          ? 'bg-royal text-white shadow-sm shadow-royal/20'
                          : 'text-ink-soft hover:bg-brand-soft hover:text-ink'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    {link.label}
                  </NavLink>
                )
              })}
            </nav>

            <div className="shrink-0 space-y-1.5 border-t border-line px-3 py-3 sm:px-4">
              <div className="rounded-xl border border-line bg-surface/60 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {user?.businessName || 'Your shop'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-soft">
                      {user?.fullName}
                      {user?.role
                        ? ` · ${ROLE_LABELS[user.role] || user.role}`
                        : ''}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                    Live
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-[11px] tabular-nums text-ink-soft">
                  {now.toLocaleString([], {
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <div className="mt-2">
                  <BranchSwitcher compact />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 px-0.5">
                <OnlineStatus />
                <AlertsInbox />
              </div>

              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-brand-soft hover:text-ink"
                onClick={cycleShellTheme}
              >
                {liveOn || isShopTheme(themePref) ? (
                  <Sparkles className="h-4 w-4 text-teal" />
                ) : theme === 'dark' ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                {shellThemeLabel}
              </button>

              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-danger/10 hover:text-danger"
                onClick={() => {
                  logout()
                  navigate('/login', { replace: true })
                }}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </aside>

          <main className="nx-page min-h-0 min-w-0 overflow-y-auto overscroll-y-contain px-3 py-4 sm:px-6 sm:py-6 lg:h-full lg:px-8 lg:py-7">
            <SetupGuideBanner />
            <Outlet />
          </main>
        </div>

        {/* Phone bottom bar */}
        <nav
          className="nx-chrome-blur fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-card/95 backdrop-blur-xl lg:hidden pb-[env(safe-area-inset-bottom)]"
          aria-label="Primary"
        >
          <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0.5 px-1 pt-1.5 pb-1">
            {mobilePrimary.map((link) => {
              const Icon = link.icon
              const label = bottomLabel[link.to] || link.short || link.label
              const isActive = location.pathname === link.to
              return (
                <button
                  key={link.to}
                  type="button"
                  onPointerEnter={() => prefetchRoute(link.to)}
                  onClick={() => {
                    if (location.pathname !== link.to) navigate(link.to)
                  }}
                  className="flex min-h-[3.5rem] min-w-0 flex-1 flex-col items-center touch-manipulation focus-visible:outline-none"
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={link.label}
                >
                  <span
                    className={`flex w-full flex-col items-center gap-0.5 rounded-[var(--radius-md)] px-0.5 py-1 text-[10px] font-semibold leading-tight transition ${
                      isActive ? 'text-royal' : 'text-ink-soft'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] transition ${
                        isActive ? 'bg-royal text-white' : 'bg-transparent'
                      }`}
                    >
                      <Icon
                        className="h-[1.15rem] w-[1.15rem]"
                        strokeWidth={isActive ? 2.25 : 2}
                        aria-hidden
                      />
                    </span>
                    <span className="max-w-full truncate px-0.5 leading-none">
                      {label}
                    </span>
                  </span>
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className="flex min-h-[3.5rem] min-w-0 flex-1 flex-col items-center touch-manipulation focus-visible:outline-none"
              aria-label="More modules"
              aria-expanded={moreOpen}
            >
              <span
                className={`flex w-full flex-col items-center gap-0.5 rounded-[var(--radius-md)] px-0.5 py-1 text-[10px] font-semibold leading-tight transition ${
                  moreIsActive ? 'text-royal' : 'text-ink-soft'
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] transition ${
                    moreIsActive ? 'bg-royal text-white' : 'bg-transparent'
                  }`}
                >
                  <Grid2X2
                    className="h-[1.15rem] w-[1.15rem]"
                    strokeWidth={moreIsActive ? 2.25 : 2}
                    aria-hidden
                  />
                </span>
                <span className="max-w-full truncate px-0.5">More</span>
              </span>
            </button>
          </div>
        </nav>

        {/* Phone: full module sheet — same list as laptop sidebar */}
        {moreOpen ? (
          <div
            className="fixed inset-0 z-[70] flex flex-col bg-ink/50 lg:hidden"
            onClick={() => setMoreOpen(false)}
          >
            <div
              className="mt-auto flex max-h-[min(92dvh,920px)] flex-col rounded-t-[1.5rem] border border-line bg-card shadow-[var(--shadow)]"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="All modules"
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
                <div>
                  <p className="font-display text-lg font-bold tracking-tight text-ink">
                    All modules
                  </p>
                  <p className="text-xs text-ink-soft">
                    Same screens as on a laptop — tap any one
                  </p>
                </div>
                <button
                  type="button"
                  className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-line text-ink-soft transition hover:bg-brand-soft hover:text-ink"
                  onClick={() => setMoreOpen(false)}
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
                <div className="mb-3 rounded-2xl border border-teal/25 bg-teal/10 p-3">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 text-left touch-manipulation"
                    onClick={() => {
                      setMoreOpen(false)
                      if (location.pathname !== '/app/guide') {
                        navigate('/app/guide')
                      }
                    }}
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal text-white">
                      <BookOpen className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-ink">
                        How to use
                      </span>
                      <span className="block text-xs text-ink-soft">
                        Screens, word meanings, voice walkthrough
                      </span>
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-4">
                  {visibleLinks.map((link) => {
                    const Icon = link.icon
                    const active = location.pathname === link.to
                    return (
                      <button
                        key={link.to}
                        type="button"
                        onPointerEnter={() => prefetchRoute(link.to)}
                        onClick={() => {
                          // Explicit navigate — more reliable than NavLink when
                          // the sheet unmounts mid-tap on some mobile browsers.
                          setMoreOpen(false)
                          if (location.pathname !== link.to) {
                            navigate(link.to)
                          }
                        }}
                        className={`flex min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-2xl border px-1.5 py-2.5 text-center touch-manipulation transition active:scale-[0.98] ${
                          active
                            ? 'border-royal bg-royal text-white'
                            : 'border-line bg-surface text-ink hover:border-royal/40 hover:bg-brand-soft'
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-royal'}`}
                          strokeWidth={2.1}
                          aria-hidden
                        />
                        <span className="line-clamp-2 max-w-full px-0.5 text-[11px] font-semibold leading-tight">
                          {link.label}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="mt-4 space-y-2 border-t border-line pt-3">
                  <div className="rounded-xl border border-line bg-surface/70 p-3">
                    <p className="text-sm font-semibold text-ink">
                      {user?.fullName}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {user?.businessName}
                      {user?.role
                        ? ` · ${ROLE_LABELS[user.role] || user.role}`
                        : ''}
                    </p>
                    <div className="mt-2">
                      <BranchSwitcher compact />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-1">
                    <OnlineStatus />
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-xs font-semibold text-ink-soft"
                      onClick={cycleShellTheme}
                    >
                      {liveOn || isShopTheme(themePref) ? (
                        <Sparkles className="h-3.5 w-3.5 text-teal" />
                      ) : theme === 'dark' ? (
                        <Sun className="h-3.5 w-3.5" />
                      ) : (
                        <Moon className="h-3.5 w-3.5" />
                      )}
                      {shellThemeLabel}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="flex w-full min-h-11 items-center justify-center gap-2 rounded-xl border border-danger/25 bg-danger/10 text-sm font-semibold text-danger"
                    onClick={() => {
                      setMoreOpen(false)
                      logout()
                      navigate('/login', { replace: true })
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </OfflineSyncProvider>
  )
}
