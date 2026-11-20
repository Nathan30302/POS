import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Boxes,
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
  Users,
  Warehouse,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { BranchSwitcher } from '@/components/BranchSwitcher'
import { LiveAmbient } from '@/components/LiveSkyScene'
import { OnlineStatus } from '@/components/OnlineStatus'
import { useAuth } from '@/context/AuthContext'
import {
  canSeeCommand,
  hasPermission,
  PERMISSION_LABELS,
  ROLE_LABELS,
  type Permission,
} from '@/lib/permissions'
import {
  applyAllPreferences,
  getAmbientEnabled,
  getTheme,
  getThemePreference,
  isLiveTheme,
  toggleTheme,
} from '@/lib/theme'

const links: Array<{
  to: string
  label: string
  icon: typeof LayoutDashboard
  permission: Permission | null
}> = [
  { to: '/app/dashboard', label: 'Command', icon: LayoutDashboard, permission: null },
  { to: '/app/checkout', label: 'Sell', icon: Store, permission: 'sell' },
  { to: '/app/products', label: 'Inventory', icon: Warehouse, permission: 'inventory' },
  { to: '/app/sales', label: 'Ledger', icon: Receipt, permission: 'ledger' },
  { to: '/app/customers', label: 'Customers', icon: Users, permission: 'customers' },
  { to: '/app/insights', label: 'Pulse', icon: Sparkles, permission: 'pulse' },
  { to: '/app/barcodes', label: 'Labels', icon: Boxes, permission: 'labels' },
  { to: '/app/team', label: 'Team', icon: Shield, permission: 'team' },
  { to: '/app/audit', label: 'Audit', icon: ScrollText, permission: 'team' },
  {
    to: '/app/conflicts',
    label: 'Conflicts',
    icon: AlertTriangle,
    permission: 'team',
  },
  { to: '/app/settings', label: 'Settings', icon: Settings, permission: null },
]

export function NexoraShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(getTheme())
  const [liveOn, setLiveOn] = useState(isLiveTheme())
  const [ambientOn, setAmbientOn] = useState(getAmbientEnabled())
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    applyAllPreferences()
    setAmbientOn(getAmbientEnabled())
    setTheme(getTheme())
    setLiveOn(isLiveTheme())
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const sync = () => {
      setTheme(getTheme())
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

  const visibleLinks = useMemo(
    () =>
      links.filter((link) => {
        if (link.to === '/app/dashboard' && !canSeeCommand(user?.role)) {
          return false
        }
        return hasPermission(user?.permissions, user?.role, link.permission)
      }),
    [user?.permissions, user?.role],
  )

  // Prefer Sell / Inventory / Ledger / Pulse / Settings on phone bottom bar
  const mobilePrimary = useMemo(() => {
    const preferred = [
      '/app/checkout',
      '/app/products',
      '/app/sales',
      '/app/insights',
      '/app/settings',
    ]
    const picked = preferred
      .map((to) => visibleLinks.find((l) => l.to === to))
      .filter(Boolean) as typeof visibleLinks
    if (picked.length >= 3) return picked.slice(0, 5)
    return visibleLinks.slice(0, 5)
  }, [visibleLinks])

  return (
    <div className="relative isolate min-h-dvh overflow-x-hidden bg-surface pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
      {ambientOn ? (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
          <LiveAmbient />
        </div>
      ) : null}

      <div className="relative z-10 min-h-dvh lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-card/95 px-4 py-3 backdrop-blur-xl lg:hidden pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-royal to-teal text-[10px] font-bold text-white">
              NX
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {user?.businessName || 'NEXORA'}
              </p>
              <p className="truncate text-[11px] text-ink-soft">
                {ROLE_LABELS[user?.role || ''] || user?.role}
              </p>
            </div>
          </div>
          <OnlineStatus />
          <button
            type="button"
            className="rounded-xl border border-line px-2.5 py-2 text-ink-soft"
            onClick={() => {
              setTheme(toggleTheme())
              setLiveOn(isLiveTheme())
              setAmbientOn(getAmbientEnabled())
              window.dispatchEvent(new Event('nexora-prefs'))
            }}
            aria-label="Cycle theme"
            title="Light → Dark → Live Floor"
          >
            {liveOn ? (
              <Sparkles className="h-4 w-4 text-teal" />
            ) : theme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
        </header>

        {/* Desktop sidebar */}
        <aside className="hidden flex-col border-r border-line bg-card/95 backdrop-blur-xl lg:flex lg:sticky lg:top-0 lg:max-h-screen">
          <div className="px-5 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-royal to-teal text-xs font-bold text-white shadow-lg shadow-royal/30">
                NX
              </div>
              <div>
                <p className="font-display text-sm font-bold tracking-wide text-ink">
                  NEXORA
                </p>
                <p className="text-[11px] text-ink-soft">Shop operating system</p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-royal/10 via-card to-teal/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-ink">
                  {user?.businessName || 'Your shop'}
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Live
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-ink-soft">
                {user?.fullName}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="rounded-full bg-card/80 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-royal ring-1 ring-royal/20">
                  {ROLE_LABELS[user?.role || ''] || user?.role}
                </span>
                <p className="font-mono text-[11px] tabular-nums text-ink-soft">
                  {now.toLocaleString([], {
                    weekday: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="mt-3">
                <BranchSwitcher compact />
              </div>
              {user?.role !== 'OWNER' && user?.role !== 'ADMIN' ? (
                <div className="mt-3 border-t border-line/70 pt-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">
                    Your access
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(user?.permissions || []).slice(0, 4).map((perm) => (
                      <span
                        key={perm}
                        className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] text-ink-soft"
                      >
                        {PERMISSION_LABELS[perm as Permission]?.split(' ')[0] ||
                          perm}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4">
            {visibleLinks.map((link) => {
              const Icon = link.icon
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-royal text-white shadow-md shadow-royal/25'
                        : 'text-ink-soft hover:bg-brand-soft hover:text-ink'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="mt-auto space-y-2 border-t border-line px-4 py-4">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-brand-soft"
              onClick={() => {
                setTheme(toggleTheme())
                setLiveOn(isLiveTheme())
                setAmbientOn(getAmbientEnabled())
                window.dispatchEvent(new Event('nexora-prefs'))
              }}
            >
              {liveOn ? (
                <Sparkles className="h-4 w-4 text-teal" />
              ) : theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              {liveOn
                ? 'Live Floor'
                : theme === 'dark'
                  ? 'Dark mode'
                  : 'Light mode'}
              <span className="ml-auto text-[10px] uppercase tracking-wide text-ink-soft">
                tap to cycle
              </span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-red-50 hover:text-danger dark:hover:bg-red-950/40"
              onClick={() => {
                logout()
                navigate('/')
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>

        <main className="nx-page min-w-0 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Phone bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur-xl lg:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-lg items-stretch justify-around gap-0.5 px-1 pt-1">
          {mobilePrimary.map((link) => {
            const Icon = link.icon
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-semibold ${
                    isActive ? 'text-royal' : 'text-ink-soft'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                        isActive ? 'bg-royal/15 text-royal' : ''
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="truncate">{link.label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
