// Memory read (spec §9 step 7, §5b "How memory flows each turn" step 1).
// Write-back (append messages, update character_state, upsert new_facts) is
// step 8 -- not implemented here.
import { supabase } from './supabase.js'
import type { CharacterState, Fact, ImportantDate, Message, User } from './types.js'

// Freshly-seeded users have no character_state row yet (commands/seed-data.md
// deliberately doesn't seed one -- it's created on a real write, step 8).
// Read-only default so step 7 stays read-only; step 8 owns the first insert.
const DEFAULT_CHARACTER_STATE: Omit<CharacterState, 'id' | 'user_id'> = {
  mood: 'neutral',
  energy: 100,
  relationship_level: 1,
  interaction_count: 0,
  last_seen_at: null,
  streak_days: 0,
  personality_notes: null,
}

export interface MemorySnapshot {
  user: User
  facts: Fact[]
  messages: Message[]
  state: Omit<CharacterState, 'id' | 'user_id'>
  dates: ImportantDate[]
}

// Resolves the active user per spec §5b: `?user=` override (dev/test user)
// takes precedence over the `ACTIVE_USER_ID` env var.
export function resolveUserId(query: URLSearchParams): string {
  const override = query.get('user')
  if (override) return override

  const activeUserId = process.env.ACTIVE_USER_ID
  if (!activeUserId) throw new Error('ACTIVE_USER_ID is not set')
  return activeUserId
}

export async function loadMemory(userId: string): Promise<MemorySnapshot> {
  const [userRes, factsRes, messagesRes, stateRes, datesRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('facts').select('*').eq('user_id', userId).order('last_referenced_at', { ascending: false }).limit(20),
    supabase.from('messages').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(15),
    supabase.from('character_state').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('important_dates').select('*').eq('user_id', userId),
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
    // chronological order for the prompt.
    messages: ((messagesRes.data ?? []) as Message[]).reverse(),
    state: (stateRes.data as CharacterState | null) ?? DEFAULT_CHARACTER_STATE,
    dates: (datesRes.data ?? []) as ImportantDate[],
  }
}
