import {
  createContext,
  useContext,
  type ReactNode,
} from 'react'
import { useOfflineSalesSync } from '@/hooks/useOfflineSalesSync'

type OfflineSyncValue = ReturnType<typeof useOfflineSalesSync>

const OfflineSyncContext = createContext<OfflineSyncValue | null>(null)

/** Single coordinator for offline sale sync (avoid duplicate mounts racing). */
export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const value = useOfflineSalesSync(true)
  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  )
}

export function useOfflineSync() {
  const ctx = useContext(OfflineSyncContext)
  if (!ctx) {
    throw new Error('useOfflineSync must be used within OfflineSyncProvider')
  }
  return ctx
}
