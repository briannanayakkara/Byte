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
