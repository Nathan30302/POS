import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'

export function OnboardingPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    industry: 'stationery',
    currency: 'ZMW',
    phone: '',
    address: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/onboarding/complete', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          modules: {
            sell: true,
            inventory: true,
            finance: true,
            employees: true,
            crm: true,
            procurement: true,
            intelligence: true,
          },
          paymentMethods: ['CASH', 'MTN_MOMO', 'AIRTEL_MONEY', 'CARD'],
        }),
      })
      navigate('/app/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onboarding failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="rounded-[24px] border border-line bg-[#0b1224] p-5 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
          Welcome to NEXORA
        </p>
        <h2 className="font-display mt-2 text-3xl font-bold tracking-tight">
          Set up your shop
        </h2>
        <p className="mt-2 text-sm text-slate-300">
          Name the business once — Sell, Inventory, Team, and Pulse unlock from
          here.
        </p>
      </div>
      <form onSubmit={onSubmit} className="nx-card space-y-4 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-royal">
            Shop profile
          </p>
          <h2 className="font-display mt-1 text-xl font-bold text-ink">
            Basics
          </h2>
        </div>
        <Input
          label="Business name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Industry</span>
          <select
            className="nx-field"
            value={form.industry}
            onChange={(e) =>
              setForm((f) => ({ ...f, industry: e.target.value }))
            }
          >
            <option value="retail">General retail</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="chemist">Chemist</option>
            <option value="clinic">Clinic dispensary</option>
            <option value="grocery">Grocery / fresh</option>
            <option value="stationery">Stationery / school</option>
            <option value="general">Other</option>
          </select>
        </label>
        <Input
          label="Currency"
          value={form.currency}
          onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
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
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Saving…' : 'Finish setup'}
        </Button>
      </form>
    </div>
  )
}
