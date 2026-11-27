import {
  getBranchSelectValue,
  ORG_BRANCH_ID,
  setActiveBranchId,
} from '@/lib/branch'

/** Same-origin `/api` so phones on Wi‑Fi work (Vite proxies to the API). */
const API_BASE = import.meta.env.VITE_API_URL || '/api'

export type SessionUser = {
  id: string
  email: string
  fullName: string
  kind: 'platform' | 'business'
  role?: string
  businessId?: string
  businessName?: string
  permissions?: string[]
  /** retail | pharmacy | grocery | stationery | … */
  industry?: string
  modules?: {
    sell?: boolean
    inventory?: boolean
    finance?: boolean
    employees?: boolean
    crm?: boolean
    procurement?: boolean
    intelligence?: boolean
    pharmacy?: boolean
    perishables?: boolean
    labels?: boolean
    transfers?: boolean
  }
}

/**
 * Optional Bearer fallback (API tooling / legacy). Preferred session is the
 * httpOnly `nexora_session` cookie set by login — not readable by JS.
 */
const TOKEN_KEY = 'nexora-token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

/** Prefer cookie-only sessions: drop localStorage copy after login. */
export function clearClientToken() {
  localStorage.removeItem(TOKEN_KEY)
}

function isPublicPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/platform/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/phone-scan') ||
    pathname.startsWith('/docs') ||
    pathname.startsWith('/scan-bench')
  )
}

function authRedirectPath() {
  if (typeof window === 'undefined') return '/login'
  return window.location.pathname.startsWith('/platform')
    ? '/platform/login'
    : '/login'
}

export async function api<T>(
  path: string,
  options: RequestInit & {
    branchId?: string | null
    /** When true, 401 does not force navigation to /login (session probe). */
    skipAuthRedirect?: boolean
    /** Internal: one retry after clearing a stale branch id. */
    _branchRetry?: boolean
  } = {},
): Promise<T> {
  const {
    branchId: branchOverride,
    skipAuthRedirect,
    _branchRetry,
    ...fetchOpts
  } = options
  const headers = new Headers(fetchOpts.headers)
  if (!headers.has('Content-Type') && !(fetchOpts.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  // Cookie is primary; Bearer only if still present (migration / API tools)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (branchOverride !== undefined) {
    if (branchOverride) headers.set('X-Branch-Id', branchOverride)
  } else {
    const branchScope = getBranchSelectValue()
    if (branchScope) headers.set('X-Branch-Id', branchScope)
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOpts,
    headers,
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401) {
      clearClientToken()
      if (
        !skipAuthRedirect &&
        typeof window !== 'undefined' &&
        !isPublicPath(window.location.pathname)
      ) {
        window.location.assign(authRedirectPath())
      }
    }
    const errMsg =
      data.error || data.message || `Request failed (${res.status})`
    // Stale nexora-branch-id from another shop — clear and retry once
    if (
      !_branchRetry &&
      res.status === 400 &&
      typeof errMsg === 'string' &&
      errMsg.toLowerCase().includes('unknown branch')
    ) {
      setActiveBranchId(ORG_BRANCH_ID)
      return api<T>(path, {
        ...options,
        branchId: ORG_BRANCH_ID,
        _branchRetry: true,
      })
    }
    throw new Error(errMsg)
  }
  return data as T
}

export function loginRequest(email: string, password: string) {
  return api<{ token: string; user: SessionUser; shops?: unknown }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuthRedirect: true,
    },
  )
}

export function logoutRequest() {
  return api<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
    skipAuthRedirect: true,
  })
}

export function meRequest() {
  return api<{ user: SessionUser }>('/auth/me', { skipAuthRedirect: true })
}
