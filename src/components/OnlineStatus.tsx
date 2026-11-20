import { useOfflineSalesSync } from '@/hooks/useOfflineSalesSync'

/** Subtle connectivity + offline queue badge for the shell. */
export function OnlineStatus() {
  const { online, pendingCount, syncing, syncAll } = useOfflineSalesSync(true)

  if (online && pendingCount === 0) {
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
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
