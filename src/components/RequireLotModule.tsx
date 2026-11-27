import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { hasLotModule } from '@/lib/industry'
import { businessHomePath } from '@/lib/permissions'

/** Pharmacy / Perishables routes — redirect if shop type has no lot module. */
export function RequireLotModule({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (!hasLotModule(user)) {
    return (
      <Navigate
        to={businessHomePath(user?.permissions, user?.role)}
        replace
      />
    )
  }
  return children
}
