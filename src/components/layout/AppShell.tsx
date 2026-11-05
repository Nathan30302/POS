import { NavLink, Outlet } from 'react-router-dom'
import {
  Barcode,
  LayoutDashboard,
  Package,
  Receipt,
  ShoppingCart,
} from 'lucide-react'
import { useRole } from '@/hooks/useRole'
import type { AppRole } from '@/lib/roles'

const links: {
  to: string
  label: string
  icon: typeof ShoppingCart
  roles: AppRole[]
}[] = [
  { to: '/checkout', label: 'Checkout', icon: ShoppingCart, roles: ['owner', 'staff'] },
  { to: '/products', label: 'Products', icon: Package, roles: ['owner', 'staff'] },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['owner'] },
  { to: '/sales', label: 'Sales', icon: Receipt, roles: ['owner'] },
  { to: '/barcodes', label: 'Barcodes', icon: Barcode, roles: ['owner', 'staff'] },
]

export function AppShell() {
  const { role, setRole, isOwner } = useRole()

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-line bg-card lg:border-b-0 lg:border-r">
        <div className="px-5 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Stationery POS
          </p>
          <h1 className="mt-1 text-xl font-bold text-ink">Shop Counter</h1>
          <p className="mt-1 text-xs text-ink-soft">Local demo · fully offline</p>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-4 pb-4 lg:flex-col lg:overflow-visible">
          {links
            .filter((link) => link.roles.includes(role))
            .map((link) => {
              const Icon = link.icon
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-brand text-white'
                        : 'text-ink-soft hover:bg-slate-100 hover:text-ink'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </NavLink>
              )
            })}
        </nav>

        <div className="border-t border-line px-4 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Signed in as
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole('owner')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                isOwner
                  ? 'bg-brand text-white'
                  : 'bg-slate-100 text-ink-soft hover:bg-slate-200'
              }`}
            >
              Owner
            </button>
            <button
              type="button"
              onClick={() => setRole('staff')}
              className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                !isOwner
                  ? 'bg-brand text-white'
                  : 'bg-slate-100 text-ink-soft hover:bg-slate-200'
              }`}
            >
              Staff
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-ink-soft">
            {isOwner
              ? 'Owner sees costs, reports, and dashboard.'
              : 'Staff sees selling prices and checkout only.'}
          </p>
        </div>
      </aside>

      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
