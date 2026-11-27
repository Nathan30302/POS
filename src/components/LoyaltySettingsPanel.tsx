import { useEffect, useState, type FormEvent } from 'react'
import { Gift } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'

type LoyaltyForm = {
  enabled: boolean
  earnPerKwacha: number
  redeemPtsPerKwacha: number
  maxRedeemFraction: number
  campaignName: string
  campaignMultiplier: number
  campaignEndsAt: string
}

const defaults: LoyaltyForm = {
  enabled: true,
  earnPerKwacha: 1,
  redeemPtsPerKwacha: 10,
  maxRedeemFraction: 0.2,
  campaignName: '',
  campaignMultiplier: 2,
  campaignEndsAt: '',
}

export function LoyaltySettingsPanel() {
  const [form, setForm] = useState<LoyaltyForm>(defaults)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const data = await api<{
          business: { settings?: { loyalty?: Record<string, unknown> } }
        }>('/business/me')
        const L = data.business.settings?.loyalty || {}
        const campaign = (L.campaign || null) as {
          name?: string
          multiplier?: number
          endsAt?: string | null
        } | null
        setForm({
          enabled: L.enabled !== false,
          earnPerKwacha: Number(L.earnPerKwacha) || 1,
          redeemPtsPerKwacha: Number(L.redeemPtsPerKwacha) || 10,
          maxRedeemFraction: Number(L.maxRedeemFraction) || 0.2,
          campaignName: campaign?.name || '',
          campaignMultiplier: Number(campaign?.multiplier) || 2,
          campaignEndsAt: campaign?.endsAt
            ? String(campaign.endsAt).slice(0, 16)
            : '',
        })
      } catch {
        /* keep defaults */
      }
    })()
  }, [])

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    setMsg('')
    try {
      const campaign =
        form.campaignName.trim() && form.campaignEndsAt
          ? {
              name: form.campaignName.trim(),
              multiplier: form.campaignMultiplier,
              endsAt: new Date(form.campaignEndsAt).toISOString(),
            }
          : null
      await api('/business/me', {
        method: 'PATCH',
        body: JSON.stringify({
          settings: {
            loyalty: {
              enabled: form.enabled,
              earnPerKwacha: form.earnPerKwacha,
              redeemPtsPerKwacha: form.redeemPtsPerKwacha,
              maxRedeemFraction: form.maxRedeemFraction,
              campaign,
            },
          },
        }),
      })
      setMsg('Loyalty settings saved.')
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal/15 text-teal">
          <Gift className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">Loyalty earn & campaigns</p>
          <p className="text-xs text-ink-soft">
            Points auto-earn on completed sales with a tagged customer. Redeem
            from Sell (10 pts = K1 by default).
          </p>
        </div>
      </div>

      {err ? <FormBanner tone="error">{err}</FormBanner> : null}
      {msg ? <FormBanner tone="ok">{msg}</FormBanner> : null}

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) =>
            setForm((f) => ({ ...f, enabled: e.target.checked }))
          }
        />
        Loyalty enabled
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <Input
          label="Earn pts / ZMW"
          type="number"
          min={0}
          max={10}
          step={0.5}
          value={form.earnPerKwacha}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              earnPerKwacha: Number(e.target.value) || 0,
            }))
          }
        />
        <Input
          label="Pts per ZMW off"
          type="number"
          min={1}
          max={100}
          value={form.redeemPtsPerKwacha}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              redeemPtsPerKwacha: Number(e.target.value) || 10,
            }))
          }
        />
        <Input
          label="Max redeem % of subtotal"
          type="number"
          min={5}
          max={50}
          value={Math.round(form.maxRedeemFraction * 100)}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              maxRedeemFraction: Math.min(
                0.5,
                Math.max(0.05, (Number(e.target.value) || 20) / 100),
              ),
            }))
          }
        />
      </div>

      <div className="rounded-xl border border-line bg-surface/50 p-3 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
          Active campaign (optional)
        </p>
        <Input
          label="Campaign name"
          value={form.campaignName}
          placeholder="Weekend double points"
          onChange={(e) =>
            setForm((f) => ({ ...f, campaignName: e.target.value }))
          }
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Multiplier"
            type="number"
            min={1}
            max={5}
            step={0.5}
            value={form.campaignMultiplier}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                campaignMultiplier: Number(e.target.value) || 1,
              }))
            }
          />
          <Input
            label="Ends at"
            type="datetime-local"
            value={form.campaignEndsAt}
            onChange={(e) =>
              setForm((f) => ({ ...f, campaignEndsAt: e.target.value }))
            }
          />
        </div>
        <p className="text-[11px] text-ink-soft">
          Clear the name or end date to turn the campaign off.
        </p>
      </div>

      <Button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save loyalty'}
      </Button>
    </form>
  )
}
