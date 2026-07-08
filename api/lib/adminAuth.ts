// Session auth for the hidden owner-only admin panel (docs/superpowers/plans/
// 2026-07-08-admin-panel.md). There is no login system anywhere else in this
// app -- ACTIVE_USER_ID is the only "identity" concept that exists -- so this
// is a self-contained password gate: verify ADMIN_PASSWORD server-side, issue
// a short-lived HMAC-signed cookie, and never store any session state
// anywhere (a stateless signed token survives serverless cold starts, where
// an in-memory session map would not).
import crypto from 'node:crypto'

export interface ApiRequest {
  method?: string
  url?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
}

export interface ApiResponse {
  status(code: number): ApiResponse
  json(body: unknown): void
  setHeader(name: string, value: string): void
}

const COOKIE_NAME = 'byte_admin_session'
const SESSION_TTL_MS = 4 * 60 * 60 * 1000 // 4 hours

function secret(): string {
  const value = process.env.ADMIN_PASSWORD
  if (!value) throw new Error('ADMIN_PASSWORD is not set')
  return value
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex')
}

// Hash both sides to a fixed 32-byte digest before comparing -- makes the
// timingSafeEqual call meaningful (it requires equal-length buffers, and a
// raw length-mismatch on unequal passwords would itself leak a timing
// signal) and rejects same-length passwords with a plain string `===`
// would already reject.
export function verifyPassword(candidate: string): boolean {
  const expected = crypto.createHash('sha256').update(secret()).digest()
  const actual = crypto.createHash('sha256').update(candidate).digest()
  return crypto.timingSafeEqual(expected, actual)
}

export function createSessionCookie(): string {
  const expiresAtMs = Date.now() + SESSION_TTL_MS
  const token = `${expiresAtMs}.${sign(String(expiresAtMs))}`
  // Vercel sets VERCEL=1 in its build/runtime environment; local dev and
  // `vite preview` are plain http, where a Secure cookie would silently
  // never get sent.
  const secureFlag = process.env.VERCEL === '1' ? '; Secure' : ''
  return `${COOKIE_NAME}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secureFlag}`
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0`
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    if (!key) continue
    // A malformed %-escape in ANY cookie on the header (ours or a third
    // party's) must not take down parsing of the rest -- skip just that
    // entry rather than letting decodeURIComponent's URIError propagate.
    try {
      out[key] = decodeURIComponent(part.slice(eq + 1).trim())
    } catch {
      continue
    }
  }
  return out
}

export function isAuthorized(req: ApiRequest): boolean {
  const cookieHeader = req.headers?.cookie
  const header = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader
  const token = parseCookies(header)[COOKIE_NAME]
  if (!token) return false

  const separatorIndex = token.indexOf('.')
  if (separatorIndex === -1) return false
  const expiresAtRaw = token.slice(0, separatorIndex)
  const signature = token.slice(separatorIndex + 1)
  const expiresAtMs = Number(expiresAtRaw)
  if (!Number.isFinite(expiresAtMs) || Date.now() >= expiresAtMs) return false

  // A read-only auth check on an already-established session must fail
  // closed, not throw, if the server is misconfigured (e.g. ADMIN_PASSWORD
  // unset/removed after the cookie was issued) -- unlike verifyPassword and
  // createSessionCookie, which are on the login path and should keep
  // throwing loudly at setup time.
  let expected: Buffer
  try {
    expected = Buffer.from(sign(expiresAtRaw), 'hex')
  } catch {
    return false
  }
  const actual = Buffer.from(signature, 'hex')
  if (expected.length !== actual.length) return false
  return crypto.timingSafeEqual(expected, actual)
}

export function requireAuth(req: ApiRequest, res: ApiResponse): boolean {
  if (isAuthorized(req)) return true
  res.status(401).json({ error: 'unauthorized' })
  return false
}
