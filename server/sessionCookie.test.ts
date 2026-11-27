import { describe, expect, it } from 'vitest'
import { extractAccessToken, SESSION_COOKIE } from './sessionCookie.js'

describe('extractAccessToken', () => {
  it('prefers Bearer over cookie', () => {
    const token = extractAccessToken({
      headers: { authorization: 'Bearer from-header' },
      cookies: { [SESSION_COOKIE]: 'from-cookie' },
    })
    expect(token).toBe('from-header')
  })

  it('falls back to session cookie', () => {
    const token = extractAccessToken({
      headers: {},
      cookies: { [SESSION_COOKIE]: 'from-cookie' },
    })
    expect(token).toBe('from-cookie')
  })

  it('returns null when neither present', () => {
    expect(extractAccessToken({ headers: {}, cookies: {} })).toBeNull()
  })
})
