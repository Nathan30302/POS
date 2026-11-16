import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LiveAmbient } from '@/components/LiveSkyScene'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

type BusinessRow = {
  id: string
  name: string
  industry: string
  status: string
  currency: string
  _count: { products: number; sales: number; memberships: number }
}

export function PlatformHomePage() {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    businesses: 0,
    active: 0,
    users: 0,
    salesCount: 0,
  })
  const [businesses, setBusinesses] = useState<BusinessRow[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    industry: 'retail',
    ownerName: '',
    ownerEmail: '',
    ownerPassword: 'Welcome123!',
  })

  async function refresh() {
    const [s, b] = await Promise.all([
      api<{ stats: typeof stats }>('/platform/stats'),
      api<{ businesses: BusinessRow[] }>('/platform/businesses'),
    ])
    setStats(s.stats)
    setBusinesses(b.businesses)
  }

  useEffect(() => {
    void refresh().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load platform'),
    )
  }, [])

  async function createBusiness(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api('/platform/businesses', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      setForm({
        name: '',
        industry: 'retail',
        ownerName: '',
        ownerEmail: '',
        ownerPassword: 'Welcome123!',
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    }
  }

  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-surface px-4 py-8 sm:px-8">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <LiveAmbient />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl space-y-6">
        <div className="overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-royal/15 via-card to-teal/10 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-royal">
              NEXORA Platform
            </p>
            <h1 className="font-display nx-page-title mt-1">Super admin</h1>
            <p className="text-sm text-ink-soft">
              {user?.email} · create shops and owner accounts
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            Sign out
          </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {[
            ['Businesses', stats.businesses],
            ['Active', stats.active],
            ['Users', stats.users],
            ['Sales', stats.salesCount],
          ].map(([label, value]) => (
            <div key={label as string} className="nx-card p-5">
              <p className="text-sm text-ink-soft">{label}</p>
              <p className="mt-2 text-3xl font-bold">{value as number}</p>
            </div>
          ))}
        </div>

        {error ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={createBusiness} className="nx-card space-y-3 p-5">
            <h2 className="text-lg font-semibold">Register business</h2>
            <Input
              label="Business name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
            <Input
              label="Industry"
              value={form.industry}
              onChange={(e) =>
                setForm((f) => ({ ...f, industry: e.target.value }))
              }
            />
            <Input
              label="Owner name"
              value={form.ownerName}
              onChange={(e) =>
                setForm((f) => ({ ...f, ownerName: e.target.value }))
              }
              required
            />
            <Input
              label="Owner email"
              type="email"
              value={form.ownerEmail}
              onChange={(e) =>
                setForm((f) => ({ ...f, ownerEmail: e.target.value }))
              }
              required
            />
            <Input
              label="Owner password"
              value={form.ownerPassword}
              onChange={(e) =>
                setForm((f) => ({ ...f, ownerPassword: e.target.value }))
              }
              required
            />
            <Button type="submit" className="w-full">
              Create business environment
            </Button>
          </form>

          <div className="nx-card p-5">
            <h2 className="mb-4 text-lg font-semibold">Business directory</h2>
            <ul className="space-y-3">
              {businesses.map((b) => (
                <li
                  key={b.id}
                  className="rounded-xl border border-line px-4 py-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{b.name}</p>
                      <p className="text-xs text-ink-soft">
                        {b.industry} · {b.currency} · {b._count.products} products ·{' '}
                        {b._count.sales} sales
                      </p>
                    </div>
                    <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-royal">
                      {b.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
