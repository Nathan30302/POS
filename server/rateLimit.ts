import type { NextFunction, Request, Response } from 'express'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/** Simple in-memory rate limit (single-node). Enough for v0.1 hardening. */
export function rateLimit(opts: {
  windowMs: number
  max: number
  key?: (req: Request) => string
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = (opts.key?.(req) || req.ip || 'unknown') + ':' + (req.path || '')
    const now = Date.now()
    let bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs }
      buckets.set(key, bucket)
    }
    bucket.count += 1
    if (bucket.count > opts.max) {
      const retry = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      res.setHeader('Retry-After', String(retry))
      return res.status(429).json({ error: 'Too many requests — try again shortly' })
    }
    return next()
  }
}
