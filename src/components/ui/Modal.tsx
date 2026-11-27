import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

type Props = {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
  /** Full-screen sheet — only when truly needed */
  fullScreen?: boolean
  footer?: ReactNode
  /** Extra control in the header (e.g. Done) — always visible */
  headerAction?: ReactNode
}

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'

export function Modal({
  title,
  children,
  onClose,
  wide,
  fullScreen,
  footer,
  headerAction,
}: Props) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  // Lock page scroll so only the sheet moves on phones
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Focus trap + Escape + restore focus
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    if (!panel) return

    const focusables = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1,
      )

    const nodes = focusables()
    ;(nodes[0] || panel).focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) {
        e.preventDefault()
        panel?.focus()
        return
      }
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused.current?.focus?.()
    }
  }, [onClose])

  const tree = (
    <div
      className="nx-modal-backdrop nx-scrim fixed inset-0 z-[80]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`nx-modal-panel border border-line/80 outline-none lg:rounded-[var(--radius-xl)] ${
          wide || fullScreen ? 'lg:max-w-2xl' : 'lg:max-w-lg'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-card px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-ink sm:px-5 sm:py-4">
          <h2
            id={titleId}
            className="font-display min-w-0 truncate text-lg font-semibold tracking-tight text-ink"
          >
            {title}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-ink-soft transition hover:bg-brand-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal/35"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="nx-modal-body p-4 sm:p-5">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-line bg-card px-4 py-3 pb-[max(0.85rem,env(safe-area-inset-bottom))] text-ink sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return tree
  return createPortal(tree, document.body)
}
