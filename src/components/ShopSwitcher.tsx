import { useEffect, useState } from 'react'
import { Store } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { useAuth } from '@/context/AuthContext'
import { api, clearClientToken } from '@/lib/api'

type ShopRow = {
  businessId: string
  businessName: string
  role: string
  membershipId: string
  status?: string
}

/** Switch active shop when the user belongs to more than one business. */
export function ShopSwitcher() {
  const { user, refresh } = useAuth()
  const [shops, setShops] = useState<ShopRow[]>([])
  const [currentId, setCurrentId] = useState(user?.businessId || '')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (user?.kind !== 'business') return
    void api<{ shops: ShopRow[]; currentBusinessId?: string }>(
      '/auth/memberships',
    )
      .then((data) => {
        setShops(data.shops || [])
        setCurrentId(data.currentBusinessId || user.businessId || '')
      })
      .catch(() => undefined)
  }, [user?.kind, user?.businessId])

  if (user?.kind !== 'business' || shops.length < 2) return null

  async function switchTo(businessId: string) {
    if (businessId === currentId) return
    setBusy(businessId)
    setError('')
    try {
      await api('/auth/switch-business', {
        method: 'POST',
        body: JSON.stringify({ businessId }),
      })
      clearClientToken()
      setCurrentId(businessId)
      await refresh()
      window.location.assign('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not switch shop')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="nx-card space-y-3 p-5">
      <div className="flex items-center gap-2">
        <Store className="h-4 w-4 text-royal" />
        <h2 className="text-sm font-semibold text-ink">Your shops</h2>
      </div>
      <p className="text-xs text-ink-soft">
        You belong to more than one business. Switch which shop this session
        opens.
      </p>
      {error ? <FormBanner tone="error">{error}</FormBanner> : null}
      <ul className="space-y-2">
        {shops.map((s) => (
          <li
            key={s.businessId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 text-sm"
          >
            <div>
              <p className="font-semibold text-ink">{s.businessName}</p>
              <p className="text-[11px] text-ink-soft">
                {s.role}
                {s.status ? ` · ${s.status}` : ''}
              </p>
            </div>
            {s.businessId === currentId ? (
              <span className="text-xs font-semibold text-teal">Current</span>
            ) : (
              <Button
                type="button"
                className="min-h-9 rounded-lg text-xs"
                disabled={Boolean(busy)}
                onClick={() => void switchTo(s.businessId)}
              >
                {busy === s.businessId ? 'Switching…' : 'Open'}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
