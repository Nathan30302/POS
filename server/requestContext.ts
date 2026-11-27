import type { NextFunction, Request, Response } from 'express'
import { randomBytes } from 'node:crypto'
import { log } from './logger.js'

declare global {
  namespace Express {
    interface Request {
      requestId?: string
    }
  }
}

/** Attach X-Request-Id and log method/path/status/duration (no bodies). */
export function requestContext(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const incoming = String(req.headers['x-request-id'] || '').trim()
  const requestId =
    incoming || randomBytes(8).toString('hex')
  req.requestId = requestId
  res.setHeader('X-Request-Id', requestId)

  const started = Date.now()
  res.on('finish', () => {
    // Skip noisy health probes in production logs if desired — always log 5xx
    const path = req.path || req.url
    if (
      process.env.NODE_ENV === 'production' &&
      res.statusCode < 400 &&
      (path === '/api/health' || path === '/api/ready')
    ) {
      return
    }
    log.info('http', {
      requestId,
      method: req.method,
      path,
      status: res.statusCode,
      ms: Date.now() - started,
    })
  })

  next()
}
