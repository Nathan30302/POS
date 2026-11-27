import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftRight,
  Check,
  Package,
  Send,
  X,
} from 'lucide-react'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

type Branch = { id: string; name: string; code?: string | null }
type ProductLite = { id: string; name: string; stockQuantity?: number }

type TransferItem = {
  id: string
  productId: string
  productName: string
  requestedQty: number
  approvedQty: number | null
  dispatchedQty: number
  receivedQty: number
  discrepancy: number
}

type Transfer = {
  id: string
  status: string
  notes: string | null
  rejectReason: string | null
  discrepancyNote: string | null
  fromBranch: Branch
  toBranch: Branch
  requestedAt: string
  items: TransferItem[]
}

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  DISPATCHED: 'In transit',
  PARTIAL: 'Partial receive',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}

export function TransfersPage() {
  const { can } = useAuth()
  const canRequest = can('transfer_request')
  const canApprove = can('transfer_approve')
  const canReceive = can('transfer_receive')

  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [products, setProducts] = useState<ProductLite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)

  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [notes, setNotes] = useState('')
  const [lineProductId, setLineProductId] = useState('')
  const [lineQty, setLineQty] = useState(1)
  const [draftItems, setDraftItems] = useState<
    Array<{ productId: string; name: string; quantity: number }>
  >([])

  const [receiveFor, setReceiveFor] = useState<Transfer | null>(null)
  const [recvQty, setRecvQty] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [t, b, p] = await Promise.all([
        api<{ transfers: Transfer[] }>('/transfers'),
        api<{ branches: Branch[] }>('/branches'),
        api<{ products: ProductLite[] }>('/products'),
      ])
      setTransfers(t.transfers)
      setBranches(b.branches)
      setProducts(p.products)
      setFromId((prev) => prev || b.branches[0]?.id || '')
      setToId((prev) => prev || b.branches[1]?.id || b.branches[0]?.id || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transfers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const productName = useMemo(() => {
    const m = new Map(products.map((p) => [p.id, p.name]))
    return (id: string) => m.get(id) || id
  }, [products])

  function flash(msg: string) {
    setOk(msg)
    window.setTimeout(() => setOk(''), 2200)
  }

  function addLine() {
    if (!lineProductId || lineQty < 1) return
    setDraftItems((prev) => {
      const existing = prev.find((x) => x.productId === lineProductId)
      if (existing) {
        return prev.map((x) =>
          x.productId === lineProductId
            ? { ...x, quantity: x.quantity + lineQty }
            : x,
        )
      }
      return [
        ...prev,
        {
          productId: lineProductId,
          name: productName(lineProductId),
          quantity: lineQty,
        },
      ]
    })
    setLineQty(1)
  }

  async function submitRequest() {
    if (!canRequest || draftItems.length === 0) return
    setBusy(true)
    setError('')
    try {
      await api('/transfers', {
        method: 'POST',
        body: JSON.stringify({
          fromBranchId: fromId,
          toBranchId: toId,
          notes: notes.trim() || undefined,
          items: draftItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        }),
      })
      setDraftItems([])
      setNotes('')
      flash('Transfer requested')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  async function act(
    id: string,
    action: 'approve' | 'reject' | 'dispatch',
    body?: unknown,
  ) {
    setBusy(true)
    setError('')
    try {
      await api(`/transfers/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(body || {}),
      })
      flash(
        action === 'approve'
          ? 'Approved'
          : action === 'reject'
            ? 'Rejected'
            : 'Dispatched',
      )
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function submitReceive() {
    if (!receiveFor) return
    setBusy(true)
    setError('')
    try {
      await api(`/transfers/${receiveFor.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          finalize: true,
          items: receiveFor.items.map((i) => ({
            productId: i.productId,
            receivedQty:
              recvQty[i.productId] ??
              Math.max(0, i.dispatchedQty - i.receivedQty),
          })),
        }),
      })
      setReceiveFor(null)
      flash('Transfer received')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Receive failed')
    } finally {
      setBusy(false)
    }
  }

  function openReceive(t: Transfer) {
    const initial: Record<string, number> = {}
    for (const i of t.items) {
      initial[i.productId] = Math.max(0, i.dispatchedQty - i.receivedQty)
    }
    setRecvQty(initial)
    setReceiveFor(t)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHero
        eyebrow="Multi-branch"
        title="Stock transfers"
        actions={
          <p className="text-sm text-ink-soft">
            Request → approve → dispatch → receive
          </p>
        }
      />

      {error ? <FormBanner tone="error">{error}</FormBanner> : null}
      {ok ? <FormBanner tone="ok">{ok}</FormBanner> : null}

      {canRequest && branches.length > 1 ? (
        <section className="nx-card space-y-4 p-5">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-royal" />
            <h2 className="font-semibold text-ink">New transfer request</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                From
              </span>
              <select
                value={fromId}
                onChange={(e) => setFromId(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-royal"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                To
              </span>
              <select
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-royal"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_6rem_auto]">
            <select
              value={lineProductId}
              onChange={(e) => setLineProductId(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-royal"
            >
              <option value="">Select product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Input
              label="Qty"
              type="number"
              min={1}
              value={lineQty}
              onChange={(e) => setLineQty(Number(e.target.value) || 1)}
            />
            <Button type="button" variant="secondary" onClick={addLine}>
              Add
            </Button>
          </div>
          {draftItems.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {draftItems.map((i) => (
                <li
                  key={i.productId}
                  className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2"
                >
                  <span>
                    {i.name} × {i.quantity}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-semibold text-danger"
                    onClick={() =>
                      setDraftItems((prev) =>
                        prev.filter((x) => x.productId !== i.productId),
                      )
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <Input
            label="Notes"
            placeholder="Optional"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button
            type="button"
            disabled={busy || draftItems.length === 0 || fromId === toId}
            onClick={() => void submitRequest()}
          >
            <Send className="h-4 w-4" />
            Submit request
          </Button>
        </section>
      ) : null}

      <section className="nx-card p-0 overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-semibold text-ink">Open & recent</h2>
          <p className="text-xs text-ink-soft">
            Short qty vs dispatched is flagged as discrepancy
          </p>
        </div>
        {loading ? (
          <p className="p-6 text-sm text-ink-soft">Loading…</p>
        ) : transfers.length === 0 ? (
          <p className="p-6 text-sm text-ink-soft">No transfers yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {transfers.map((t) => (
              <li key={t.id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">
                      {t.fromBranch.name} → {t.toBranch.name}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {STATUS_LABEL[t.status] || t.status} ·{' '}
                      {new Date(t.requestedAt).toLocaleString()}
                    </p>
                    {t.rejectReason ? (
                      <p className="mt-1 text-xs text-danger">{t.rejectReason}</p>
                    ) : null}
                    {t.discrepancyNote ||
                    t.items.some((i) => i.discrepancy > 0) ? (
                      <p className="mt-1 text-xs font-medium text-amber-600">
                        Discrepancy flagged
                        {t.discrepancyNote ? ` — ${t.discrepancyNote}` : ''}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canApprove && t.status === 'REQUESTED' ? (
                      <>
                        <Button
                          type="button"
                          className="min-h-9 px-3 py-1.5 text-xs"
                          disabled={busy}
                          onClick={() => void act(t.id, 'approve')}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          type="button"
                          className="min-h-9 px-3 py-1.5 text-xs"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            const reason = window.prompt('Reject reason')
                            if (reason && reason.trim().length >= 3) {
                              void act(t.id, 'reject', {
                                reason: reason.trim(),
                              })
                            }
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {canApprove && t.status === 'APPROVED' ? (
                      <Button
                        type="button"
                        className="min-h-9 px-3 py-1.5 text-xs"
                        disabled={busy}
                        onClick={() => void act(t.id, 'dispatch')}
                      >
                        <Package className="h-3.5 w-3.5" />
                        Dispatch
                      </Button>
                    ) : null}
                    {canReceive &&
                    (t.status === 'DISPATCHED' || t.status === 'PARTIAL') ? (
                      <Button
                        type="button"
                        className="min-h-9 px-3 py-1.5 text-xs"
                        disabled={busy}
                        onClick={() => openReceive(t)}
                      >
                        Receive
                      </Button>
                    ) : null}
                  </div>
                </div>
                <ul className="space-y-1 text-sm text-ink-soft">
                  {t.items.map((i) => (
                    <li key={i.id}>
                      {i.productName}: req {i.requestedQty}
                      {i.approvedQty != null ? ` · appr ${i.approvedQty}` : ''}
                      {i.dispatchedQty
                        ? ` · sent ${i.dispatchedQty}`
                        : ''}
                      {i.receivedQty ? ` · recv ${i.receivedQty}` : ''}
                      {i.discrepancy > 0
                        ? ` · short ${i.discrepancy}`
                        : ''}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>

      {receiveFor ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="nx-card w-full max-w-md space-y-4 p-5">
            <h3 className="font-semibold text-ink">Receive transfer</h3>
            <p className="text-xs text-ink-soft">
              Partial OK — finalize writes discrepancy for short lines
            </p>
            <ul className="space-y-3">
              {receiveFor.items.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm">
                    {i.productName}
                    <span className="block text-xs text-ink-soft">
                      Remaining {i.dispatchedQty - i.receivedQty}
                    </span>
                  </span>
                  <Input
                    label="Recv"
                    type="number"
                    min={0}
                    max={i.dispatchedQty - i.receivedQty}
                    className="w-24"
                    value={recvQty[i.productId] ?? 0}
                    onChange={(e) =>
                      setRecvQty((prev) => ({
                        ...prev,
                        [i.productId]: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setReceiveFor(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void submitReceive()}
              >
                Confirm receive
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
