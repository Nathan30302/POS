import type { NextFunction, Request, Response } from 'express'
import { SESSION_COOKIE } from './sessionCookie.js'

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS'])

function hostFromUrl(raw: string | undefined): string | null {
  if (!raw) return null
  try {
    return new URL(raw).host.toLowerCase()
  } catch {
    return null
  }
}

/**
 * CSRF mitigation for cookie sessions.
 * State-changing requests that rely on the session cookie (no Bearer) must
 * send Origin/Referer matching an allowlisted CORS origin or the request Host.
 * Bearer API clients are exempt (not cookie CSRF-vulnerable the same way).
 */
export function csrfOriginCheck(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (SAFE.has(req.method)) return next()

  const auth = req.headers.authorization
  if (auth?.startsWith('Bearer ')) return next()

  // Public auth entrypoints — establishing/clearing session
  const path = (req.path || req.url || '').split('?')[0]
  if (
    path === '/api/auth/login' ||
    path === '/auth/login' ||
    path === '/api/auth/register' ||
    path === '/auth/register' ||
    path === '/api/auth/logout' ||
    path === '/auth/logout'
  ) {
    return next()
  }

  const hasCookie = Boolean(req.cookies?.[SESSION_COOKIE])
  if (!hasCookie) return next()

  const originHost = hostFromUrl(req.headers.origin)
  const refererHost = hostFromUrl(req.headers.referer)
  const sourceHost = originHost || refererHost
  if (!sourceHost) {
    return res.status(403).json({
      error: 'Missing Origin — cookie session mutations require a browser Origin',
    })
  }

  const requestHost = String(req.headers.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase()

  const corsRaw = (process.env.CORS_ORIGIN || '').trim()
  const allowed = new Set(
    corsRaw
      ? corsRaw
          .split(',')
          .map((s) => hostFromUrl(s.trim()))
          .filter((h): h is string => Boolean(h))
      : [],
  )
  if (requestHost) allowed.add(requestHost)

  // Public shop URL (named tunnel / Cloudflare) — required when Vite proxies
  // with changeOrigin and Host becomes 127.0.0.1:API_PORT
  const shopHost = hostFromUrl((process.env.SHOP_PUBLIC_ORIGIN || '').trim())
  if (shopHost) allowed.add(shopHost)

  // Railway public domain (same host as the deployed SPA) even if CORS_ORIGIN is stale
  const railwayDomain = (process.env.RAILWAY_PUBLIC_DOMAIN || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
  if (railwayDomain) allowed.add(railwayDomain)

  const forwarded = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
  if (forwarded) allowed.add(forwarded)

  // Vite / LAN / quick tunnels when CORS_ORIGIN unset (dev)
  if (process.env.NODE_ENV !== 'production') {
    allowed.add('localhost:5173')
    allowed.add('127.0.0.1:5173')
    if (
      sourceHost.endsWith('.trycloudflare.com') ||
      sourceHost.endsWith('.cfargotunnel.com')
    ) {
      allowed.add(sourceHost)
    }
  }

  if (!allowed.has(sourceHost)) {
    return res.status(403).json({ error: 'Origin not allowed for cookie session' })
  }

  return next()
}
