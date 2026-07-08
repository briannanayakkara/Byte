import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSessionCookie, createSessionCookie, isAuthorized, verifyPassword } from './adminAuth.js'

function cookieHeaderFrom(setCookie: string): string {
  return setCookie.split(';')[0]
}

describe('adminAuth', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'correct horse battery staple'
    delete process.env.VERCEL
  })

  it('accepts the correct password', () => {
    expect(verifyPassword('correct horse battery staple')).toBe(true)
  })

  it('rejects an incorrect password', () => {
    expect(verifyPassword('wrong')).toBe(false)
  })

  it('authorizes a freshly created session cookie', () => {
    const setCookie = createSessionCookie()
    expect(isAuthorized({ headers: { cookie: cookieHeaderFrom(setCookie) } })).toBe(true)
  })

  it('rejects a missing cookie', () => {
    expect(isAuthorized({ headers: {} })).toBe(false)
  })

  it('rejects a request with no headers at all', () => {
    expect(isAuthorized({})).toBe(false)
  })

  it('rejects a tampered signature', () => {
    const setCookie = createSessionCookie()
    const [name, token] = cookieHeaderFrom(setCookie).split('=')
    const [expiresAt] = token.split('.')
    const tampered = `${name}=${expiresAt}.${'0'.repeat(64)}`
    expect(isAuthorized({ headers: { cookie: tampered } })).toBe(false)
  })

  it('rejects an expired session', () => {
    vi.useFakeTimers()
    try {
      const setCookie = createSessionCookie()
      const cookie = cookieHeaderFrom(setCookie)
      vi.advanceTimersByTime(5 * 60 * 60 * 1000)
      expect(isAuthorized({ headers: { cookie } })).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('clearSessionCookie expires immediately', () => {
    expect(clearSessionCookie()).toContain('Max-Age=0')
  })

  it('does not mark the cookie Secure outside Vercel', () => {
    expect(createSessionCookie()).not.toContain('Secure')
  })

  it('marks the cookie Secure on Vercel', () => {
    process.env.VERCEL = '1'
    expect(createSessionCookie()).toContain('Secure')
  })
})
