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
}

const TOKEN_KEY = 'nexora-token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`)
  }
  return data as T
}

export function loginRequest(email: string, password: string) {
  return api<{ token: string; user: SessionUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function meRequest() {
  return api<{ user: SessionUser }>('/auth/me')
}
