import type { NextFunction, Request, Response } from 'express'
import { log } from './logger.js'

type Bucket = { count: number; resetAt: number }

const memoryBuckets = new Map<string, Bucket>()

type RedisLike = {
  incr(key: string): Promise<number>
  pexpire(key: string, ms: number): Promise<number>
  quit?(): Promise<void>
}

let redis: RedisLike | null = null
let redisTried = false

async function getRedis(): Promise<RedisLike | null> {
  if (redisTried) return redis
  redisTried = true
  const url = (process.env.REDIS_URL || '').trim()
  if (!url) return null
  try {
    const { default: Redis } = await import('ioredis')
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    })
    await client.connect().catch(() => undefined)
    // Probe
    await client.ping()
    redis = client
    log.info('rateLimit.redis', { enabled: true })
    return redis
  } catch (err) {
    log.warn('rateLimit.redis_unavailable', {
      err: err instanceof Error ? err.message : 'unknown',
    })
    redis = null
    return null
  }
}

function memoryHit(key: string, windowMs: number, max: number): {
  limited: boolean
  retryAfterSec: number
} {
  const now = Date.now()
  let bucket = memoryBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs }
    memoryBuckets.set(key, bucket)
  }
  bucket.count += 1
  if (bucket.count > max) {
    return {
      limited: true,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    }
  }
  return { limited: false, retryAfterSec: 0 }
}

async function redisHit(
  client: RedisLike,
  key: string,
  windowMs: number,
  max: number,
): Promise<{ limited: boolean; retryAfterSec: number }> {
  const redisKey = `rl:${key}`
  const count = await client.incr(redisKey)
  if (count === 1) {
    await client.pexpire(redisKey, windowMs)
  }
  if (count > max) {
    return {
      limited: true,
      retryAfterSec: Math.max(1, Math.ceil(windowMs / 1000)),
    }
  }
  return { limited: false, retryAfterSec: 0 }
}

/**
 * Rate limit — uses Redis when REDIS_URL is set and reachable; otherwise
 * in-memory (single-node). Safe for local demo without Redis.
 */
export function rateLimit(opts: {
  windowMs: number
  max: number
  key?: (req: Request) => string
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key =
      (opts.key?.(req) || req.ip || 'unknown') + ':' + (req.path || '')

    void (async () => {
      try {
        const client = await getRedis()
        const result = client
          ? await redisHit(client, key, opts.windowMs, opts.max)
          : memoryHit(key, opts.windowMs, opts.max)
        if (result.limited) {
          res.setHeader('Retry-After', String(result.retryAfterSec))
          return res
            .status(429)
            .json({ error: 'Too many requests — try again shortly' })
        }
        return next()
      } catch {
        // Fail open to memory on Redis errors so auth is not bricked
        const result = memoryHit(key, opts.windowMs, opts.max)
        if (result.limited) {
          res.setHeader('Retry-After', String(result.retryAfterSec))
          return res
            .status(429)
            .json({ error: 'Too many requests — try again shortly' })
        }
        return next()
      }
    })()
  }
}
