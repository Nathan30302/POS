import { describe, expect, it } from 'vitest'
import type { Business } from '@prisma/client'
import { accessFromBusiness } from './subscription.js'

function biz(partial: Partial<Business>): Business {
  return {
    id: 'b1',
    name: 'Test',
    slug: 'test',
    logoUrl: null,
    description: null,
    industry: 'retail',
    category: null,
    address: null,
    phone: null,
    email: null,
    currency: 'ZMW',
    taxEnabled: false,
    taxRate: 0,
    timezone: 'Africa/Lusaka',
    status: 'ACTIVE',
    modulesJson: '{}',
    settingsJson: '{}',
    receiptJson: '{}',
    plan: 'starter',
    trialEndsAt: null,
    subscriptionEndsAt: null,
    graceEndsAt: null,
    billingProvider: 'manual',
    lastPaymentAt: null,
    lastPaymentRef: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  }
}

describe('accessFromBusiness', () => {
  it('blocks pending approval', () => {
    const r = accessFromBusiness(biz({ status: 'PENDING_APPROVAL' }))
    expect(r.access).toBe('blocked')
    expect(r.accessMessage.toLowerCase()).toContain('approval')
  })

  it('blocks suspended and cancelled', () => {
    expect(accessFromBusiness(biz({ status: 'SUSPENDED' })).access).toBe(
      'blocked',
    )
    expect(accessFromBusiness(biz({ status: 'CANCELLED' })).access).toBe(
      'blocked',
    )
  })

  it('allows active shops', () => {
    expect(accessFromBusiness(biz({ status: 'ACTIVE' })).access).toBe('ok')
  })

  it('marks trial when within trial window', () => {
    const r = accessFromBusiness(
      biz({
        status: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 86400000),
      }),
    )
    expect(r.access).toBe('trial')
  })
})
