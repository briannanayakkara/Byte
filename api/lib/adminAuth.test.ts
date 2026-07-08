import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSessionCookie, createSessionCookie, isAuthorized, requireAuth, verifyPassword } from './adminAuth.js'

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

  it('rejects a malformed %-escape in the cookie header without throwing', () => {
    expect(() =>
      isAuthorized({ headers: { cookie: 'other=%; byte_admin_session=garbage' } })
    ).not.toThrow()
    expect(isAuthorized({ headers: { cookie: 'other=%; byte_admin_session=garbage' } })).toBe(false)
  })

  it('rejects a valid session without throwing when ADMIN_PASSWORD is unset', () => {
    const setCookie = createSessionCookie()
    const cookie = cookieHeaderFrom(setCookie)
    delete process.env.ADMIN_PASSWORD
    expect(() => isAuthorized({ headers: { cookie } })).not.toThrow()
    expect(isAuthorized({ headers: { cookie } })).toBe(false)
  })

  it('requireAuth returns false and responds 401 when unauthorized', () => {
    const json = vi.fn()
    const status = vi.fn().mockReturnValue({ json })
    const res = { status, json, setHeader: vi.fn() }
    expect(requireAuth({ headers: {} }, res)).toBe(false)
    expect(status).toHaveBeenCalledWith(401)
    expect(json).toHaveBeenCalledWith({ error: 'unauthorized' })
  })
})
