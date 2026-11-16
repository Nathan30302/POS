import { useEffect, useState, type FormEvent } from 'react'
import { Check, Moon, Settings2, Sparkles, Sun, Monitor } from 'lucide-react'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import {
  applyAllPreferences,
  getAmbientEnabled,
  getDensity,
  getThemePreference,
  setAmbientEnabled,
  setDensity,
  setThemePreference,
  type DensityMode,
  type ThemeMode,
} from '@/lib/theme'

export function SettingsPage() {
  const { user, isOwnerLike, refresh } = useAuth()
  const [theme, setTheme] = useState<ThemeMode>(getThemePreference())
  const [ambient, setAmbient] = useState(getAmbientEnabled())
  const [density, setDensityMode] = useState<DensityMode>(getDensity())
  const [savedLook, setSavedLook] = useState(false)
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    currency: 'ZMW',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    applyAllPreferences()
  }, [])

  useEffect(() => {
    if (!isOwnerLike) return
    void api<{
      business: {
        name: string
        phone?: string | null
        address?: string | null
        currency: string
      }
    }>('/business/me')
      .then((data) => {
        setForm({
          name: data.business.name || '',
          phone: data.business.phone || '',
          address: data.business.address || '',
          currency: data.business.currency || 'ZMW',
        })
      })
      .catch(() => undefined)
  }, [isOwnerLike])

  function broadcastPrefs() {
    window.dispatchEvent(new Event('nexora-prefs'))
  }

  function saveLook() {
    setThemePreference(theme)
    setAmbientEnabled(ambient)
    setDensity(density)
    broadcastPrefs()
    setSavedLook(true)
    window.setTimeout(() => setSavedLook(false), 1600)
  }

  async function saveBusiness(e: FormEvent) {
    e.preventDefault()
    if (!isOwnerLike) return
    setBusy(true)
    setError('')
    setOk('')
    try {
      await api('/business/me', {
        method: 'PATCH',
        body: JSON.stringify(form),
      })
      await refresh()
      setOk('Business profile saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHero
        eyebrow="Workspace"
        title="Settings"
        subtitle="Make NEXORA feel like your shop — theme, live atmosphere, and business profile."
      />

      <section className="nx-card space-y-5 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-royal" />
          <h3 className="font-display text-lg font-bold">Look & feel</h3>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Theme
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(
              [
                ['light', 'Light', Sun],
                ['dark', 'Dark', Moon],
                ['system', 'System', Monitor],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setTheme(value)
                  setThemePreference(value)
                  broadcastPrefs()
                }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                  theme === value
                    ? 'border-royal bg-royal/15 text-royal'
                    : 'border-line bg-surface text-ink-soft hover:border-royal/40'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Live atmosphere
          </p>
          <button
            type="button"
            onClick={() => {
              const next = !ambient
              setAmbient(next)
              setAmbientEnabled(next)
              broadcastPrefs()
            }}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${
              ambient
                ? 'border-teal/40 bg-teal/10 text-ink'
                : 'border-line bg-surface text-ink-soft'
            }`}
          >
            <span>{ambient ? 'Live glow on' : 'Live glow off'}</span>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                ambient ? 'bg-emerald-500/20 text-emerald-600' : 'bg-line text-ink-soft'
              }`}
            >
              {ambient ? 'Live' : 'Static'}
            </span>
          </button>
          <p className="mt-2 text-xs text-ink-soft">
            Soft moving light behind Command, Pulse, and the rest of the workspace.
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Density
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['comfortable', 'Comfortable'],
                ['compact', 'Compact'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setDensityMode(value)
                  setDensity(value)
                  broadcastPrefs()
                }}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                  density === value
                    ? 'border-royal bg-royal/15 text-royal'
                    : 'border-line bg-surface text-ink-soft hover:border-royal/40'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Button type="button" onClick={saveLook}>
          {savedLook ? (
            <>
              <Check className="h-4 w-4" /> Saved
            </>
          ) : (
            <>
              <Settings2 className="h-4 w-4" /> Apply look
            </>
          )}
        </Button>
      </section>

      {isOwnerLike ? (
        <form onSubmit={saveBusiness} className="nx-card space-y-4 p-5 sm:p-6">
          <div>
            <h3 className="font-display text-lg font-bold">Business profile</h3>
            <p className="mt-1 text-xs text-ink-soft">
              Shown across the workspace for {user?.businessName || 'your shop'}.
            </p>
          </div>
          <Input
            label="Business name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            label="Address"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
          <Input
            label="Currency"
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {ok ? <p className="text-sm text-ok">{ok}</p> : null}
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save business'}
          </Button>
        </form>
      ) : (
        <div className="nx-card p-5 text-sm text-ink-soft">
          Signed in as <strong className="text-ink">{user?.role}</strong>. Theme and
          atmosphere settings apply to this device. Only owners/admins can edit the
          business profile.
        </div>
      )}
    </div>
  )
}
