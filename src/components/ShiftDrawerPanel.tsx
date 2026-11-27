import { useCallback, useEffect, useState } from 'react'
import { Banknote, Lock, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { formatZMW } from '@/lib/money'

export type CashShift = {
  id: string
  status: string
  openingFloat: number
  cashSalesTotal: number
  expectedCash: number | null
  declaredCash: number | null
  discrepancy: number | null
  discrepancyReason: string | null
  openedAt: string
  closedAt: string | null
  openedBy?: { id: string; fullName: string } | null
  branch?: { id: string; name: string } | null
}

type Props = {
  compact?: boolean
  onChanged?: (shift: CashShift | null) => void
}

export function ShiftDrawerPanel({ compact, onChanged }: Props) {
  const [shift, setShift] = useState<CashShift | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [floatAmt, setFloatAmt] = useState('100')
  const [declared, setDeclared] = useState('')
  const [discReason, setDiscReason] = useState('')
  const [closing, setClosing] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ shift: CashShift | null }>('/shifts/current')
      setShift(data.shift)
      onChanged?.(data.shift)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load shift')
    } finally {
      setLoading(false)
    }
  }, [onChanged])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function openShift() {
    setBusy(true)
    setError('')
    try {
      const openingFloat = Number(floatAmt)
      if (!Number.isFinite(openingFloat) || openingFloat < 0) {
        throw new Error('Enter a valid opening float')
      }
      const data = await api<{ shift: CashShift }>('/shifts/open', {
        method: 'POST',
        body: JSON.stringify({ openingFloat }),
      })
      setShift(data.shift)
      onChanged?.(data.shift)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Open failed')
    } finally {
      setBusy(false)
    }
  }

  async function closeShift() {
    if (!shift) return
    setBusy(true)
    setError('')
    try {
      const declaredCash = Number(declared)
      if (!Number.isFinite(declaredCash) || declaredCash < 0) {
        throw new Error('Enter declared cash in drawer')
      }
      const data = await api<{ shift: CashShift }>(`/shifts/${shift.id}/close`, {
        method: 'POST',
        body: JSON.stringify({
          declaredCash,
          discrepancyReason: discReason.trim() || undefined,
        }),
      })
      setShift(null)
      setClosing(false)
      setDeclared('')
      setDiscReason('')
      onChanged?.(null)
      // Keep last closed summary briefly via error/ok channel
      if (data.shift.discrepancy != null && Math.abs(data.shift.discrepancy) >= 1) {
        setError(
          `Closed · Δ ${formatZMW(data.shift.discrepancy)} (expected ${formatZMW(data.shift.expectedCash || 0)})`,
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Close failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className={`nx-card ${compact ? 'p-3' : 'p-4'}`}>
        <p className="text-xs text-ink-soft">Loading till…</p>
      </div>
    )
  }

  return (
    <div className={`nx-card space-y-3 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-royal">
            Cash drawer
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Banknote className="h-4 w-4 text-teal" />
            {shift ? 'Shift open' : 'No open shift'}
          </p>
          {shift ? (
            <p className="mt-0.5 text-xs text-ink-soft">
              Float {formatZMW(shift.openingFloat)}
              {shift.branch ? ` · ${shift.branch.name}` : ''}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-ink-soft">
              Open with opening float before cash sales.
            </p>
          )}
        </div>
        {shift ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
            <Unlock className="h-3 w-3" />
            Open
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold uppercase text-ink-soft ring-1 ring-line">
            <Lock className="h-3 w-3" />
            Closed
          </span>
        )}
      </div>

      {error ? <FormBanner tone="error">{error}</FormBanner> : null}

      {!shift ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[7rem] flex-1">
            <Input
              label="Opening float"
              type="number"
              min={0}
              step={1}
              value={floatAmt}
              onChange={(e) => setFloatAmt(e.target.value)}
            />
          </div>
          <Button
            type="button"
            disabled={busy}
            onClick={() => void openShift()}
            className="min-h-11"
          >
            {busy ? 'Opening…' : 'Open shift'}
          </Button>
        </div>
      ) : closing ? (
        <div className="space-y-2.5">
          <Input
            label="Declared cash in drawer"
            type="number"
            min={0}
            step={0.01}
            value={declared}
            onChange={(e) => setDeclared(e.target.value)}
          />
          <Input
            label="Discrepancy reason (if any)"
            value={discReason}
            onChange={(e) => setDiscReason(e.target.value)}
            placeholder="Short reason if count ≠ expected"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() => void closeShift()}
            >
              {busy ? 'Closing…' : 'Confirm close'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setClosing(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          onClick={() => setClosing(true)}
        >
          Close shift
        </Button>
      )}
    </div>
  )
}
