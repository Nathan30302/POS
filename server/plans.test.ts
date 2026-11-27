import { describe, expect, it } from 'vitest'
import {
  getPlan,
  isPlanId,
  planIncludesFeature,
} from './plans.js'

describe('plans catalog', () => {
  it('recognizes plan ids', () => {
    expect(isPlanId('starter')).toBe(true)
    expect(isPlanId('business')).toBe(true)
    expect(isPlanId('nope')).toBe(false)
  })

  it('falls back to starter for unknown ids', () => {
    expect(getPlan('unknown').id).toBe('starter')
  })

  it('starter excludes pulse and transfers', () => {
    expect(planIncludesFeature('starter', 'sell')).toBe(true)
    expect(planIncludesFeature('starter', 'pulse')).toBe(false)
    expect(planIncludesFeature('starter', 'transfers')).toBe(false)
  })

  it('growth includes pulse but not transfers', () => {
    expect(planIncludesFeature('growth', 'pulse')).toBe(true)
    expect(planIncludesFeature('growth', 'transfers')).toBe(false)
  })

  it('business and enterprise unlock transfers/purchasing', () => {
    expect(planIncludesFeature('business', 'transfers')).toBe(true)
    expect(planIncludesFeature('business', 'purchasing')).toBe(true)
    expect(planIncludesFeature('enterprise', 'pulse')).toBe(true)
    expect(planIncludesFeature('enterprise', 'head_office')).toBe(true)
  })
})
