import { describe, expect, it, vi } from 'vitest'
import { csrfOriginCheck } from './csrfOrigin.js'
import { SESSION_COOKIE } from './sessionCookie.js'

function mockRes() {
  const res: {
    statusCode: number
    body: unknown
    status: (n: number) => typeof res
    json: (b: unknown) => typeof res
  } = {
    statusCode: 200,
    body: null,
    status(n) {
      this.statusCode = n
      return this
    },
    json(b) {
      this.body = b
      return this
    },
  }
  return res
}

describe('csrfOriginCheck', () => {
  it('allows GET', () => {
    const next = vi.fn()
    csrfOriginCheck(
      { method: 'GET', headers: {}, cookies: {} } as never,
      mockRes() as never,
      next,
    )
    expect(next).toHaveBeenCalled()
  })

  it('allows Bearer mutations without Origin', () => {
    const next = vi.fn()
    csrfOriginCheck(
      {
        method: 'POST',
        headers: { authorization: 'Bearer tok' },
        cookies: { [SESSION_COOKIE]: 'x' },
      } as never,
      mockRes() as never,
      next,
    )
    expect(next).toHaveBeenCalled()
  })

  it('blocks cookie mutation without Origin', () => {
    const next = vi.fn()
    const res = mockRes()
    csrfOriginCheck(
      {
        method: 'POST',
        headers: { host: '127.0.0.1:4000' },
        cookies: { [SESSION_COOKIE]: 'x' },
      } as never,
      res as never,
      next,
    )
    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(403)
  })

  it('allows cookie mutation with matching Origin host', () => {
    const next = vi.fn()
    csrfOriginCheck(
      {
        method: 'POST',
        headers: {
          host: '127.0.0.1:4000',
          origin: 'http://127.0.0.1:5173',
        },
        cookies: { [SESSION_COOKIE]: 'x' },
      } as never,
      mockRes() as never,
      next,
    )
    expect(next).toHaveBeenCalled()
  })

  it('allows trycloudflare Origin in development', () => {
    const next = vi.fn()
    csrfOriginCheck(
      {
        method: 'POST',
        path: '/api/products',
        headers: {
          host: '127.0.0.1:4000',
          origin: 'https://example-shop.trycloudflare.com',
        },
        cookies: { [SESSION_COOKIE]: 'x' },
      } as never,
      mockRes() as never,
      next,
    )
    expect(next).toHaveBeenCalled()
  })

  it('allows Railway public domain Origin when Host differs', () => {
    const prev = process.env.RAILWAY_PUBLIC_DOMAIN
    process.env.RAILWAY_PUBLIC_DOMAIN = 'pos-production-b19cb8a5.up.railway.app'
    const next = vi.fn()
    try {
      csrfOriginCheck(
        {
          method: 'POST',
          path: '/api/products',
          headers: {
            host: '127.0.0.1:4000',
            origin: 'https://pos-production-b19cb8a5.up.railway.app',
          },
          cookies: { [SESSION_COOKIE]: 'x' },
        } as never,
        mockRes() as never,
        next,
      )
      expect(next).toHaveBeenCalled()
    } finally {
      if (prev === undefined) delete process.env.RAILWAY_PUBLIC_DOMAIN
      else process.env.RAILWAY_PUBLIC_DOMAIN = prev
    }
  })
})
