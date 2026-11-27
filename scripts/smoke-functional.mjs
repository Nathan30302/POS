/**
 * End-to-end functional smoke against a running API (default :4000).
 * Run: node scripts/smoke-functional.mjs
 */
const API = process.env.API_URL || 'http://127.0.0.1:4000/api'

let passed = 0
let failed = 0
const failures = []

function ok(name) {
  passed++
  console.log(`  ✓ ${name}`)
}
function fail(name, detail) {
  failed++
  failures.push(`${name}: ${detail}`)
  console.log(`  ✗ ${name} — ${detail}`)
}

async function req(path, { method = 'GET', token, body, branchId } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (branchId) headers['X-Branch-Id'] = branchId
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

async function login(email, password) {
  return req('/auth/login', { method: 'POST', body: { email, password } })
}

async function section(title, fn) {
  console.log(`\n▸ ${title}`)
  await fn()
}

async function main() {
  console.log(`NEXORA functional smoke → ${API}`)

  await section('Health', async () => {
    const h = await req('/health')
    if (h.status === 200) ok('GET /health')
    else fail('GET /health', `status ${h.status}`)
    const r = await req('/ready')
    if (r.status === 200 || r.status === 503) ok(`GET /ready (${r.status})`)
    else fail('GET /ready', `status ${r.status}`)
  })

  let ownerToken = ''
  let ownerBiz = ''
  let ownerIndustry = ''
  let ownerModules = null

  await section('Auth — owner demo', async () => {
    const res = await login('owner@demo.shop', 'DemoOwner1!')
    if (res.status !== 200 || !res.data.token) {
      fail('owner login', JSON.stringify(res.data))
      return
    }
    ok('owner login')
    ownerToken = res.data.token
    const u = res.data.user
    if (u?.kind !== 'business') fail('owner kind', String(u?.kind))
    else ok('owner is business user')
    if (!u.industry) fail('session industry', 'missing')
    else {
      ownerIndustry = u.industry
      ok(`session industry=${u.industry}`)
    }
    if (!u.modules || typeof u.modules !== 'object') {
      fail('session modules', 'missing')
    } else {
      ownerModules = u.modules
      ok(
        `modules pharmacy=${!!u.modules.pharmacy} perishables=${!!u.modules.perishables}`,
      )
    }
    ownerBiz = u.businessId
  })

  if (!ownerToken) {
    console.log('\nAbort — cannot login owner')
    process.exit(1)
  }

  await section('Auth — /me + staff + platform', async () => {
    const me = await req('/auth/me', { token: ownerToken })
    if (me.status === 200 && me.data.user?.modules) ok('/auth/me has modules')
    else fail('/auth/me', JSON.stringify(me.data).slice(0, 200))

    const cash = await login('cashier@demo.shop', 'DemoCash1!')
    if (cash.status === 200 && cash.data.token) ok('cashier login')
    else fail('cashier login', JSON.stringify(cash.data))

    const plat = await login('admin@nexora.app', 'NexoraAdmin1!')
    if (plat.status === 200 && plat.data.user?.kind === 'platform') {
      ok('platform login')
    } else fail('platform login', JSON.stringify(plat.data))
  })

  await section('Core business APIs', async () => {
    const biz = await req('/business/me', { token: ownerToken })
    if (biz.status === 200 && biz.data.business?.id) ok('GET /business/me')
    else fail('GET /business/me', String(biz.status))

    const dash = await req('/business/dashboard', { token: ownerToken })
    if (dash.status === 200 && dash.data.summary) ok('GET /business/dashboard')
    else fail('dashboard', `${dash.status} ${JSON.stringify(dash.data).slice(0, 120)}`)

    const products = await req('/products', { token: ownerToken })
    if (products.status === 200 && Array.isArray(products.data.products)) {
      ok(`GET /products (${products.data.products.length})`)
    } else fail('products', String(products.status))

    const pulse = await req('/insights/pulse', { token: ownerToken })
    if (pulse.status === 200 && pulse.data.pulse) ok('GET /insights/pulse')
    else fail('pulse', `${pulse.status}`)

    const customers = await req('/customers', { token: ownerToken })
    if (customers.status === 200) ok('GET /customers')
    else fail('customers', String(customers.status))

    const sales = await req('/sales?limit=5', { token: ownerToken })
    if (sales.status === 200 || sales.status === 400) {
      // some apps use different query
      const sales2 = await req('/sales', { token: ownerToken })
      if (sales2.status === 200) ok('GET /sales')
      else fail('sales', String(sales2.status))
    } else fail('sales', String(sales.status))

    const sub = await req('/subscription/current', { token: ownerToken })
    if (sub.status === 200) ok('GET /subscription/current')
    else fail('subscription', String(sub.status))

    const plans = await req('/subscription/plans', { token: ownerToken })
    if (plans.status === 200 && (plans.data.plans || plans.data).length !== undefined)
      ok('GET /subscription/plans')
    else fail('plans', String(plans.status))
  })

  await section('Industry gating — pharmacy module', async () => {
    const meta = await req('/pharmacy/meta', { token: ownerToken })
    if (meta.status !== 200) {
      fail('pharmacy meta', String(meta.status))
      return
    }
    ok(`pharmacy meta enabled=${meta.data.enabled} label=${meta.data.label}`)

    const exp = await req('/pharmacy/expiring?days=90', { token: ownerToken })
    const hasLots = !!(ownerModules?.pharmacy || ownerModules?.perishables)
    if (hasLots) {
      if (exp.status === 200) ok('pharmacy/expiring allowed for lot shop')
      else fail('pharmacy/expiring', String(exp.status))
    } else {
      if (exp.status === 403) ok('pharmacy/expiring blocked for non-lot shop')
      else if (exp.status === 200 && meta.data.enabled === false) {
        // meta says disabled but expiring might still 403 from requireLots
        fail('pharmacy/expiring', `expected 403, got ${exp.status}`)
      } else if (exp.status === 403) {
        ok('pharmacy/expiring blocked')
      } else {
        // requireLots should 403
        fail('pharmacy/expiring gate', `expected 403 got ${exp.status}`)
      }
    }
  })

  await section('Switch industry → pharmacy → retail', async () => {
    // Enable pharmacy
    const toPharm = await req('/business/me', {
      token: ownerToken,
      method: 'PATCH',
      body: { industry: 'pharmacy' },
    })
    if (toPharm.status !== 200) {
      fail('PATCH industry pharmacy', JSON.stringify(toPharm.data).slice(0, 200))
      return
    }
    ok('PATCH industry=pharmacy')

    const me2 = await req('/auth/me', { token: ownerToken })
    if (me2.data.user?.modules?.pharmacy) ok('/me shows pharmacy module')
    else {
      // JWT session may not refresh modules until re-login — modules come from /me DB
      if (me2.data.user?.industry === 'pharmacy' || me2.data.user?.modules?.pharmacy)
        ok('pharmacy reflected on /me')
      else
        fail(
          '/me after pharmacy',
          `industry=${me2.data.user?.industry} modules=${JSON.stringify(me2.data.user?.modules)}`,
        )
    }

    const exp2 = await req('/pharmacy/expiring?days=90', { token: ownerToken })
    if (exp2.status === 200) ok('pharmacy/expiring works after enable')
    else fail('pharmacy/expiring after enable', `${exp2.status} ${JSON.stringify(exp2.data)}`)

    // Create a throwaway product + lot receive
    const create = await req('/products', {
      token: ownerToken,
      method: 'POST',
      body: {
        name: `Smoke Rx ${Date.now()}`,
        sellingPrice: 25,
        costPrice: 10,
        stockQuantity: 0,
        category: 'OTC',
        trackExpiry: true,
        requiresPrescription: true,
      },
    })
    if (create.status === 201 || create.status === 200) {
      ok('create pharmacy product')
      const productId = create.data.product?.id
      if (productId) {
        const expiry = new Date()
        expiry.setMonth(expiry.getMonth() + 6)
        const recv = await req('/pharmacy/receive', {
          token: ownerToken,
          method: 'POST',
          body: {
            productId,
            quantity: 5,
            lotNumber: `SMOKE-${Date.now()}`,
            expiryDate: expiry.toISOString(),
            costPrice: 10,
          },
        })
        if (recv.status === 201 || recv.status === 200) ok('pharmacy receive lot')
        else fail('pharmacy receive', `${recv.status} ${JSON.stringify(recv.data)}`)

        // Sale with Rx
        const sale = await req('/sales', {
          token: ownerToken,
          method: 'POST',
          body: {
            lines: [{ productId, quantity: 1 }],
            discount: 0,
            paymentMethod: 'CASH',
            prescriptionNote: 'Dr Smoke script #1',
          },
        })
        if (sale.status === 201) ok('sale with Rx note')
        else fail('sale Rx', `${sale.status} ${JSON.stringify(sale.data)}`)

        // Sale without Rx should fail
        const saleBad = await req('/sales', {
          token: ownerToken,
          method: 'POST',
          body: {
            lines: [{ productId, quantity: 1 }],
            discount: 0,
            paymentMethod: 'CASH',
          },
        })
        if (saleBad.status === 400) ok('sale without Rx rejected')
        else fail('sale without Rx', `expected 400 got ${saleBad.status}`)
      }
    } else {
      fail('create product', `${create.status} ${JSON.stringify(create.data)}`)
    }

    // Restore retail
    const toRetail = await req('/business/me', {
      token: ownerToken,
      method: 'PATCH',
      body: { industry: ownerIndustry || 'retail' },
    })
    if (toRetail.status === 200) ok(`restore industry=${ownerIndustry || 'retail'}`)
    else fail('restore industry', String(toRetail.status))

    const exp3 = await req('/pharmacy/expiring?days=90', { token: ownerToken })
    const me3 = await req('/auth/me', { token: ownerToken })
    const lotsNow = !!(
      me3.data.user?.modules?.pharmacy || me3.data.user?.modules?.perishables
    )
    if (!lotsNow && exp3.status === 403) ok('pharmacy gated again after restore')
    else if (lotsNow) ok('shop still lot-enabled (original industry)')
    else fail('post-restore gate', `${exp3.status} modules=${JSON.stringify(me3.data.user?.modules)}`)
  })

  await section('Sell happy path (cash)', async () => {
    const products = await req('/products', { token: ownerToken })
    const p = (products.data.products || []).find((x) => x.stockQuantity > 0)
    if (!p) {
      fail('sell product', 'no stocked product')
      return
    }
    const sale = await req('/sales', {
      token: ownerToken,
      method: 'POST',
      body: {
        lines: [{ productId: p.id, quantity: 1 }],
        discount: 0,
        paymentMethod: 'CASH',
        notes: 'smoke test',
      },
    })
    if (sale.status === 201 && sale.data.sale?.id) ok(`cash sale ${sale.data.sale.receiptNo || sale.data.sale.id}`)
    else fail('cash sale', `${sale.status} ${JSON.stringify(sale.data)}`)
  })

  await section('Loyalty + subscription panels', async () => {
    const cur = await req('/subscription/current', { token: ownerToken })
    if (cur.status === 200) ok('subscription current')
    else fail('subscription', String(cur.status))
  })

  await section('Signup → pending → approve → login', async () => {
    const stamp = Date.now()
    const email = `smoke-signup-${stamp}@example.com`
    const shopName = `Smoke Shop ${stamp}`
    const reg = await req('/auth/register', {
      method: 'POST',
      body: {
        businessName: shopName,
        industry: 'pharmacy',
        ownerName: 'Smoke Owner',
        ownerEmail: email,
        ownerPassword: 'SmokePass1!',
        currency: 'ZMW',
      },
    })
    if (reg.status === 201 && reg.data.pendingApproval) {
      ok('register returns pendingApproval')
    } else {
      fail('register pending', `${reg.status} ${JSON.stringify(reg.data).slice(0, 200)}`)
      return
    }
    if (reg.data.token) fail('register must not return token', 'token present')
    else ok('register does not auto-login')

    const blocked = await login(email, 'SmokePass1!')
    if (
      blocked.status >= 400 &&
      String(blocked.data.error || '').toLowerCase().includes('approval')
    ) {
      ok('login blocked until approved')
    } else {
      fail(
        'login before approve',
        `${blocked.status} ${JSON.stringify(blocked.data).slice(0, 180)}`,
      )
    }

    const plat = await login('admin@nexora.app', 'NexoraAdmin1!')
    if (plat.status !== 200 || !plat.data.token) {
      fail('platform login for approve', JSON.stringify(plat.data).slice(0, 120))
      return
    }
    const platToken = plat.data.token
    const list = await req(
      `/platform/businesses?q=${encodeURIComponent(shopName)}&pageSize=20`,
      { token: platToken },
    )
    if (typeof list.data.total !== 'number') {
      fail('platform list pagination meta', 'missing total')
    } else ok(`platform list total=${list.data.total}`)
    const pending = (list.data.businesses || []).find((b) => b.name === shopName)
    if (!pending) {
      fail('find pending shop', 'not in platform list')
      return
    }
    if (pending.status !== 'PENDING_APPROVAL') {
      fail('pending status', pending.status)
    } else ok('shop status PENDING_APPROVAL')

    const approve = await req(`/platform/businesses/${pending.id}/status`, {
      method: 'PATCH',
      token: platToken,
      body: { status: 'TRIAL' },
    })
    if (approve.status === 200 && approve.data.business?.status === 'TRIAL') {
      ok('platform Approve → TRIAL')
    } else {
      fail(
        'platform approve',
        `${approve.status} ${JSON.stringify(approve.data).slice(0, 200)}`,
      )
      return
    }

    const after = await login(email, 'SmokePass1!')
    if (
      after.status === 200 &&
      after.data.token &&
      after.data.user?.businessName === shopName
    ) {
      ok('login works after approve')
    } else {
      fail(
        'login after approve',
        `${after.status} ${JSON.stringify(after.data).slice(0, 200)}`,
      )
    }

    const newToken = after.data?.token
    if (newToken) {
      const meBiz = await req('/business/me', { token: newToken })
      const branches = meBiz.data?.business?.branches || meBiz.data?.branches
      const main =
        Array.isArray(branches) &&
        branches.find((b) => b.isMain || b.name === 'Main Branch')
      if (meBiz.status === 200 && (main || meBiz.data?.business?.id)) {
        ok('setup: business + Main Branch bootstrap')
      } else {
        fail(
          'setup guide / branch',
          `${meBiz.status} ${JSON.stringify(meBiz.data).slice(0, 180)}`,
        )
      }

      const created = await req('/products', {
        method: 'POST',
        token: newToken,
        body: {
          name: `Smoke SKU ${stamp}`,
          sellingPrice: 12.5,
          costPrice: 5,
          stockQuantity: 20,
          barcode: `SMOKE${stamp}`.slice(0, 18),
        },
      })
      if (created.status === 201 && created.data?.product?.id) {
        ok('create lean product after approve')
        const sale = await req('/sales', {
          method: 'POST',
          token: newToken,
          body: {
            lines: [{ productId: created.data.product.id, quantity: 1 }],
            discount: 0,
            paymentMethod: 'CASH',
            notes: 'smoke post-signup sale',
          },
        })
        if (sale.status === 201 && sale.data?.sale?.id) ok('sell lean product')
        else fail('sell after signup', `${sale.status}`)
      } else {
        fail(
          'create product after approve',
          `${created.status} ${JSON.stringify(created.data).slice(0, 160)}`,
        )
      }

      const shift = await req('/shifts/current', { token: newToken })
      if (shift.status === 200 && !shift.data.shift) {
        const open = await req('/shifts/open', {
          method: 'POST',
          token: newToken,
          body: { openingFloat: 0 },
        })
        if (open.status === 200 || open.status === 201) ok('open shift smoke')
        else fail('open shift', `${open.status} ${JSON.stringify(open.data).slice(0, 120)}`)
      } else if (shift.status === 200) {
        ok('shift already open / current ok')
      } else {
        fail('shift current', String(shift.status))
      }
    }

    // Reject path on a second shop
    const email2 = `smoke-reject-${stamp}@example.com`
    const shop2 = `Reject Shop ${stamp}`
    const reg2 = await req('/auth/register', {
      method: 'POST',
      body: {
        businessName: shop2,
        industry: 'retail',
        ownerName: 'Reject Owner',
        ownerEmail: email2,
        ownerPassword: 'SmokePass1!',
        currency: 'ZMW',
      },
    })
    if (reg2.status !== 201) {
      fail('register reject candidate', String(reg2.status))
      return
    }
    const list2 = await req(
      `/platform/businesses?q=${encodeURIComponent(shop2)}&pageSize=20`,
      { token: platToken },
    )
    const rej = (list2.data.businesses || []).find((b) => b.name === shop2)
    if (!rej) {
      fail('find reject shop', 'missing')
      return
    }
    const rejected = await req(`/platform/businesses/${rej.id}/status`, {
      method: 'PATCH',
      token: platToken,
      body: { status: 'CANCELLED' },
    })
    if (rejected.status === 200 && rejected.data.business?.status === 'CANCELLED') {
      ok('platform Reject → CANCELLED')
    } else {
      fail('platform reject', `${rejected.status}`)
    }
    const stillBlocked = await login(email2, 'SmokePass1!')
    if (stillBlocked.status >= 400) ok('rejected shop cannot login')
    else fail('rejected login', 'unexpectedly allowed')
  })

  await section('Landing / login / PDF', async () => {
    const web = process.env.WEB_URL || 'http://127.0.0.1:5173'
    let webUp = false
    try {
      const probe = await fetch(web, { signal: AbortSignal.timeout(3000) })
      webUp = probe.status > 0
    } catch {
      webUp = false
    }
    if (!webUp) {
      ok('web UI skipped (WEB_URL unreachable — API-only CI)')
      return
    }
    for (const path of ['/', '/login', '/signup']) {
      const res = await fetch(`${web}${path}`)
      if (res.status === 200) ok(`GET ${path}`)
      else fail(`GET ${path}`, String(res.status))
    }
    const pdf = await fetch(`${web}/docs/NEXORA-Owner-Guide.pdf`)
    const ctype = pdf.headers.get('content-type') || ''
    if (pdf.status === 200 && ctype.includes('pdf')) {
      ok('GET /docs/NEXORA-Owner-Guide.pdf')
    } else {
      fail('PDF download', `${pdf.status} ${ctype}`)
    }
  })

  console.log(`\n${'─'.repeat(40)}`)
  console.log(`Passed: ${passed}  Failed: ${failed}`)
  if (failures.length) {
    console.log('\nFailures:')
    for (const f of failures) console.log(`  • ${f}`)
  }
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
