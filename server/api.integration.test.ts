/**
 * API integration against the Express app (in-process) using the seeded demo DB.
 * Requires: npm run db:seed (or existing demo data).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Server } from 'node:http'
import app from './index.js'

let server: Server
let api = ''

async function req(
  path: string,
  opts: { method?: string; token?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`
  const res = await fetch(`${api}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

beforeAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', () => resolve())
    server.on('error', reject)
  })
  const addr = server.address()
  if (!addr || typeof addr === 'string') throw new Error('no listen port')
  api = `http://127.0.0.1:${addr.port}/api`
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
})

describe('API auth + RBAC + tenant', () => {
  let ownerToken = ''
  let cashierToken = ''
  let ownerBiz = ''

  it('logs in owner and cashier', async () => {
    const owner = await req('/auth/login', {
      method: 'POST',
      body: { email: 'owner@demo.shop', password: 'DemoOwner1!' },
    })
    expect(owner.status).toBe(200)
    expect(owner.data.token).toBeTruthy()
    ownerToken = owner.data.token
    ownerBiz = owner.data.user.businessId

    const cash = await req('/auth/login', {
      method: 'POST',
      body: { email: 'cashier@demo.shop', password: 'DemoCash1!' },
    })
    expect(cash.status).toBe(200)
    cashierToken = cash.data.token
  })

  it('rejects invalid credentials', async () => {
    const bad = await req('/auth/login', {
      method: 'POST',
      body: { email: 'owner@demo.shop', password: 'wrong' },
    })
    expect(bad.status).toBe(401)
  })

  it('cashier cannot list sales (RBAC)', async () => {
    const res = await req('/sales', { token: cashierToken })
    expect(res.status).toBe(403)
  })

  it('owner can list products in own tenant', async () => {
    const res = await req('/products', { token: ownerToken })
    expect(res.status).toBe(200)
    expect(Array.isArray(res.data.products)).toBe(true)
    expect(res.data.products.length).toBeGreaterThan(0)
  })

  it('blocks cross-tenant sale using another shop product id', async () => {
    const products = await req('/products', { token: ownerToken })
    const productId = products.data.products[0].id as string

    const stamp = Date.now()
    const email = `iso-${stamp}@example.com`
    const reg = await req('/auth/register', {
      method: 'POST',
      body: {
        businessName: `Iso Shop ${stamp}`,
        industry: 'retail',
        ownerName: 'Iso',
        ownerEmail: email,
        ownerPassword: 'IsoPass1!',
        currency: 'ZMW',
      },
    })
    expect(reg.status).toBe(201)

    const plat = await req('/auth/login', {
      method: 'POST',
      body: { email: 'admin@nexora.app', password: 'NexoraAdmin1!' },
    })
    const list = await req(
      `/platform/businesses?q=${encodeURIComponent(`Iso Shop ${stamp}`)}&pageSize=20`,
      { token: plat.data.token },
    )
    expect(list.data.total).toBeGreaterThanOrEqual(1)
    const pending = (list.data.businesses || []).find(
      (b: { name: string }) => b.name === `Iso Shop ${stamp}`,
    )
    expect(pending).toBeTruthy()
    await req(`/platform/businesses/${pending.id}/status`, {
      method: 'PATCH',
      token: plat.data.token,
      body: { status: 'TRIAL' },
    })

    const other = await req('/auth/login', {
      method: 'POST',
      body: { email, password: 'IsoPass1!' },
    })
    expect(other.status).toBe(200)
    expect(other.data.user.businessId).not.toBe(ownerBiz)

    const cross = await req('/sales', {
      method: 'POST',
      token: other.data.token,
      body: {
        lines: [{ productId, quantity: 1 }],
        discount: 0,
        paymentMethod: 'CASH',
      },
    })
    expect(cross.status).toBeGreaterThanOrEqual(400)
  })

  it('completes a cash sale for owner', async () => {
    const products = await req('/products', { token: ownerToken })
    const p = (products.data.products || []).find(
      (x: { stockQuantity: number }) => x.stockQuantity > 0,
    )
    expect(p).toBeTruthy()
    const sale = await req('/sales', {
      method: 'POST',
      token: ownerToken,
      body: {
        lines: [{ productId: p.id, quantity: 1 }],
        discount: 0,
        paymentMethod: 'CASH',
        notes: 'vitest sale',
      },
    })
    expect(sale.status).toBe(201)
    expect(sale.data.sale?.id).toBeTruthy()
  })

  it('lists memberships and rejects switch to unknown shop', async () => {
    const list = await req('/auth/memberships', { token: ownerToken })
    expect(list.status).toBe(200)
    expect(Array.isArray(list.data.shops)).toBe(true)
    expect(list.data.shops.length).toBeGreaterThanOrEqual(1)
    expect(list.data.currentBusinessId).toBe(ownerBiz)

    const bad = await req('/auth/switch-business', {
      method: 'POST',
      token: ownerToken,
      body: { businessId: 'does-not-exist' },
    })
    expect(bad.status).toBe(403)

    const same = await req('/auth/switch-business', {
      method: 'POST',
      token: ownerToken,
      body: { businessId: ownerBiz },
    })
    expect(same.status).toBe(200)
    expect(same.data.token).toBeTruthy()
    expect(same.data.user.businessId).toBe(ownerBiz)
  })

  it('accepts httpOnly session cookie for /auth/me', async () => {
    const loginRes = await fetch(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@demo.shop',
        password: 'DemoOwner1!',
      }),
    })
    expect(loginRes.status).toBe(200)
    const setCookie = loginRes.headers.getSetCookie?.() || []
    const raw =
      setCookie.find((c) => c.startsWith('nexora_session=')) ||
      loginRes.headers.get('set-cookie') ||
      ''
    expect(raw).toContain('nexora_session=')
    expect(raw.toLowerCase()).toContain('httponly')

    const cookiePair = String(raw).split(';')[0]
    const me = await fetch(`${api}/auth/me`, {
      headers: { Cookie: cookiePair },
    })
    const data = await me.json()
    expect(me.status).toBe(200)
    expect(data.user?.email).toBe('owner@demo.shop')
  })
})

describe('Platform directory scale (pagination)', () => {
  it('lists with page/pageSize and search without loading all rows', async () => {
    const { prisma } = await import('./prisma.js')
    const stamp = Date.now()
    const N = 24
    const ids: string[] = []

    for (let i = 0; i < N; i++) {
      const biz = await prisma.business.create({
        data: {
          name: `ScaleBiz ${stamp}-${String(i).padStart(2, '0')}`,
          slug: `scale-${stamp}-${i}`,
          industry: 'retail',
          status: i % 3 === 0 ? 'PENDING_APPROVAL' : 'TRIAL',
          plan: i % 2 === 0 ? 'starter' : 'growth',
          modulesJson: '{}',
          settingsJson: '{}',
        },
      })
      ids.push(biz.id)
      await prisma.branch.create({
        data: {
          businessId: biz.id,
          name: 'Main Branch',
          isMain: true,
        },
      })
    }

    try {
      const plat = await req('/auth/login', {
        method: 'POST',
        body: { email: 'admin@nexora.app', password: 'NexoraAdmin1!' },
      })
      expect(plat.status).toBe(200)
      const token = plat.data.token as string

      const page1 = await req('/platform/businesses?page=1&pageSize=5', {
        token,
      })
      expect(page1.status).toBe(200)
      expect(page1.data.businesses).toHaveLength(5)
      expect(page1.data.page).toBe(1)
      expect(page1.data.pageSize).toBe(5)
      expect(page1.data.total).toBeGreaterThanOrEqual(N)
      expect(page1.data.totalPages).toBeGreaterThanOrEqual(Math.ceil(N / 5))

      const page2 = await req('/platform/businesses?page=2&pageSize=5', {
        token,
      })
      expect(page2.status).toBe(200)
      expect(page2.data.businesses).toHaveLength(5)
      const ids1 = new Set(
        page1.data.businesses.map((b: { id: string }) => b.id),
      )
      for (const row of page2.data.businesses) {
        expect(ids1.has(row.id)).toBe(false)
      }

      const search = await req(
        `/platform/businesses?q=${encodeURIComponent(`ScaleBiz ${stamp}`)}&pageSize=100`,
        { token },
      )
      expect(search.status).toBe(200)
      expect(search.data.total).toBe(N)
      expect(search.data.businesses.length).toBe(N)

      const pendingOnly = await req(
        `/platform/businesses?q=${encodeURIComponent(`ScaleBiz ${stamp}`)}&status=PENDING_APPROVAL&pageSize=100`,
        { token },
      )
      expect(pendingOnly.status).toBe(200)
      expect(pendingOnly.data.total).toBe(
        ids.filter((_, i) => i % 3 === 0).length,
      )
    } finally {
      await prisma.business.deleteMany({ where: { id: { in: ids } } })
    }
  })
})
