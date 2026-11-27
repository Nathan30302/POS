import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  clearClientToken,
  loginRequest,
  logoutRequest,
  meRequest,
  setToken,
  type SessionUser,
} from '@/lib/api'
import { clearActiveBranchId } from '@/lib/branch'
import { bootstrapActiveBranch } from '@/lib/bootstrapBranch'
import { hasPermission, type Permission } from '@/lib/permissions'
import { prefetchFloorRoutes } from '@/lib/prefetchRoute'

type AuthContextValue = {
  user: SessionUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<SessionUser>
  logout: () => void
  refresh: () => Promise<void>
  isPlatform: boolean
  isOwnerLike: boolean
  can: (permission: Permission) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      // Cookie session (or legacy Bearer) — always probe /me
      const { user: next } = await meRequest()
      setUser(next)
      if (next.kind === 'business' && next.businessId) {
        await bootstrapActiveBranch().catch(() => undefined)
      }
    } catch {
      clearClientToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: next } = await loginRequest(email, password)
    // Cookie is primary; keep Bearer too so phones / tunnels still work if
    // the httpOnly cookie is blocked or CSRF Host rewriting misfires.
    if (token) setToken(token)
    setUser(next)
    if (next.kind === 'business') {
      prefetchFloorRoutes()
      if (next.businessId) {
        await bootstrapActiveBranch().catch(() => undefined)
      }
    }
    return next
  }, [])

  useEffect(() => {
    if (!loading && user?.kind === 'business') prefetchFloorRoutes()
  }, [loading, user?.kind])

  const logout = useCallback(() => {
    void logoutRequest().catch(() => undefined)
    clearClientToken()
    clearActiveBranchId()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      logout,
      refresh,
      isPlatform: user?.kind === 'platform',
      isOwnerLike:
        user?.kind === 'business' &&
        ['OWNER', 'ADMIN'].includes(user.role || ''),
      can: (permission: Permission) =>
        user?.kind === 'business'
          ? hasPermission(user.permissions, user.role, permission)
          : false,
    }),
    [user, loading, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
