// src/lib/adminApi.ts
// Fetch wrappers for the hidden admin panel's /api/admin/* endpoints --
// mirrors the style of src/lib/chatApi.ts. The session is an httpOnly
// cookie the browser can't read or attach explicitly; same-origin fetch
// sends it automatically, so none of these pass credentials manually.
import type { AdminCharacterState, AdminFact, AdminImportantDate, AdminMessage, AdminPersonalityBase, AdminUser } from '../types/admin'

export interface AdminData {
  users: AdminUser[]
  selectedUserId: string | null
  user?: AdminUser
  facts: AdminFact[]
  messages: AdminMessage[]
  characterState: AdminCharacterState | null
  importantDates: AdminImportantDate[]
  personalityBase: AdminPersonalityBase
}

export async function adminLogin(password: string): Promise<boolean> {
  const response = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  return response.ok
}

export async function adminLogout(): Promise<void> {
  await fetch('/api/admin/logout', { method: 'POST' })
}

// Returns null on a 401 (no/expired session) so callers can fall back to
// the login form instead of treating "not logged in" as a hard error.
export async function fetchAdminData(userId?: string): Promise<AdminData | null> {
  const query = userId ? `?user=${encodeURIComponent(userId)}` : ''
  const response = await fetch(`/api/admin/data${query}`)
  if (response.status === 401) return null
  if (!response.ok) throw new Error(`/api/admin/data responded ${response.status}`)
  return response.json()
}

export async function adminMutate(body: Record<string, unknown>): Promise<void> {
  const response = await fetch('/api/admin/mutate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`/api/admin/mutate responded ${response.status}`)
}
