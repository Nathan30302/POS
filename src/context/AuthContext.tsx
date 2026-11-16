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
  getToken,
  loginRequest,
  meRequest,
  setToken,
  type SessionUser,
} from '@/lib/api'
import { hasPermission, type Permission } from '@/lib/permissions'

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
    if (!getToken()) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const { user: next } = await meRequest()
      setUser(next)
    } catch {
      setToken(null)
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
    setToken(token)
    setUser(next)
    return next
  }, [])

  const logout = useCallback(() => {
    setToken(null)
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
