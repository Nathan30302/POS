import { useOfflineSync } from '@/context/OfflineSyncContext'

/** Subtle connectivity + offline queue badge for the shell. */
export function OnlineStatus({ compact = false }: { compact?: boolean }) {
  const { online, pendingCount, syncing, syncAll } = useOfflineSync()

  if (online && pendingCount === 0) {
    if (compact) {
      return (
        <span
          className="inline-flex h-10 w-8 shrink-0 items-center justify-center"
          aria-label="Online"
          title="Online"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.28)]" />
        </span>
      )
    }
    return (
      <span className="hidden items-center gap-1.5 text-[11px] text-ink-soft sm:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Online
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (online) void syncAll()
      }}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg font-semibold transition hover:brightness-110 ${
        compact ? 'h-10 px-2 text-[11px]' : 'min-h-8 px-2.5 py-1 text-[11px]'
      } ${
        online
          ? 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
          : 'bg-red-500/15 text-red-700 dark:text-red-300'
      }`}
      title={online ? 'Tap to sync queued sales' : 'You are offline'}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          online ? 'bg-amber-500' : 'bg-red-500'
        }`}
      />
      {online
        ? syncing
          ? 'Syncing…'
          : `${pendingCount} queued`
        : 'Offline'}
    </button>
  )
}
