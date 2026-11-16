import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Boxes,
  LayoutDashboard,
  LogOut,
  Moon,
  Receipt,
  Shield,
  Sparkles,
  Store,
  Sun,
  Users,
  Warehouse,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { LiveAmbient } from '@/components/LiveSkyScene'
import { useAuth } from '@/context/AuthContext'
import { hasPermission, type Permission } from '@/lib/permissions'
import { applyTheme, getTheme, toggleTheme } from '@/lib/theme'

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
]

export function NexoraShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(getTheme())
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const visibleLinks = useMemo(
    () =>
      links.filter((link) =>
        hasPermission(user?.permissions, user?.role, link.permission),
      ),
    [user?.permissions, user?.role],
  )

  return (
    <div className="relative isolate min-h-screen overflow-x-hidden bg-surface">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <LiveAmbient />
      </div>

      <div className="relative z-10 min-h-screen lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex flex-col border-b border-line bg-card/90 backdrop-blur-xl lg:min-h-screen lg:border-b-0 lg:border-r">
          <div className="px-5 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-royal to-teal text-xs font-bold text-white shadow-lg shadow-royal/30">
                NX
              </div>
              <div>
                <p className="font-display text-sm font-bold tracking-wide text-ink">
                  NEXORA
                </p>
                <p className="text-[11px] text-ink-soft">Business growth OS</p>
              </div>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-royal/10 via-card to-teal/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-ink">
                  {user?.businessName || 'Business'}
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Live
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-ink-soft">
                {user?.fullName} · {user?.role}
              </p>
              <p className="mt-2 font-mono text-[11px] tabular-nums text-ink-soft">
                {now.toLocaleString([], {
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </p>
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto px-3 pb-4 lg:flex-1 lg:flex-col lg:gap-1 lg:overflow-y-auto lg:overflow-x-visible">
            {visibleLinks.map((link) => {
              const Icon = link.icon
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
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
              onClick={() => setTheme(toggleTheme())}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
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

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
