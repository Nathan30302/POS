import { useCallback, useState } from 'react'
import { getRole, setRole, type AppRole } from '@/lib/roles'

export function useRole() {
  const [role, setRoleState] = useState<AppRole>(() => getRole())

  const changeRole = useCallback((next: AppRole) => {
    setRole(next)
    setRoleState(next)
  }, [])

  return {
    role,
    setRole: changeRole,
    isOwner: role === 'owner',
    isStaff: role === 'staff',
  }
}
