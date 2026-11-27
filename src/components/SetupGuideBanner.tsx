import { Check, ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'

type SetupProgress = {
  hasBranch: boolean
  productCount: number
  profileNameSet: boolean
  progressComplete: boolean
  doneAt: string | null
  dismissedAt: string | null
  showGuide: boolean
}

type Step = {
  id: string
  title: string
  detail: string
  to: string
  done: boolean
}

export function SetupGuideBanner() {
  const { user, isOwnerLike } = useAuth()
  const [setup, setSetup] = useState<SetupProgress | null>(null)
  const [busy, setBusy] = useState(false)
  const [hiddenLocally, setHiddenLocally] = useState(false)

  const load = useCallback(async () => {
    if (!isOwnerLike || user?.kind !== 'business') {
      setSetup(null)
      return
    }
    try {
      const data = await api<{ setup?: SetupProgress }>('/business/me')
      setSetup(data.setup ?? null)
    } catch {
      setSetup(null)
    }
  }, [isOwnerLike, user?.kind])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  async function persist(patch: {
    setupGuideDoneAt?: string
    setupGuideDismissedAt?: string
  }) {
    setBusy(true)
    try {
      await api('/business/me', {
        method: 'PATCH',
        body: JSON.stringify({ settings: patch }),
      })
      setHiddenLocally(true)
      setSetup((s) =>
        s
          ? {
              ...s,
              showGuide: false,
              doneAt: patch.setupGuideDoneAt ?? s.doneAt,
              dismissedAt: patch.setupGuideDismissedAt ?? s.dismissedAt,
            }
          : s,
      )
    } catch {
      /* keep banner visible */
    } finally {
      setBusy(false)
    }
  }

  if (!isOwnerLike || hiddenLocally || !setup?.showGuide) return null

  const steps: Step[] = [
    {
      id: 'branch',
      title: 'Main branch ready',
      detail: setup.hasBranch
        ? 'Your main branch is live — sales will tag to it.'
        : 'Opening Settings creates your main branch if needed.',
      to: '/app/settings',
      done: setup.hasBranch,
    },
    {
      id: 'profile',
      title: 'Confirm shop details',
      detail: 'Check your shop name and receipt info in Settings.',
      to: '/app/settings',
      done: setup.profileNameSet,
    },
    {
      id: 'products',
      title: 'Add your first products',
      detail: 'Put items into Inventory so you can sell them.',
      to: '/app/products',
      done: setup.productCount >= 1,
    },
    {
      id: 'shift',
      title: 'Open Sell and start a shift',
      detail: 'Go to Sell, open the cash drawer shift, then take a sale.',
      to: '/app/checkout',
      done: false,
    },
    {
      id: 'team',
      title: 'Invite your team (optional)',
      detail: 'Add cashiers in Team — watch your plan seat limit.',
      to: '/app/team',
      done: false,
    },
  ]

  const doneCount = steps.filter((s) => s.done).length

  return (
    <section
      className="mb-4 rounded-2xl border border-teal/30 bg-teal/10 p-4 sm:p-5"
      aria-label="Getting started"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal">
            Getting started
          </p>
          <h2 className="mt-1 font-display text-lg font-bold tracking-tight text-ink sm:text-xl">
            {setup.hasBranch
              ? 'Your shop is approved — finish setup'
              : 'Set up your shop in a few steps'}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            {doneCount} of {steps.length} checked · this tip hides when you
            finish or dismiss it.
          </p>
        </div>
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-soft transition hover:bg-card hover:text-ink"
          aria-label="Dismiss setup guide"
          disabled={busy}
          onClick={() =>
            void persist({
              setupGuideDismissedAt: new Date().toISOString(),
            })
          }
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ol className="mt-4 space-y-2">
        {steps.map((step, index) => (
          <li key={step.id}>
            <Link
              to={step.to}
              className="flex items-start gap-3 rounded-xl border border-line/70 bg-card/80 px-3 py-2.5 transition hover:border-teal/40 hover:bg-card"
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                  step.done
                    ? 'bg-teal text-white'
                    : 'border border-line bg-surface text-ink-soft'
                }`}
                aria-hidden
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-semibold text-ink">
                  {step.title}
                  <ChevronRight className="h-3.5 w-3.5 text-ink-soft" />
                </span>
                <span className="mt-0.5 block text-xs text-ink-soft">
                  {step.detail}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={busy}
          onClick={() =>
            void persist({ setupGuideDoneAt: new Date().toISOString() })
          }
        >
          I&apos;ve finished
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() =>
            void persist({
              setupGuideDismissedAt: new Date().toISOString(),
            })
          }
        >
          Dismiss
        </Button>
        <Link
          to="/app/guide"
          className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-teal hover:underline"
        >
          How to use
        </Link>
      </div>
    </section>
  )
}
