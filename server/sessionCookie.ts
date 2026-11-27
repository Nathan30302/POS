import type { Response } from 'express'

export const SESSION_COOKIE = 'nexora_session'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export function sessionCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProd,
    // Lax works with Vite same-origin proxy; production behind one site origin too
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SEVEN_DAYS_MS,
  }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions())
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, {
    ...sessionCookieOptions(),
    maxAge: 0,
  })
}

/** Prefer Authorization Bearer; fall back to httpOnly session cookie. */
export function extractAccessToken(req: {
  headers: { authorization?: string }
  cookies?: Record<string, string>
}): string | null {
  const header = req.headers.authorization
  if (header?.startsWith('Bearer ')) {
    const t = header.slice(7).trim()
    if (t) return t
  }
  const fromCookie = req.cookies?.[SESSION_COOKIE]
  if (typeof fromCookie === 'string' && fromCookie.trim()) {
    return fromCookie.trim()
  }
  return null
}
