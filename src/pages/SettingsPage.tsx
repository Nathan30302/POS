import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  KeyRound,
  LayoutTemplate,
  Settings2,
  Sparkles,
  Volume2,
} from 'lucide-react'
import { BranchesSettings } from '@/components/BranchesSettings'
import { PageHero } from '@/components/PageHero'
import { LoyaltySettingsPanel } from '@/components/LoyaltySettingsPanel'
import { SettingsThemePickCard } from '@/components/SettingsThemePickCard'
import { ShopSwitcher } from '@/components/ShopSwitcher'
import { SubscriptionPanel } from '@/components/SubscriptionPanel'
import { PhoneShopLink } from '@/components/PhoneShopLink'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import {
  DEFAULT_LANDING_LOOK,
  getLandingLook,
  LANDING_ACCENT_OPTIONS,
  LANDING_BG_OPTIONS,
  LANDING_TONE_OPTIONS,
  normalizeLandingLook,
  setLandingLook,
  type LandingLook,
} from '@/lib/landingLook'
import {
  PERMISSION_LABELS,
  ROLE_LABELS,
  type Permission,
} from '@/lib/permissions'
import {
  applyAllPreferences,
  COUNTER_THEME_OPTIONS,
  getAmbientEnabled,
  getDensity,
  getThemePreference,
  isLiveTheme,
  LIVE_THEME_OPTIONS,
  setAmbientEnabled,
  setDensity,
  setThemePreference,
  type DensityMode,
  type ThemeMode,
} from '@/lib/theme'
import { INDUSTRY_OPTIONS } from '@/lib/industry'
import { unlockAudio } from '@/lib/sounds'
import {
  DEFAULT_THANKS_PHRASE,
  getVoiceThanksEnabled,
  getVoiceThanksPhrase,
  previewSaleThanks,
  setVoiceThanksEnabled,
  setVoiceThanksPhrase,
  voiceThanksSupported,
} from '@/lib/voiceThanks'

export function SettingsPage() {
  const { user, isOwnerLike, refresh } = useAuth()
  const [theme, setTheme] = useState<ThemeMode>(getThemePreference())
  const [ambient, setAmbient] = useState(getAmbientEnabled())
  const [density, setDensityMode] = useState<DensityMode>(getDensity())
  const [savedLook, setSavedLook] = useState(false)
  const [landing, setLanding] = useState<LandingLook>(getLandingLook)
  const [savedLanding, setSavedLanding] = useState(false)
  const [voiceOn, setVoiceOn] = useState(getVoiceThanksEnabled)
  const [voicePhrase, setVoicePhrase] = useState(getVoiceThanksPhrase)
  const [voiceSaved, setVoiceSaved] = useState(false)
  const [managerPin, setManagerPin] = useState('')
  const [pinStatus, setPinStatus] = useState<{
    configured: boolean
    selfConfigured: boolean
    canSet: boolean
  } | null>(null)
  const [pinBusy, setPinBusy] = useState(false)
  const [pinMsg, setPinMsg] = useState('')
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    currency: 'ZMW',
    industry: 'retail',
    mtnAgentNumber: '',
    mtnAgentCode: '',
    airtelAgentNumber: '',
    airtelAgentCode: '',
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
        industry?: string
        settings?: Record<string, unknown>
      }
    }>('/business/me')
      .then((data) => {
        const settings = data.business.settings || {}
        const str = (key: string) =>
          typeof settings[key] === 'string' ? String(settings[key]) : ''
        setForm({
          name: data.business.name || '',
          phone: data.business.phone || '',
          address: data.business.address || '',
          currency: data.business.currency || 'ZMW',
          industry: data.business.industry || 'retail',
          mtnAgentNumber: str('mtnAgentNumber'),
          mtnAgentCode: str('mtnAgentCode'),
          airtelAgentNumber: str('airtelAgentNumber'),
          airtelAgentCode: str('airtelAgentCode'),
        })
        if (settings.landingLook) {
          const next = normalizeLandingLook(settings.landingLook)
          setLanding(next)
          setLandingLook(next)
        }
      })
      .catch(() => undefined)
  }, [isOwnerLike])

  useEffect(() => {
    if (!isOwnerLike) return
    void api<{
      configured: boolean
      selfConfigured: boolean
      canSet: boolean
    }>('/team/manager-pin/status')
      .then(setPinStatus)
      .catch(() => undefined)
  }, [isOwnerLike])

  async function saveManagerPin(clear = false) {
    setPinBusy(true)
    setPinMsg('')
    setError('')
    try {
      await api('/team/manager-pin', {
        method: 'POST',
        body: JSON.stringify(clear ? { clear: true } : { pin: managerPin }),
      })
      setManagerPin('')
      setPinMsg(clear ? 'Manager PIN cleared.' : 'Manager PIN saved.')
      const status = await api<{
        configured: boolean
        selfConfigured: boolean
        canSet: boolean
      }>('/team/manager-pin/status')
      setPinStatus(status)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save PIN')
    } finally {
      setPinBusy(false)
    }
  }

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

  async function saveLanding() {
    const next = setLandingLook(landing)
    setLanding(next)
    broadcastPrefs()
    setSavedLanding(true)
    window.setTimeout(() => setSavedLanding(false), 1600)
    if (!isOwnerLike) return
    try {
      await api('/business/me', {
        method: 'PATCH',
        body: JSON.stringify({ settings: { landingLook: next } }),
      })
    } catch {
      /* localStorage still applied for this device */
    }
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
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          address: form.address,
          currency: form.currency,
          industry: form.industry,
          settings: {
            mtnAgentNumber: form.mtnAgentNumber,
            mtnAgentCode: form.mtnAgentCode,
            airtelAgentNumber: form.airtelAgentNumber,
            airtelAgentCode: form.airtelAgentCode,
            landingLook: getLandingLook(),
          },
        }),
      })
      await refresh()
      setOk(
        'Business profile saved. Shop type modules refresh on next navigation.',
      )
      window.setTimeout(() => setOk(''), 2200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <PageHero
        eyebrow="Workspace · shop identity"
        title="Settings"
        subtitle="Profile, look, and branches. New staff? Open How to use for video training."
        actions={
          <Link
            to="/app/guide"
            className="inline-flex min-h-11 items-center rounded-xl border border-line bg-card px-4 text-sm font-semibold text-ink hover:bg-brand-soft"
          >
            How to use
          </Link>
        }
      />

      <ShopSwitcher />

      <PhoneShopLink
        path="/login"
        title="Phone link for staff"
        hint="Same Wi‑Fi · sign in · Sell"
      />

      <section className="nx-card space-y-4 p-4 sm:p-6">
        <div>
          <h3 className="nx-section-title">Branches</h3>
          <p className="mt-1 text-xs text-ink-soft">
            Active location tags sales. Switch here or from the sidebar.
          </p>
        </div>
        <BranchesSettings />
      </section>

      {isOwnerLike && pinStatus?.canSet ? (
        <section className="nx-card space-y-4 p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-royal" />
            <h3 className="nx-section-title">Manager approval PIN</h3>
          </div>
          <p className="text-xs text-ink-soft">
            Required for large voids (≥ ZMW 50) and large discounts when set.
            Any owner/admin PIN that matches will approve.
            {pinStatus.selfConfigured
              ? ' Your PIN is set.'
              : ' You have not set a PIN yet.'}
            {pinStatus.configured && !pinStatus.selfConfigured
              ? ' Another manager already has a PIN for this shop.'
              : ''}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[8rem] flex-1">
              <Input
                label="New PIN (4–6 digits)"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value)}
              />
            </div>
            <Button
              type="button"
              disabled={pinBusy || !/^\d{4,6}$/.test(managerPin)}
              onClick={() => void saveManagerPin(false)}
            >
              {pinBusy ? 'Saving…' : 'Save PIN'}
            </Button>
            {pinStatus.selfConfigured ? (
              <Button
                type="button"
                variant="secondary"
                disabled={pinBusy}
                onClick={() => void saveManagerPin(true)}
              >
                Clear
              </Button>
            ) : null}
          </div>
          {pinMsg ? <FormBanner tone="ok">{pinMsg}</FormBanner> : null}
        </section>
      ) : null}

      <section className="nx-card space-y-5 p-4 sm:p-6">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-royal" />
            <h3 className="nx-section-title">Look & feel</h3>
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Counter skins apply instantly on this device. Use Apply look to
            confirm density & atmosphere together.
          </p>
        </div>

        <div className="space-y-5">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Counter
            </p>
            <p className="mb-3 text-[11px] text-ink-soft">
              Static full-page atmospheres — distinct from plain light/dark.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {COUNTER_THEME_OPTIONS.length === 0 ? (
                <p className="text-sm text-ink-soft sm:col-span-2">
                  Counter themes failed to load — reload the app.
                </p>
              ) : (
                COUNTER_THEME_OPTIONS.map((option) => (
                  <SettingsThemePickCard
                    key={option.value}
                    option={option}
                    selected={theme === option.value}
                    onSelect={() => {
                      setTheme(option.value)
                      setThemePreference(option.value)
                      broadcastPrefs()
                    }}
                  />
                ))
              )}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Live atmospheres
            </p>
            <p className="mb-3 text-[11px] text-ink-soft">
              City = Dubai highway film; Streets = Johannesburg skyline. Sky &amp; Market
              are painted. Hover a video card for a preview.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {LIVE_THEME_OPTIONS.length === 0 ? (
                <p className="text-sm text-ink-soft sm:col-span-2">
                  Live atmospheres failed to load — reload the app.
                </p>
              ) : (
                LIVE_THEME_OPTIONS.map((option) => (
                  <SettingsThemePickCard
                    key={option.value}
                    option={option}
                    selected={theme === option.value}
                    onSelect={() => {
                      setTheme(option.value)
                      setThemePreference(option.value)
                      setAmbient(true)
                      broadcastPrefs()
                    }}
                  />
                ))
              )}
            </div>
          </div>

          <p className="text-xs text-ink-soft">
            Shell cycle: Light → Dark → Live City. Full gallery is here.
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Atmosphere
          </p>
          <button
            type="button"
            disabled={isLiveTheme(theme)}
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
            } ${isLiveTheme(theme) ? 'opacity-90' : ''}`}
          >
            <span>
              {isLiveTheme(theme)
                ? 'Live atmosphere keeps motion on'
                : ambient
                  ? 'Floating glow on'
                  : 'Floating glow off'}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                ambient ? 'bg-emerald-500/20 text-emerald-600' : 'bg-line text-ink-soft'
              }`}
            >
              {ambient ? 'On' : 'Off'}
            </span>
          </button>
          <p className="mt-2 text-xs text-ink-soft">
            Orbs and dust behind the workspace. Any Live skin always enables this.
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

        <div className="space-y-2 border-t border-line/70 pt-4">
          <Button type="button" onClick={saveLook} className="min-h-11">
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
          {savedLook ? (
            <FormBanner tone="ok">Look & feel applied on this device.</FormBanner>
          ) : null}
        </div>
      </section>

      <section className="nx-card space-y-5 p-4 sm:p-6">
        <div>
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-4 w-4 text-royal" />
            <h3 className="nx-section-title">Landing page look</h3>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            Accent, headline tone, and hero atmosphere for the public NEXORA
            landing (shown when signed out).
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Accent
          </p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {LANDING_ACCENT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setLanding((l) => ({ ...l, accent: opt.value }))
                }
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  landing.accent === opt.value
                    ? 'border-royal ring-2 ring-royal/30'
                    : 'border-line hover:border-royal/40'
                }`}
              >
                <span
                  className="mb-2 block h-2 w-full rounded-full"
                  style={{ background: opt.hex }}
                />
                <span className="text-xs font-semibold text-ink">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Headline tone
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {LANDING_TONE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLanding((l) => ({ ...l, tone: opt.value }))}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  landing.tone === opt.value
                    ? 'border-royal bg-royal/15 text-royal'
                    : 'border-line bg-surface text-ink-soft hover:border-royal/40'
                }`}
              >
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="mt-1 block text-[11px] leading-snug opacity-80">
                  {opt.blurb}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Background
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {LANDING_BG_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  setLanding((l) => ({ ...l, background: opt.value }))
                }
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  landing.background === opt.value
                    ? 'border-royal bg-royal/15 text-royal'
                    : 'border-line bg-surface text-ink-soft hover:border-royal/40'
                }`}
              >
                <span className="block text-sm font-semibold">{opt.label}</span>
                <span className="mt-1 block text-[11px] leading-snug opacity-80">
                  {opt.blurb}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t border-line/70 pt-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void saveLanding()}>
              {savedLanding ? (
                <>
                  <Check className="h-4 w-4" /> Saved
                </>
              ) : (
                'Save landing look'
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLanding({ ...DEFAULT_LANDING_LOOK })}
            >
              Reset defaults
            </Button>
          </div>
          {savedLanding ? (
            <FormBanner tone="ok">Landing look saved for this shop.</FormBanner>
          ) : null}
        </div>
      </section>

      <section className="nx-card space-y-4 p-4 sm:p-6">
        <div>
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-royal" />
            <h3 className="nx-section-title">Counter voice</h3>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            Spoken thank-you after each completed sale. Scan beeps stay separate.
          </p>
        </div>
        {!voiceThanksSupported() ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            This browser doesn’t support spoken voice. Beeps still work.
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                const next = !voiceOn
                setVoiceOn(next)
                setVoiceThanksEnabled(next)
              }}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                voiceOn
                  ? 'border-teal/40 bg-teal/10 text-ink'
                  : 'border-line bg-surface text-ink-soft'
              }`}
            >
              <span>Thank-you voice after sale</span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                  voiceOn
                    ? 'bg-emerald-500/20 text-emerald-600'
                    : 'bg-line text-ink-soft'
                }`}
              >
                {voiceOn ? 'On' : 'Off'}
              </span>
            </button>
            <Input
              label="Phrase"
              value={voicePhrase}
              onChange={(e) => setVoicePhrase(e.target.value)}
              placeholder={DEFAULT_THANKS_PHRASE}
              hint="Played when a sale completes (this device)."
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  unlockAudio()
                  setVoiceThanksPhrase(voicePhrase)
                  previewSaleThanks()
                }}
              >
                Preview
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setVoiceThanksEnabled(voiceOn)
                  setVoiceThanksPhrase(voicePhrase)
                  setVoiceSaved(true)
                  window.setTimeout(() => setVoiceSaved(false), 1400)
                }}
              >
                {voiceSaved ? (
                  <>
                    <Check className="h-4 w-4" /> Saved
                  </>
                ) : (
                  'Save voice'
                )}
              </Button>
            </div>
            {voiceSaved ? (
              <FormBanner tone="ok">Voice thank-you saved on this device.</FormBanner>
            ) : null}
          </>
        )}
      </section>

      {isOwnerLike ? (
        <section className="nx-card space-y-4 p-4 sm:p-6">
          <div>
            <h3 className="nx-section-title">Subscription</h3>
            <p className="mt-1 text-xs text-ink-soft">
              Plan, trial, and billing history for this shop.
            </p>
          </div>
          <SubscriptionPanel />
        </section>
      ) : null}

      {isOwnerLike ? (
        <section className="nx-card space-y-4 p-4 sm:p-6">
          <div>
            <h3 className="nx-section-title">Loyalty</h3>
            <p className="mt-1 text-xs text-ink-soft">
              Auto-earn on Sell, redeem rates, and short campaigns.
            </p>
          </div>
          <LoyaltySettingsPanel />
        </section>
      ) : null}

      {isOwnerLike ? (
        <form onSubmit={saveBusiness} className="nx-card space-y-4 p-4 sm:p-6">
          <div>
            <h3 className="nx-section-title">Business profile</h3>
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
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Shop type</span>
            <select
              className="nx-field"
              value={form.industry}
              onChange={(e) =>
                setForm((f) => ({ ...f, industry: e.target.value }))
              }
            >
              {INDUSTRY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="block text-xs text-ink-soft">
              Pharmacy unlocks lots, FEFO, and Rx. Grocery unlocks perishables.
              Retail stays lean without pharmacy tools.
            </span>
          </label>

          <div className="space-y-3 rounded-2xl border border-line bg-surface/60 p-4">
            <div>
              <h4 className="text-sm font-semibold text-ink">Mobile money</h4>
              <p className="mt-1 text-xs text-ink-soft">
                Shown on Sell for MTN MoMo or Airtel Money — your shop payout
                number for customer send-money or cash-out.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="MTN MoMo number"
                value={form.mtnAgentNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mtnAgentNumber: e.target.value }))
                }
                placeholder="097xxxxxxx"
              />
              <Input
                label="MTN agent code"
                value={form.mtnAgentCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mtnAgentCode: e.target.value }))
                }
                placeholder="Optional"
              />
              <Input
                label="Airtel Money number"
                value={form.airtelAgentNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, airtelAgentNumber: e.target.value }))
                }
                placeholder="097xxxxxxx"
              />
              <Input
                label="Airtel agent code"
                value={form.airtelAgentCode}
                onChange={(e) =>
                  setForm((f) => ({ ...f, airtelAgentCode: e.target.value }))
                }
                placeholder="Optional"
              />
            </div>
          </div>

          {error ? <FormBanner tone="error">{error}</FormBanner> : null}
          {ok ? <FormBanner tone="ok">{ok}</FormBanner> : null}
          <Button type="submit" disabled={busy} className="min-h-11">
            {busy ? 'Saving…' : ok ? (
              <>
                <Check className="h-4 w-4" /> Saved
              </>
            ) : (
              'Save business'
            )}
          </Button>
        </form>
      ) : (
        <div className="nx-card space-y-3 p-4 text-sm text-ink-soft sm:p-6">
          <p>
            Signed in as{' '}
            <strong className="text-ink">
              {ROLE_LABELS[user?.role || ''] || user?.role}
            </strong>
            . Theme and atmosphere apply to this device. Only owners/admins can
            edit the shop profile.
          </p>
          {(user?.permissions || []).length > 0 ? (
            <ul className="space-y-1">
              {(user?.permissions || []).map((perm) => (
                <li key={perm} className="text-xs">
                  · {PERMISSION_LABELS[perm as Permission] || perm}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  )
}
