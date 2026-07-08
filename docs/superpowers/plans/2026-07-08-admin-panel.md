# Hidden Owner-Only Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hidden, password-gated admin view (no routing — a conditionally-rendered overlay inside the existing single-view `App`) that lets the owner view and edit every row Byte's `/api/chat` reads/writes in Supabase, with edits taking effect on the very next reply.

**Architecture:** Server-only `ADMIN_PASSWORD` check issues a stateless, HMAC-signed, short-lived session cookie (`byte_admin_session`, HttpOnly/SameSite=Strict, scoped to `/api/admin`) — no session store, safe across serverless cold starts. Two new API surfaces mirror the existing `api/chat.ts` idiom: `api/admin/data.ts` (GET, one read of everything for a user) and `api/admin/mutate.ts` (POST, a single resource/action-dispatched write endpoint, same "flag-based dispatch in one file" style `api/chat.ts` already uses for `greeting`/`fact`). All reads/writes hit the exact same tables `api/lib/memory.ts`/`memory-write.ts` use, via the same service-role Supabase client — so there is no cache to invalidate; an edit is visible on the next `/api/chat` call by construction.

**Tech Stack:** Existing stack only — React 19, Tailwind v4, Vite, `@supabase/supabase-js`, Vitest. No new dependencies (session signing uses Node's built-in `node:crypto`, not a JWT library; cookies are parsed by hand, not via a `cookie` package).

## Global Constraints

- The browser never talks to Supabase directly, ever — only server code (`api/admin/*.ts`, via `api/lib/adminData.ts`) touches the service-role client, exactly like `api/chat.ts` today (spec §4, `.claude/skills/supabase-patterns`).
- Every query filters by `user_id` (or operates on a single row by `id`) — no unscoped table-wide writes.
- `ADMIN_PASSWORD` is a new server-only env var (`.env`, gitignored). It is never sent to the browser, never logged, never appears in an error response body.
- No new npm dependencies. No React Router, no new page/route — the admin view is a state flag in `App.tsx` rendered as a full-screen overlay.
- `src/` and `api/` are separate TypeScript project roots (`tsconfig.app.json` includes only `src`, `tsconfig.node.json` includes only `api`) — they cannot import each other's types. Follow the codebase's existing convention (`api/lib/types.ts` vs `src/types.ts`) of a small duplicated type file on the `src/` side.
- Match the existing dark/slate Tailwind aesthetic: `bg-slate-900`/`bg-slate-800` backgrounds, `bg-white/10` translucent surfaces, `rounded-full` buttons/pills, `rounded-2xl`/`rounded-lg` cards/inputs, white text, `text-white/50`-ish muted labels — see `src/App.tsx`, `src/components/ChatInput.tsx`.
- Error responses stay minimal (no stack traces, no key names) — same posture as `api/chat.ts`'s catch block.
- This codebase's testing convention (confirmed by what exists today): pure-logic modules get Vitest unit tests (`relationship.ts`, `moods.ts`, `parseModelOutput.ts`, `detectRequestedMood.ts`, `holidays.ts`, `usePlayMode.ts`). Supabase-touching modules (`memory.ts`, `memory-write.ts`, `supabase.ts`) and React components have **no** unit tests today — they're verified by running the app. Follow this split: TDD the new signing/auth logic, manually verify everything that touches Supabase or the DOM.

---

## File Structure

**Backend (new):**
- `api/lib/adminAuth.ts` — password check + signed session cookie create/verify (pure logic, TDD'd)
- `api/lib/adminAuth.test.ts` — its tests
- `api/lib/adminData.ts` — all Supabase reads/writes the panel needs (mirrors `api/lib/memory.ts`'s idioms, broader scope)
- `api/admin/login.ts` — `POST` verify password → set cookie
- `api/admin/logout.ts` — `POST` clear cookie
- `api/admin/data.ts` — `GET` full snapshot for the selected (or first) user
- `api/admin/mutate.ts` — `POST` single dispatch endpoint for every edit/create/delete

**Backend (modified):**
- `vite.config.ts` — generalize the existing `/api/chat`-only dev middleware so `/api/admin/*` also works under `npm run dev`
- `.env` — add an empty `ADMIN_PASSWORD=` line for the user to fill in

**Frontend (new):**
- `src/types/admin.ts` — the `src/`-side mirror of the Supabase row shapes the panel needs
- `src/lib/adminApi.ts` — fetch wrappers (mirrors `src/lib/chatApi.ts`'s style)
- `src/components/admin/useSaveStatus.ts` — tiny shared save-state hook (saving/saved/error), used by every section to avoid repeating the same state machine six times
- `src/components/admin/AdminCard.tsx` — shared card shell
- `src/components/admin/SaveStatusLabel.tsx` — shared status text
- `src/components/admin/AdminLogin.tsx` — password form
- `src/components/admin/AdminOverlay.tsx` — top-level: checks session, shows login or panel
- `src/components/admin/AdminPanel.tsx` — user switcher + renders all sections
- `src/components/admin/sections/UserSection.tsx`
- `src/components/admin/sections/CharacterStateSection.tsx`
- `src/components/admin/sections/FactsSection.tsx`
- `src/components/admin/sections/ImportantDatesSection.tsx`
- `src/components/admin/sections/MessagesSection.tsx`
- `src/components/admin/sections/PersonalityBaseSection.tsx`

**Frontend (modified):**
- `src/App.tsx` — hidden corner hotspot + `?admin=1` query flag + conditional `<AdminOverlay />` render

---

### Task 1: Admin session auth (`api/lib/adminAuth.ts`)

**Files:**
- Create: `api/lib/adminAuth.ts`
- Test: `api/lib/adminAuth.test.ts`

**Interfaces:**
- Produces: `export interface ApiRequest { method?: string; url?: string; body?: unknown; headers?: Record<string, string | string[] | undefined> }`, `export interface ApiResponse { status(code: number): ApiResponse; json(body: unknown): void; setHeader(name: string, value: string): void }`, `export function verifyPassword(candidate: string): boolean`, `export function createSessionCookie(): string`, `export function clearSessionCookie(): string`, `export function isAuthorized(req: ApiRequest): boolean`, `export function requireAuth(req: ApiRequest, res: ApiResponse): boolean`.

- [ ] **Step 1: Write the failing tests**

```ts
// api/lib/adminAuth.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- api/lib/adminAuth.test.ts`
Expected: FAIL — `Cannot find module './adminAuth.js'`

- [ ] **Step 3: Write the implementation**

```ts
// api/lib/adminAuth.ts
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
    if (key) out[key] = decodeURIComponent(part.slice(eq + 1).trim())
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

  const expected = Buffer.from(sign(expiresAtRaw), 'hex')
  const actual = Buffer.from(signature, 'hex')
  if (expected.length !== actual.length) return false
  return crypto.timingSafeEqual(expected, actual)
}

export function requireAuth(req: ApiRequest, res: ApiResponse): boolean {
  if (isAuthorized(req)) return true
  res.status(401).json({ error: 'unauthorized' })
  return false
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- api/lib/adminAuth.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add api/lib/adminAuth.ts api/lib/adminAuth.test.ts
git commit -m "feat: add signed session auth for the admin panel"
```

---

### Task 2: Admin data access (`api/lib/adminData.ts`)

**Files:**
- Create: `api/lib/adminData.ts`

**Interfaces:**
- Consumes: `supabase` from `api/lib/supabase.ts`; `User`, `Fact`, `FactCategory`, `Message`, `CharacterState`, `ImportantDate` from `api/lib/types.ts`.
- Produces: `listUsers()`, `getUserBundle(userId)` returning `{ user, facts, messages, characterState, importantDates }`, `updateUser(userId, fields: EditableUserFields)`, `upsertCharacterState(userId, fields: EditableCharacterStateFields)`, `createFact/updateFact/deleteFact`, `createImportantDate/updateImportantDate/deleteImportantDate` (fields typed `EditableImportantDateFields`), `deleteMessage(id)`, `getActivePersonalityBase()` returning `PersonalityBase`, `updatePersonalityBaseDistilledPrompt(id, distilledPrompt)`. These type/function names are used verbatim by Task 3.

No unit tests for this file — per the Global Constraints testing split, Supabase-touching modules (like the existing `api/lib/memory.ts`/`memory-write.ts`) aren't unit tested in this codebase; this module is verified in Task 5 by exercising the real endpoints against the dev Supabase project.

- [ ] **Step 1: Write the implementation**

```ts
// api/lib/adminData.ts
// Data access for the hidden admin panel (docs/superpowers/plans/2026-07-08-
// admin-panel.md). Same server-only service-role client as api/lib/memory.ts,
// but broader: every user (not just ACTIVE_USER_ID) and uncapped-ish history,
// since this is the owner inspecting/editing raw rows rather than building a
// prompt. Every write here lands in the exact tables api/lib/memory.ts reads
// fresh on the next /api/chat call -- there is no cache to invalidate.
import { supabase } from './supabase.js'
import type { CharacterState, Fact, FactCategory, ImportantDate, Message, User } from './types.js'

const MESSAGE_HISTORY_LIMIT = 200
const FACT_LIMIT = 200

export async function listUsers(): Promise<User[]> {
  const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as User[]
}

export interface UserBundle {
  user: User
  facts: Fact[]
  messages: Message[]
  characterState: CharacterState | null
  importantDates: ImportantDate[]
}

export async function getUserBundle(userId: string): Promise<UserBundle> {
  const [userRes, factsRes, messagesRes, stateRes, datesRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('facts').select('*').eq('user_id', userId).order('last_referenced_at', { ascending: false }).limit(FACT_LIMIT),
    supabase.from('messages').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(MESSAGE_HISTORY_LIMIT),
    supabase.from('character_state').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('important_dates').select('*').eq('user_id', userId).order('date', { ascending: true }),
  ])

  if (userRes.error) throw userRes.error
  if (factsRes.error) throw factsRes.error
  if (messagesRes.error) throw messagesRes.error
  if (stateRes.error) throw stateRes.error
  if (datesRes.error) throw datesRes.error

  return {
    user: userRes.data as User,
    facts: (factsRes.data ?? []) as Fact[],
    // Query comes back newest-first (for `limit` to work) -- reverse to
    // chronological order, matching api/lib/memory.ts's convention.
    messages: ((messagesRes.data ?? []) as Message[]).reverse(),
    characterState: (stateRes.data as CharacterState | null) ?? null,
    importantDates: (datesRes.data ?? []) as ImportantDate[],
  }
}

export interface EditableUserFields {
  name?: string
  nicknames?: string[]
  birthday?: string | null
  location?: string | null
  pronouns?: string | null
  notes?: string | null
}

export async function updateUser(userId: string, fields: EditableUserFields): Promise<void> {
  const { error } = await supabase.from('users').update(fields).eq('id', userId)
  if (error) throw error
}

export interface EditableCharacterStateFields {
  mood?: string
  energy?: number
  relationship_level?: number
  interaction_count?: number
  streak_days?: number
  personality_notes?: string | null
}

// Upsert, not a plain update -- a brand-new user has no character_state row
// yet (api/lib/memory.ts's DEFAULT_CHARACTER_STATE fallback covers reads,
// but nothing has INSERTed a real row until a first turn or greeting runs;
// same reasoning as saveGreeting in api/lib/memory-write.ts).
export async function upsertCharacterState(userId: string, fields: EditableCharacterStateFields): Promise<void> {
  const { error } = await supabase.from('character_state').upsert({ user_id: userId, ...fields }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function createFact(userId: string, content: string, category: FactCategory): Promise<void> {
  const { error } = await supabase.from('facts').insert({ user_id: userId, content, category })
  if (error) throw error
}

export async function updateFact(id: string, fields: { content?: string; category?: FactCategory }): Promise<void> {
  const { error } = await supabase.from('facts').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteFact(id: string): Promise<void> {
  const { error } = await supabase.from('facts').delete().eq('id', id)
  if (error) throw error
}

export interface EditableImportantDateFields {
  label: string
  date: string
  recurring: boolean
  notes: string | null
}

export async function createImportantDate(userId: string, fields: EditableImportantDateFields): Promise<void> {
  const { error } = await supabase.from('important_dates').insert({ user_id: userId, ...fields })
  if (error) throw error
}

export async function updateImportantDate(id: string, fields: Partial<EditableImportantDateFields>): Promise<void> {
  const { error } = await supabase.from('important_dates').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteImportantDate(id: string): Promise<void> {
  const { error } = await supabase.from('important_dates').delete().eq('id', id)
  if (error) throw error
}

export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase.from('messages').delete().eq('id', id)
  if (error) throw error
}

export interface PersonalityBase {
  id: string
  version: number
  active: boolean
  distilled_prompt: string
}

export async function getActivePersonalityBase(): Promise<PersonalityBase> {
  const { data, error } = await supabase.from('personality_base').select('id, version, active, distilled_prompt').eq('active', true).single()
  if (error) throw error
  return data as PersonalityBase
}

export async function updatePersonalityBaseDistilledPrompt(id: string, distilledPrompt: string): Promise<void> {
  const { error } = await supabase.from('personality_base').update({ distilled_prompt: distilledPrompt }).eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors from `api/lib/adminData.ts` (other admin files don't exist yet, so unrelated errors about `api/admin/*` are expected until Task 3 — confirm no errors specifically in this file).

- [ ] **Step 3: Commit**

```bash
git add api/lib/adminData.ts
git commit -m "feat: add Supabase read/write helpers for the admin panel"
```

---

### Task 3: Admin API routes

**Files:**
- Create: `api/admin/login.ts`
- Create: `api/admin/logout.ts`
- Create: `api/admin/data.ts`
- Create: `api/admin/mutate.ts`

**Interfaces:**
- Consumes: everything produced by Task 1 (`api/lib/adminAuth.ts`) and Task 2 (`api/lib/adminData.ts`); `FACT_CATEGORIES`, `FactCategory` from `api/lib/types.ts`.
- Produces: default-exported `handler(req: ApiRequest, res: ApiResponse)` in each file, matching the shape `api/chat.ts` already uses (so Task 4's dev middleware and Vercel's production runtime can call any of them identically).

- [ ] **Step 1: Write `api/admin/login.ts`**

```ts
// api/admin/login.ts
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
```

- [ ] **Step 2: Write `api/admin/logout.ts`**

```ts
// api/admin/logout.ts
import { clearSessionCookie, type ApiRequest, type ApiResponse } from '../lib/adminAuth.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  res.setHeader('Set-Cookie', clearSessionCookie())
  res.status(200).json({ ok: true })
}
```

- [ ] **Step 3: Write `api/admin/data.ts`**

```ts
// api/admin/data.ts
import { requireAuth, type ApiRequest, type ApiResponse } from '../lib/adminAuth.js'
import { getActivePersonalityBase, getUserBundle, listUsers } from '../lib/adminData.js'

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!requireAuth(req, res)) return

  try {
    const users = await listUsers()
    const personalityBase = await getActivePersonalityBase()

    if (users.length === 0) {
      res.status(200).json({
        users: [],
        selectedUserId: null,
        facts: [],
        messages: [],
        characterState: null,
        importantDates: [],
        personalityBase,
      })
      return
    }

    const query = new URL(req.url ?? '', 'http://localhost').searchParams
    const requestedUserId = query.get('user')
    const selectedUserId = requestedUserId && users.some((u) => u.id === requestedUserId) ? requestedUserId : users[0].id
    const bundle = await getUserBundle(selectedUserId)

    res.status(200).json({
      users,
      selectedUserId,
      user: bundle.user,
      facts: bundle.facts,
      messages: bundle.messages,
      characterState: bundle.characterState,
      importantDates: bundle.importantDates,
      personalityBase,
    })
  } catch (err) {
    console.error('admin data load failed', err)
    res.status(500).json({ error: 'admin data load failed' })
  }
}
```

- [ ] **Step 4: Write `api/admin/mutate.ts`**

```ts
// api/admin/mutate.ts
import { requireAuth, type ApiRequest, type ApiResponse } from '../lib/adminAuth.js'
import {
  createFact,
  createImportantDate,
  deleteFact,
  deleteImportantDate,
  deleteMessage,
  updateFact,
  updateImportantDate,
  updatePersonalityBaseDistilledPrompt,
  updateUser,
  upsertCharacterState,
  type EditableCharacterStateFields,
  type EditableImportantDateFields,
  type EditableUserFields,
} from '../lib/adminData.js'
import { FACT_CATEGORIES, type FactCategory } from '../lib/types.js'

type MutateBody =
  | { resource: 'user'; id: string; fields: EditableUserFields }
  | { resource: 'characterState'; userId: string; fields: EditableCharacterStateFields }
  | { resource: 'fact'; action: 'create'; userId: string; content: string; category: string }
  | { resource: 'fact'; action: 'update'; id: string; fields: { content?: string; category?: string } }
  | { resource: 'fact'; action: 'delete'; id: string }
  | { resource: 'importantDate'; action: 'create'; userId: string; fields: EditableImportantDateFields }
  | { resource: 'importantDate'; action: 'update'; id: string; fields: Partial<EditableImportantDateFields> }
  | { resource: 'importantDate'; action: 'delete'; id: string }
  | { resource: 'message'; action: 'delete'; id: string }
  | { resource: 'personalityBase'; id: string; distilledPrompt: string }

function isValidFactCategory(value: string): value is FactCategory {
  return (FACT_CATEGORIES as readonly string[]).includes(value)
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!requireAuth(req, res)) return

  const raw = req.body
  if (!raw || typeof raw !== 'object' || typeof (raw as { resource?: unknown }).resource !== 'string') {
    res.status(400).json({ error: 'invalid request body' })
    return
  }
  const body = raw as MutateBody

  try {
    switch (body.resource) {
      case 'user':
        await updateUser(body.id, body.fields)
        break
      case 'characterState':
        await upsertCharacterState(body.userId, body.fields)
        break
      case 'fact':
        if (body.action === 'create') {
          if (!isValidFactCategory(body.category)) {
            res.status(400).json({ error: 'invalid category' })
            return
          }
          await createFact(body.userId, body.content, body.category)
        } else if (body.action === 'update') {
          const fields = body.fields ?? {}
          if (fields.category !== undefined && !isValidFactCategory(fields.category)) {
            res.status(400).json({ error: 'invalid category' })
            return
          }
          await updateFact(body.id, fields as { content?: string; category?: FactCategory })
        } else if (body.action === 'delete') {
          await deleteFact(body.id)
        } else {
          res.status(400).json({ error: 'unknown fact action' })
          return
        }
        break
      case 'importantDate':
        if (body.action === 'create') {
          await createImportantDate(body.userId, body.fields)
        } else if (body.action === 'update') {
          await updateImportantDate(body.id, body.fields ?? {})
        } else if (body.action === 'delete') {
          await deleteImportantDate(body.id)
        } else {
          res.status(400).json({ error: 'unknown importantDate action' })
          return
        }
        break
      case 'message':
        if (body.action !== 'delete') {
          res.status(400).json({ error: 'unknown message action' })
          return
        }
        await deleteMessage(body.id)
        break
      case 'personalityBase':
        await updatePersonalityBaseDistilledPrompt(body.id, body.distilledPrompt)
        break
      default:
        res.status(400).json({ error: 'unknown resource' })
        return
    }
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('admin mutate failed', err)
    res.status(500).json({ error: 'admin mutate failed' })
  }
}
```

- [ ] **Step 5: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add api/admin
git commit -m "feat: add admin login/logout/data/mutate endpoints"
```

---

### Task 4: Wire admin routes into the dev server + add `ADMIN_PASSWORD`

**Files:**
- Modify: `vite.config.ts`
- Modify: `.env`

**Context:** `vite.config.ts` currently hand-rolls a dev-only middleware mounted at exactly `/api/chat` (production on Vercel auto-maps every file under `api/` to a route with no config needed — this middleware only exists so `npm run dev` behaves the same way). It needs generalizing so `/api/admin/login`, `/api/admin/logout`, `/api/admin/data`, and `/api/admin/mutate` also resolve under `npm run dev`, and so the synthetic response object supports `setHeader` (needed for `Set-Cookie`) and the synthetic request carries `headers` (needed to read the session cookie back).

- [ ] **Step 1: Replace the middleware in `vite.config.ts`**

```ts
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only: makes /api/* work under `npm run dev`, running the exact same
// handler files Vercel's Node runtime calls in production (one file per
// route, auto-mapped by Vercel with no config needed). Vercel pre-parses
// JSON bodies into req.body before invoking a handler, so this mimics that
// instead of having handlers read the raw stream themselves -- otherwise a
// handler would behave differently per environment.
//
// `mountPath` is registered with Vite's connect-based dev middleware, which
// strips that prefix from req.url for the duration of the callback (e.g.
// mounting at '/api/admin' means a request to '/api/admin/login' arrives
// here with req.url === '/login') -- `resolveModulePath` turns whatever's
// left of the url into the '/api/...ts' file to ssrLoadModule.
function apiDevMiddleware(mountPath: string, resolveModulePath: (url: string) => string | null): Plugin {
  return {
    name: `api-dev-middleware${mountPath.replace(/\//g, '-')}`,
    configureServer(server) {
      server.middlewares.use(mountPath, (req, res) => {
        const modulePath = resolveModulePath(req.url ?? '')
        if (!modulePath) {
          res.statusCode = 404
          res.end()
          return
        }
        let raw = ''
        req.on('data', (chunk) => {
          raw += chunk
        })
        req.on('end', async () => {
          try {
            const body = raw ? JSON.parse(raw) : {}
            const { default: handler } = await server.ssrLoadModule(modulePath)
            // `any`: structurally matches ApiResponse in api/lib/adminAuth.ts
            // and api/chat.ts without importing app source into config-time
            // types; dev-only plumbing, not app logic.
            const apiRes: any = {
              status(code: number) {
                res.statusCode = code
                return apiRes
              },
              json(data: unknown) {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(data))
              },
              setHeader(name: string, value: string) {
                res.setHeader(name, value)
              },
            }
            await handler({ method: req.method, url: req.url, body, headers: req.headers }, apiRes)
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'dev middleware failed', detail: String(err) }))
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Loads .env into process.env for server-side code (api/**) during dev.
  // Separate from import.meta.env's VITE_-prefix filtering for the browser
  // bundle -- this does not expose anything to the client.
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }

  return {
    plugins: [
      react(),
      tailwindcss(),
      apiDevMiddleware('/api/chat', () => '/api/chat.ts'),
      apiDevMiddleware('/api/admin', (url) => {
        const path = url.split('?')[0]
        if (!/^\/[a-z]+$/.test(path)) return null
        return `/api/admin${path}.ts`
      }),
    ],
  }
})
```

- [ ] **Step 2: Add `ADMIN_PASSWORD` to `.env`**

Append a new line to the end of `.env` (do not touch the existing secret values already in the file):

```
ADMIN_PASSWORD=
```

Tell the user to fill in a real value before testing login — leave it blank otherwise so `verifyPassword`/`createSessionCookie` fail loudly (`ADMIN_PASSWORD is not set`) rather than silently accepting an empty password.

- [ ] **Step 3: Manual smoke check**

Run: `npm run dev`, then in a second terminal (with `ADMIN_PASSWORD` set in `.env` to e.g. `test123`):

```bash
curl -i -X POST http://localhost:5173/api/admin/login -H "Content-Type: application/json" -d "{\"password\":\"wrong\"}"
```
Expected: `HTTP/1.1 401` and `{"error":"invalid password"}`.

```bash
curl -i -X POST http://localhost:5173/api/admin/login -H "Content-Type: application/json" -d "{\"password\":\"test123\"}"
```
Expected: `HTTP/1.1 200`, a `Set-Cookie: byte_admin_session=...` header, and `{"ok":true}`.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts .env
git commit -m "feat: generalize dev API middleware to serve /api/admin/*"
```

---

### Task 5: End-to-end backend verification before building UI

**Files:** none (verification only) — do this before Task 6 so a UI bug can't hide a broken backend.

- [ ] **Step 1: Log in and capture the session cookie**

```bash
curl -i -c cookies.txt -X POST http://localhost:5173/api/admin/login -H "Content-Type: application/json" -d "{\"password\":\"test123\"}"
```

- [ ] **Step 2: Fetch admin data with the session**

```bash
curl -s -b cookies.txt http://localhost:5173/api/admin/data
```
Expected: 200 JSON containing `users`, `selectedUserId`, `facts`, `messages`, `characterState`, `importantDates`, `personalityBase` — matching what's actually seeded in the connected Supabase project (per `commands/seed-data.md`, at minimum the real user + `is_test` test user).

- [ ] **Step 3: Confirm unauthenticated requests are rejected**

```bash
curl -i http://localhost:5173/api/admin/data
```
Expected: `401` with `{"error":"unauthorized"}`.

- [ ] **Step 4: Exercise a real mutation and confirm it round-trips**

```bash
curl -s -b cookies.txt -X POST http://localhost:5173/api/admin/mutate -H "Content-Type: application/json" -d "{\"resource\":\"fact\",\"action\":\"create\",\"userId\":\"<a real user id from step 2>\",\"content\":\"admin panel smoke test\",\"category\":\"other\"}"
curl -s -b cookies.txt http://localhost:5173/api/admin/data | grep "admin panel smoke test"
```
Expected: the mutate call returns `{"ok":true}`, and the new fact shows up in the follow-up `data` fetch.

- [ ] **Step 5: Clean up the smoke-test fact**

```bash
curl -s -b cookies.txt -X POST http://localhost:5173/api/admin/mutate -H "Content-Type: application/json" -d "{\"resource\":\"fact\",\"action\":\"delete\",\"id\":\"<the fact id just created>\"}"
rm cookies.txt
```

No commit for this task — it's verification, not a code change. If any step fails, fix the relevant Task 1-4 file before proceeding.

---

### Task 6: Frontend types + API client (`src/types/admin.ts`, `src/lib/adminApi.ts`)

**Files:**
- Create: `src/types/admin.ts`
- Create: `src/lib/adminApi.ts`

**Interfaces:**
- Produces: `FACT_CATEGORIES`, `AdminFactCategory`, `AdminUser`, `AdminFact`, `AdminMessage`, `AdminCharacterState`, `AdminImportantDate`, `AdminPersonalityBase` (all from `src/types/admin.ts`); `AdminData` interface, `adminLogin(password)`, `adminLogout()`, `fetchAdminData(userId?)`, `adminMutate(body)` (all from `src/lib/adminApi.ts`). These exact names are consumed by every component in Tasks 7-10.

- [ ] **Step 1: Write `src/types/admin.ts`**

```ts
// src/types/admin.ts
// src/-side mirror of the Supabase row shapes the admin panel needs. src/
// and api/ are separate TypeScript project roots (tsconfig.app.json only
// includes src, tsconfig.node.json only includes api) so this can't import
// api/lib/types.ts directly -- same duplication convention src/types.ts
// already follows for Mood/ChatMessage. Keep in sync with
// supabase/migrations/*.sql and api/lib/types.ts by hand.

export const FACT_CATEGORIES = [
  'likes',
  'dislikes',
  'people',
  'events',
  'running_joke',
  'person',
  'routine',
  'preference',
  'life_event',
  'other',
] as const
export type AdminFactCategory = (typeof FACT_CATEGORIES)[number]

export interface AdminUser {
  id: string
  name: string
  nicknames: string[]
  birthday: string | null
  notes: string | null
  location: string | null
  pronouns: string | null
  is_test: boolean
  created_at: string
}

export interface AdminFact {
  id: string
  user_id: string
  content: string
  category: AdminFactCategory
  confidence: number | null
  created_at: string
  last_referenced_at: string
}

export interface AdminMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  mood: string | null
  created_at: string
}

export interface AdminCharacterState {
  id: string
  user_id: string
  mood: string
  energy: number
  relationship_level: number
  interaction_count: number
  last_seen_at: string | null
  streak_days: number
  personality_notes: string | null
  last_cold_at: string | null
  milestones: string[]
}

export interface AdminImportantDate {
  id: string
  user_id: string
  label: string
  date: string
  recurring: boolean
  notes: string | null
}

export interface AdminPersonalityBase {
  id: string
  version: number
  active: boolean
  distilled_prompt: string
}
```

- [ ] **Step 2: Write `src/lib/adminApi.ts`**

```ts
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
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/admin.ts src/lib/adminApi.ts
git commit -m "feat: add admin panel types and API client"
```

---

### Task 7: Admin UI shell (login, overlay, shared bits)

**Files:**
- Create: `src/components/admin/useSaveStatus.ts`
- Create: `src/components/admin/AdminCard.tsx`
- Create: `src/components/admin/SaveStatusLabel.tsx`
- Create: `src/components/admin/AdminLogin.tsx`
- Create: `src/components/admin/AdminOverlay.tsx`

**Interfaces:**
- Consumes: `adminLogin`, `fetchAdminData`, `AdminData` from `src/lib/adminApi.ts` (Task 6).
- Produces: `useSaveStatus()` returning `{ status: 'idle'|'saving'|'saved'|'error', run(action: () => Promise<void>): void }` (consumed by every section in Tasks 8-10); `<AdminCard title>`, `<SaveStatusLabel status>`; `<AdminOverlay onClose>` (consumed by `App.tsx` in Task 11) which internally renders `<AdminLogin>` or `<AdminPanel>` (Task 10 produces `AdminPanel`, imported here once it exists — until Task 10 lands, leave the import in place; it will not compile standalone, which is expected mid-plan and resolved by Task 10).

- [ ] **Step 1: Write `src/components/admin/useSaveStatus.ts`**

```ts
// src/components/admin/useSaveStatus.ts
// Shared saving/saved/error state machine so each of the six admin sections
// (Tasks 8-10) doesn't reimplement the same three lines of useState.
import { useCallback, useState } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useSaveStatus() {
  const [status, setStatus] = useState<SaveStatus>('idle')

  const run = useCallback((action: () => Promise<void>) => {
    setStatus('saving')
    action()
      .then(() => {
        setStatus('saved')
        setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2000)
      })
      .catch(() => setStatus('error'))
  }, [])

  return { status, run }
}
```

- [ ] **Step 2: Write `src/components/admin/AdminCard.tsx`**

```tsx
// src/components/admin/AdminCard.tsx
import type { ReactNode } from 'react'

interface AdminCardProps {
  title: string
  children: ReactNode
}

export function AdminCard({ title, children }: AdminCardProps) {
  return (
    <section className="rounded-2xl bg-white/5 p-4">
      <h2 className="mb-3 text-sm font-semibold text-white/80">{title}</h2>
      {children}
    </section>
  )
}
```

- [ ] **Step 3: Write `src/components/admin/SaveStatusLabel.tsx`**

```tsx
// src/components/admin/SaveStatusLabel.tsx
import type { SaveStatus } from './useSaveStatus'

export function SaveStatusLabel({ status }: { status: SaveStatus }) {
  if (status === 'saving') return <span className="text-xs text-white/40">Saving...</span>
  if (status === 'saved') return <span className="text-xs text-emerald-400">Saved</span>
  if (status === 'error') return <span className="text-xs text-red-400">Save failed</span>
  return null
}
```

- [ ] **Step 4: Write `src/components/admin/AdminLogin.tsx`**

```tsx
// src/components/admin/AdminLogin.tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { adminLogin } from '../../lib/adminApi'

interface AdminLoginProps {
  onSuccess: () => void
  onClose: () => void
}

export function AdminLogin({ onSuccess, onClose }: AdminLoginProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!password || checking) return
    setChecking(true)
    setError(false)
    const ok = await adminLogin(password)
    setChecking(false)
    if (ok) {
      onSuccess()
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3 rounded-2xl bg-slate-800 p-6 shadow-xl">
        <h2 className="text-sm font-semibold text-white/90">Admin access</h2>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:bg-white/20"
        />
        {error && <p className="text-xs text-red-400">Incorrect password.</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-xs text-white/60 hover:text-white">
            Cancel
          </button>
          <button
            type="submit"
            disabled={checking}
            className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-900 hover:bg-white/90 disabled:opacity-50"
          >
            {checking ? '...' : 'Enter'}
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 5: Write `src/components/admin/AdminOverlay.tsx`**

```tsx
// src/components/admin/AdminOverlay.tsx
import { useEffect, useState } from 'react'
import { AdminLogin } from './AdminLogin'
import { AdminPanel } from './AdminPanel'
import { fetchAdminData } from '../../lib/adminApi'
import type { AdminData } from '../../lib/adminApi'

interface AdminOverlayProps {
  onClose: () => void
}

// null = still checking for an existing session; 'unauthorized' = no/expired
// session, show the password form; AdminData = authorized and loaded.
type OverlayState = AdminData | 'unauthorized' | null

export function AdminOverlay({ onClose }: AdminOverlayProps) {
  const [data, setData] = useState<OverlayState>(null)

  useEffect(() => {
    let cancelled = false
    fetchAdminData().then((result) => {
      if (!cancelled) setData(result ?? 'unauthorized')
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (data === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80">
        <p className="text-sm text-white/60">Loading admin panel...</p>
      </div>
    )
  }

  if (data === 'unauthorized') {
    return (
      <AdminLogin
        onSuccess={() => {
          setData(null)
          fetchAdminData().then((result) => setData(result ?? 'unauthorized'))
        }}
        onClose={onClose}
      />
    )
  }

  return <AdminPanel initialData={data} onClose={onClose} />
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/useSaveStatus.ts src/components/admin/AdminCard.tsx src/components/admin/SaveStatusLabel.tsx src/components/admin/AdminLogin.tsx src/components/admin/AdminOverlay.tsx
git commit -m "feat: add admin panel login and overlay shell"
```

(`npx tsc -b` will still fail after this task — `AdminPanel` doesn't exist until Task 10. That's expected; don't chase it down mid-plan.)

---

### Task 8: Profile and character-state sections

**Files:**
- Create: `src/components/admin/sections/UserSection.tsx`
- Create: `src/components/admin/sections/CharacterStateSection.tsx`

**Interfaces:**
- Consumes: `AdminUser`, `AdminCharacterState` (`src/types/admin.ts`); `adminMutate` (`src/lib/adminApi.ts`); `AdminCard`, `SaveStatusLabel`, `useSaveStatus` (Task 7).
- Produces: `<UserSection user onSaved>`, `<CharacterStateSection userId state onSaved>` — both consumed by `AdminPanel` in Task 10.

- [ ] **Step 1: Write `src/components/admin/sections/UserSection.tsx`**

```tsx
// src/components/admin/sections/UserSection.tsx
import { useState } from 'react'
import type { AdminUser } from '../../../types/admin'
import { adminMutate } from '../../../lib/adminApi'
import { AdminCard } from '../AdminCard'
import { SaveStatusLabel } from '../SaveStatusLabel'
import { useSaveStatus } from '../useSaveStatus'

interface UserSectionProps {
  user: AdminUser
  onSaved: () => void
}

export function UserSection({ user, onSaved }: UserSectionProps) {
  const [name, setName] = useState(user.name)
  const [nicknames, setNicknames] = useState(user.nicknames.join(', '))
  const [birthday, setBirthday] = useState(user.birthday ?? '')
  const [location, setLocation] = useState(user.location ?? '')
  const [pronouns, setPronouns] = useState(user.pronouns ?? '')
  const [notes, setNotes] = useState(user.notes ?? '')
  const { status, run } = useSaveStatus()

  function handleSave() {
    run(async () => {
      await adminMutate({
        resource: 'user',
        id: user.id,
        fields: {
          name,
          nicknames: nicknames.split(',').map((n) => n.trim()).filter(Boolean),
          birthday: birthday || null,
          location: location || null,
          pronouns: pronouns || null,
          notes: notes || null,
        },
      })
      onSaved()
    })
  }

  const inputClass = 'rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:bg-white/20'
  const labelClass = 'flex flex-col gap-1 text-xs text-white/50'

  return (
    <AdminCard title="Profile">
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Nicknames (comma separated)
          <input value={nicknames} onChange={(e) => setNicknames(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Birthday
          <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Location
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Pronouns
          <input value={pronouns} onChange={(e) => setPronouns(e.target.value)} className={inputClass} />
        </label>
        <label className={`${labelClass} col-span-2`}>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        <SaveStatusLabel status={status} />
        <button onClick={handleSave} className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-900 hover:bg-white/90">
          Save
        </button>
      </div>
    </AdminCard>
  )
}
```

- [ ] **Step 2: Write `src/components/admin/sections/CharacterStateSection.tsx`**

```tsx
// src/components/admin/sections/CharacterStateSection.tsx
import { useState } from 'react'
import type { AdminCharacterState } from '../../../types/admin'
import { adminMutate } from '../../../lib/adminApi'
import { AdminCard } from '../AdminCard'
import { SaveStatusLabel } from '../SaveStatusLabel'
import { useSaveStatus } from '../useSaveStatus'

interface CharacterStateSectionProps {
  userId: string
  state: AdminCharacterState | null
  onSaved: () => void
}

export function CharacterStateSection({ userId, state, onSaved }: CharacterStateSectionProps) {
  const [mood, setMood] = useState(state?.mood ?? 'neutral')
  const [energy, setEnergy] = useState(state?.energy ?? 100)
  const [relationshipLevel, setRelationshipLevel] = useState(state?.relationship_level ?? 1)
  const [interactionCount, setInteractionCount] = useState(state?.interaction_count ?? 0)
  const [streakDays, setStreakDays] = useState(state?.streak_days ?? 0)
  const [personalityNotes, setPersonalityNotes] = useState(state?.personality_notes ?? '')
  const { status, run } = useSaveStatus()

  function handleSave() {
    run(async () => {
      await adminMutate({
        resource: 'characterState',
        userId,
        fields: {
          mood,
          energy: Number(energy),
          relationship_level: Number(relationshipLevel),
          interaction_count: Number(interactionCount),
          streak_days: Number(streakDays),
          personality_notes: personalityNotes || null,
        },
      })
      onSaved()
    })
  }

  const inputClass = 'rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:bg-white/20'
  const labelClass = 'flex flex-col gap-1 text-xs text-white/50'

  return (
    <AdminCard title="Character state">
      <div className="grid grid-cols-3 gap-3">
        <label className={labelClass}>
          Mood
          <input value={mood} onChange={(e) => setMood(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Energy (0-100)
          <input type="number" min={0} max={100} value={energy} onChange={(e) => setEnergy(Number(e.target.value))} className={inputClass} />
        </label>
        <label className={labelClass}>
          Relationship level (1-4)
          <input
            type="number"
            min={1}
            max={4}
            value={relationshipLevel}
            onChange={(e) => setRelationshipLevel(Number(e.target.value))}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Interaction count
          <input type="number" min={0} value={interactionCount} onChange={(e) => setInteractionCount(Number(e.target.value))} className={inputClass} />
        </label>
        <label className={labelClass}>
          Streak days
          <input type="number" min={0} value={streakDays} onChange={(e) => setStreakDays(Number(e.target.value))} className={inputClass} />
        </label>
        <label className={`${labelClass} col-span-3`}>
          Personality notes (tell Byte about the user)
          <textarea value={personalityNotes} onChange={(e) => setPersonalityNotes(e.target.value)} rows={3} className={inputClass} />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        <SaveStatusLabel status={status} />
        <button onClick={handleSave} className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-900 hover:bg-white/90">
          Save
        </button>
      </div>
    </AdminCard>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/sections/UserSection.tsx src/components/admin/sections/CharacterStateSection.tsx
git commit -m "feat: add admin profile and character-state sections"
```

---

### Task 9: Facts and important-dates sections

**Files:**
- Create: `src/components/admin/sections/FactsSection.tsx`
- Create: `src/components/admin/sections/ImportantDatesSection.tsx`

**Interfaces:**
- Consumes: `AdminFact`, `AdminImportantDate`, `FACT_CATEGORIES` (`src/types/admin.ts`); `adminMutate`; `AdminCard`, `SaveStatusLabel`, `useSaveStatus`.
- Produces: `<FactsSection userId facts onSaved>`, `<ImportantDatesSection userId dates onSaved>` — consumed by `AdminPanel` in Task 10.

- [ ] **Step 1: Write `src/components/admin/sections/FactsSection.tsx`**

```tsx
// src/components/admin/sections/FactsSection.tsx
import { useState } from 'react'
import type { AdminFact } from '../../../types/admin'
import { FACT_CATEGORIES } from '../../../types/admin'
import { adminMutate } from '../../../lib/adminApi'
import { AdminCard } from '../AdminCard'
import { SaveStatusLabel } from '../SaveStatusLabel'
import { useSaveStatus } from '../useSaveStatus'

interface FactsSectionProps {
  userId: string
  facts: AdminFact[]
  onSaved: () => void
}

export function FactsSection({ userId, facts, onSaved }: FactsSectionProps) {
  const { status, run } = useSaveStatus()
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState<(typeof FACT_CATEGORIES)[number]>('other')

  function saveFact(id: string, content: string, category: string) {
    run(async () => {
      await adminMutate({ resource: 'fact', action: 'update', id, fields: { content, category } })
      onSaved()
    })
  }

  function deleteFact(id: string) {
    run(async () => {
      await adminMutate({ resource: 'fact', action: 'delete', id })
      onSaved()
    })
  }

  function addFact() {
    if (!newContent.trim()) return
    run(async () => {
      await adminMutate({ resource: 'fact', action: 'create', userId, content: newContent.trim(), category: newCategory })
      setNewContent('')
      onSaved()
    })
  }

  return (
    <AdminCard title="Facts">
      <div className="flex flex-col gap-2">
        {facts.map((fact) => (
          <FactRow key={fact.id} fact={fact} onSave={saveFact} onDelete={deleteFact} />
        ))}
        {facts.length === 0 && <p className="text-xs text-white/40">No facts yet.</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="New fact..."
          className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:bg-white/20"
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value as (typeof FACT_CATEGORIES)[number])}
          className="rounded-lg bg-white/10 px-2 py-2 text-sm text-white outline-none"
        >
          {FACT_CATEGORIES.map((c) => (
            <option key={c} value={c} className="text-slate-900">
              {c}
            </option>
          ))}
        </select>
        <button onClick={addFact} className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-900 hover:bg-white/90">
          Add
        </button>
      </div>
      <div className="mt-2 flex justify-end">
        <SaveStatusLabel status={status} />
      </div>
    </AdminCard>
  )
}

interface FactRowProps {
  fact: AdminFact
  onSave: (id: string, content: string, category: string) => void
  onDelete: (id: string) => void
}

function FactRow({ fact, onSave, onDelete }: FactRowProps) {
  const [content, setContent] = useState(fact.content)
  const [category, setCategory] = useState(fact.category)
  const dirty = content !== fact.content || category !== fact.category

  return (
    <div className="flex items-center gap-2">
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white outline-none focus:bg-white/20"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as AdminFact['category'])}
        className="rounded-lg bg-white/10 px-2 py-1.5 text-xs text-white outline-none"
      >
        {FACT_CATEGORIES.map((c) => (
          <option key={c} value={c} className="text-slate-900">
            {c}
          </option>
        ))}
      </select>
      {dirty && (
        <button onClick={() => onSave(fact.id, content, category)} className="text-xs text-emerald-400 hover:text-emerald-300">
          Save
        </button>
      )}
      <button onClick={() => onDelete(fact.id)} className="text-xs text-red-400 hover:text-red-300">
        Delete
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/admin/sections/ImportantDatesSection.tsx`**

```tsx
// src/components/admin/sections/ImportantDatesSection.tsx
import { useState } from 'react'
import type { AdminImportantDate } from '../../../types/admin'
import { adminMutate } from '../../../lib/adminApi'
import { AdminCard } from '../AdminCard'
import { SaveStatusLabel } from '../SaveStatusLabel'
import { useSaveStatus } from '../useSaveStatus'

interface ImportantDatesSectionProps {
  userId: string
  dates: AdminImportantDate[]
  onSaved: () => void
}

export function ImportantDatesSection({ userId, dates, onSaved }: ImportantDatesSectionProps) {
  const { status, run } = useSaveStatus()
  const [label, setLabel] = useState('')
  const [date, setDate] = useState('')
  const [recurring, setRecurring] = useState(false)

  function deleteDate(id: string) {
    run(async () => {
      await adminMutate({ resource: 'importantDate', action: 'delete', id })
      onSaved()
    })
  }

  function addDate() {
    if (!label.trim() || !date) return
    run(async () => {
      await adminMutate({
        resource: 'importantDate',
        action: 'create',
        userId,
        fields: { label: label.trim(), date, recurring, notes: null },
      })
      setLabel('')
      setDate('')
      setRecurring(false)
      onSaved()
    })
  }

  return (
    <AdminCard title="Important dates">
      <div className="flex flex-col gap-2">
        {dates.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
            <span>
              {d.label} — {d.date} {d.recurring ? '(recurring)' : ''}
            </span>
            <button onClick={() => deleteDate(d.id)} className="text-xs text-red-400 hover:text-red-300">
              Delete
            </button>
          </div>
        ))}
        {dates.length === 0 && <p className="text-xs text-white/40">No important dates yet.</p>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label"
          className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:bg-white/20"
        />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:bg-white/20" />
        <label className="flex items-center gap-1 text-xs text-white/50">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
          Recurring
        </label>
        <button onClick={addDate} className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-900 hover:bg-white/90">
          Add
        </button>
      </div>
      <div className="mt-2 flex justify-end">
        <SaveStatusLabel status={status} />
      </div>
    </AdminCard>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/sections/FactsSection.tsx src/components/admin/sections/ImportantDatesSection.tsx
git commit -m "feat: add admin facts and important-dates sections"
```

---

### Task 10: Messages/personality-base sections + panel assembly

**Files:**
- Create: `src/components/admin/sections/MessagesSection.tsx`
- Create: `src/components/admin/sections/PersonalityBaseSection.tsx`
- Create: `src/components/admin/AdminPanel.tsx`

**Interfaces:**
- Consumes: everything from Tasks 6-9 (`AdminData`, `adminLogout`, `fetchAdminData`, all six section components, `AdminCard`).
- Produces: `<AdminPanel initialData onClose>` — this is what `AdminOverlay` (Task 7) renders, completing the compile of the whole `admin/` tree.

- [ ] **Step 1: Write `src/components/admin/sections/MessagesSection.tsx`**

```tsx
// src/components/admin/sections/MessagesSection.tsx
import { adminMutate } from '../../../lib/adminApi'
import type { AdminMessage } from '../../../types/admin'
import { AdminCard } from '../AdminCard'
import { SaveStatusLabel } from '../SaveStatusLabel'
import { useSaveStatus } from '../useSaveStatus'

interface MessagesSectionProps {
  messages: AdminMessage[]
  onSaved: () => void
}

export function MessagesSection({ messages, onSaved }: MessagesSectionProps) {
  const { status, run } = useSaveStatus()

  function deleteMessage(id: string) {
    run(async () => {
      await adminMutate({ resource: 'message', action: 'delete', id })
      onSaved()
    })
  }

  return (
    <AdminCard title="Message history">
      <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
        {messages.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs">
            <span>
              <span className="font-medium text-white/60">{m.role}:</span> {m.content}
            </span>
            <button onClick={() => deleteMessage(m.id)} className="shrink-0 text-red-400 hover:text-red-300">
              Delete
            </button>
          </div>
        ))}
        {messages.length === 0 && <p className="text-xs text-white/40">No messages yet.</p>}
      </div>
      <div className="mt-2 flex justify-end">
        <SaveStatusLabel status={status} />
      </div>
    </AdminCard>
  )
}
```

- [ ] **Step 2: Write `src/components/admin/sections/PersonalityBaseSection.tsx`**

```tsx
// src/components/admin/sections/PersonalityBaseSection.tsx
import { useState } from 'react'
import type { AdminPersonalityBase } from '../../../types/admin'
import { adminMutate } from '../../../lib/adminApi'
import { AdminCard } from '../AdminCard'
import { SaveStatusLabel } from '../SaveStatusLabel'
import { useSaveStatus } from '../useSaveStatus'

interface PersonalityBaseSectionProps {
  personalityBase: AdminPersonalityBase
  onSaved: () => void
}

export function PersonalityBaseSection({ personalityBase, onSaved }: PersonalityBaseSectionProps) {
  const [prompt, setPrompt] = useState(personalityBase.distilled_prompt)
  const { status, run } = useSaveStatus()

  function handleSave() {
    run(async () => {
      await adminMutate({ resource: 'personalityBase', id: personalityBase.id, distilledPrompt: prompt })
      onSaved()
    })
  }

  return (
    <AdminCard title={`Base personality (v${personalityBase.version})`}>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={8}
        className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:bg-white/20"
      />
      <div className="mt-3 flex items-center justify-end gap-3">
        <SaveStatusLabel status={status} />
        <button onClick={handleSave} className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-900 hover:bg-white/90">
          Save
        </button>
      </div>
    </AdminCard>
  )
}
```

- [ ] **Step 3: Write `src/components/admin/AdminPanel.tsx`**

```tsx
// src/components/admin/AdminPanel.tsx
import { useState } from 'react'
import { adminLogout, fetchAdminData } from '../../lib/adminApi'
import type { AdminData } from '../../lib/adminApi'
import { UserSection } from './sections/UserSection'
import { CharacterStateSection } from './sections/CharacterStateSection'
import { FactsSection } from './sections/FactsSection'
import { ImportantDatesSection } from './sections/ImportantDatesSection'
import { MessagesSection } from './sections/MessagesSection'
import { PersonalityBaseSection } from './sections/PersonalityBaseSection'

interface AdminPanelProps {
  initialData: AdminData
  onClose: () => void
}

export function AdminPanel({ initialData, onClose }: AdminPanelProps) {
  const [data, setData] = useState(initialData)
  const [switching, setSwitching] = useState(false)

  async function reload(userId?: string) {
    setSwitching(true)
    const result = await fetchAdminData(userId ?? data.selectedUserId ?? undefined)
    if (result) setData(result)
    setSwitching(false)
  }

  async function handleLogout() {
    await adminLogout()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/95 text-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Byte admin</h1>
          <div className="flex items-center gap-3">
            <select
              value={data.selectedUserId ?? ''}
              disabled={switching}
              onChange={(e) => reload(e.target.value)}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm outline-none"
            >
              {data.users.map((u) => (
                <option key={u.id} value={u.id} className="text-slate-900">
                  {u.name}
                  {u.is_test ? ' (test)' : ''}
                </option>
              ))}
            </select>
            <button onClick={handleLogout} className="text-xs text-white/50 hover:text-white">
              Log out
            </button>
            <button onClick={onClose} className="text-xs text-white/50 hover:text-white">
              Close
            </button>
          </div>
        </header>

        {data.user && <UserSection user={data.user} onSaved={() => reload()} />}
        {data.selectedUserId && (
          <>
            <CharacterStateSection userId={data.selectedUserId} state={data.characterState} onSaved={() => reload()} />
            <FactsSection userId={data.selectedUserId} facts={data.facts} onSaved={() => reload()} />
            <ImportantDatesSection userId={data.selectedUserId} dates={data.importantDates} onSaved={() => reload()} />
          </>
        )}
        <MessagesSection messages={data.messages} onSaved={() => reload()} />
        <PersonalityBaseSection personalityBase={data.personalityBase} onSaved={() => reload()} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -b`
Expected: no errors — this is the first point where the entire `admin/` tree compiles end to end.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/sections/MessagesSection.tsx src/components/admin/sections/PersonalityBaseSection.tsx src/components/admin/AdminPanel.tsx
git commit -m "feat: assemble the admin panel from its sections"
```

---

### Task 11: Hidden entry points in `App.tsx` + full end-to-end verification

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AdminOverlay` from `src/components/admin/AdminOverlay.tsx` (Task 7/10).

- [ ] **Step 1: Add the admin state, `?admin=1` flag, and hidden corner control**

In `src/App.tsx`, add the import near the other component imports:

```ts
import { AdminOverlay } from './components/admin/AdminOverlay'
```

Add state near the other `useState` calls in `function App()`:

```ts
const [showAdmin, setShowAdmin] = useState(false)
```

Add a new `useEffect` (alongside the existing greeting-fetch effect) that checks the URL once on mount:

```ts
useEffect(() => {
  if (new URLSearchParams(window.location.search).get('admin') === '1') {
    setShowAdmin(true)
  }
}, [])
```

At the end of the JSX returned by `App` (as a sibling of the existing top-level `<div className="relative h-svh w-svw ...">`, i.e. inside the outermost fragment/return but not nested inside the character/chat layout), add the hidden hotspot and the overlay:

```tsx
return (
  <div className="relative h-svh w-svw bg-gradient-to-b from-slate-900 to-slate-800 text-white">
    {/* ...unchanged existing content... */}

    {/* Hidden owner-only admin entry point -- nearly invisible on purpose,
        see docs/superpowers/plans/2026-07-08-admin-panel.md. Top-left corner
        is otherwise empty (Go play + chat input live at the bottom). */}
    <button
      type="button"
      aria-label="admin"
      onClick={() => setShowAdmin(true)}
      className="absolute left-0 top-0 h-5 w-5 opacity-0"
    />

    {showAdmin && <AdminOverlay onClose={() => setShowAdmin(false)} />}
  </div>
)
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 3: Run the existing test suite**

Run: `npm test`
Expected: all existing tests plus the new `api/lib/adminAuth.test.ts` pass.

- [ ] **Step 4: Manual end-to-end verification**

With `ADMIN_PASSWORD` set to a real value in `.env`:

1. `npm run dev`, open `http://localhost:5173`.
2. Click the invisible 20x20px hotspot in the top-left corner (or open `http://localhost:5173/?admin=1`) — the password prompt should appear.
3. Enter the wrong password — confirm the inline "Incorrect password." error shows and the field clears.
4. Enter the correct password — confirm the panel loads with the real user's data (profile, character state, facts, important dates, message history, base personality).
5. Edit a fact's content, click Save on that row, confirm "Saved" briefly appears and the row persists across a panel reload (switch users and back, or click Close and reopen).
6. Edit `character_state.personality_notes`, save it, then close the admin panel and send a real chat message via the normal chat input — confirm the model's reply reflects awareness of whatever was just written into `personality_notes` (this is the "immediately affects the next reply" requirement — it works by construction since `/api/chat` reads the same row fresh every turn, but confirm it live once).
7. Click "Log out", then reload with `?admin=1` — confirm the password prompt reappears (session cleared).
8. Wait past nothing (session TTL is 4 hours, not practically testable live) — instead confirm via the Task 1 test suite that expiry logic is covered; no additional manual step needed here.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire hidden admin entry point into App"
```

---

## Self-Review Notes

- **Spec coverage:** hidden entry point (corner control + `?admin=1`) — Task 11; server-side password check + short-lived session, browser never holds the service key — Tasks 1/3/4; all reads/writes via `/api/admin/*` using the service-role client — Tasks 2/3; every table surfaced with edit where sensible, including the "tell Byte about the user" note (`personality_notes`) — Tasks 8-10; edits affect the next `/api/chat` reply — true by construction (Task 2 writes the same tables Task-independent `api/lib/memory.ts` already reads), verified live in Task 11 Step 4.6; no React Router / no new routes — confirmed, `AdminOverlay` is a plain conditional render; Supabase migration only if genuinely needed — none added, no schema changes required for this feature.
- **No placeholders:** every step above has complete, runnable code — none deferred.
- **Type consistency spot-check:** `EditableUserFields`/`EditableCharacterStateFields`/`EditableImportantDateFields` (Task 2) are the exact type names imported in `api/admin/mutate.ts` (Task 3); `AdminData` (Task 6) is the exact shape returned by `api/admin/data.ts` (Task 3) and consumed by `AdminOverlay`/`AdminPanel` (Tasks 7/10); `useSaveStatus`'s `{ status, run }` shape (Task 7) matches every section's usage (Tasks 8-10).
