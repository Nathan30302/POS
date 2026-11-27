import { useCallback, useEffect, useState } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { canSeeCommand } from '@/lib/permissions'

type AlertRow = {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  createdAt: string
}

export function AlertsInbox() {
  const { user } = useAuth()
  const canSee = canSeeCommand(user?.role) || user?.role === 'BRANCH_MANAGER'
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<AlertRow[]>([])
  const [unread, setUnread] = useState(0)

  const load = useCallback(async () => {
    if (!canSee) return
    try {
      const data = await api<{
        notifications: AlertRow[]
        unreadCount: number
      }>('/notifications?limit=30')
      setRows(data.notifications)
      setUnread(data.unreadCount)
    } catch {
      // silent — managers only
    }
  }, [canSee])

  useEffect(() => {
    void load()
    if (!canSee) return
    const id = window.setInterval(() => void load(), 60000)
    return () => window.clearInterval(id)
  }, [canSee, load])

  if (!canSee) return null

  async function markAll() {
    await api('/notifications/read-all', { method: 'POST', body: '{}' })
    setUnread(0)
    setRows((r) => r.map((n) => ({ ...n, read: true })))
  }

  async function markOne(id: string) {
    await api(`/notifications/${id}/read`, { method: 'POST', body: '{}' })
    setRows((r) => r.map((n) => (n.id === id ? { ...n, read: true } : n)))
    setUnread((u) => Math.max(0, u - 1))
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-ink-soft transition hover:bg-brand-soft hover:text-ink"
        aria-label="Owner alerts"
        onClick={() => {
          setOpen((o) => !o)
          if (!open) void load()
        }}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] cursor-default"
            aria-label="Close alerts"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-[61] mt-2 w-[min(22rem,calc(100vw-1.25rem))] overflow-hidden rounded-2xl border border-line bg-card shadow-xl max-lg:fixed max-lg:inset-x-3 max-lg:top-[max(4.6rem,calc(env(safe-area-inset-top)+3.5rem))] max-lg:mt-0 max-lg:w-auto">
            <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
              <p className="text-sm font-semibold text-ink">Integrity alerts</p>
              {unread > 0 ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-royal"
                  onClick={() => void markAll()}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </button>
              ) : null}
            </div>
            <ul className="max-h-80 overflow-y-auto divide-y divide-line">
              {rows.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-ink-soft">
                  No alerts yet — voids, cash shortages, and stock shrink land
                  here.
                </li>
              ) : (
                rows.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`w-full px-3 py-2.5 text-left transition hover:bg-surface/60 ${
                        n.read ? 'opacity-70' : ''
                      }`}
                      onClick={() => void markOne(n.id)}
                    >
                      <p className="text-xs font-semibold text-ink">
                        {!n.read ? (
                          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-danger" />
                        ) : null}
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-soft">{n.body}</p>
                      <p className="mt-1 text-[10px] text-ink-soft">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  )
}
