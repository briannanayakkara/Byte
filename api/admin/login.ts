import { createSessionCookie, verifyPassword, type ApiRequest, type ApiResponse } from '../lib/adminAuth.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = (req.body ?? {}) as { password?: unknown }
  const password = typeof body.password === 'string' ? body.password : ''

  try {
    if (!password || !verifyPassword(password)) {
      res.status(401).json({ error: 'invalid password' })
      return
    }
    res.setHeader('Set-Cookie', createSessionCookie())
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('admin login failed', err)
    res.status(500).json({ error: 'admin login failed' })
  }
}
