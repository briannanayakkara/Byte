// Memory write-back (spec §9 step 8, §5b "How memory flows each turn" step
// 3). Called best-effort from chat.ts -- a failure here must never turn a
// successful LLM reply into a 500 for the browser.
import { supabase } from './supabase.js'
import { canCatchCold, computeEnergy, computeStreak, newMilestones, relationshipLevel } from './relationship.js'
import type { CharacterState, Mood } from './types.js'

interface SaveTurnInput {
  userMessage: string
  reply: string
  mood: Mood
  newFacts: string[]
  personalityNotes: string | null
}

export async function saveTurn(
  userId: string,
  priorState: Omit<CharacterState, 'id' | 'user_id'>,
  { userMessage, reply, mood, newFacts, personalityNotes }: SaveTurnInput
): Promise<void> {
  const now = new Date().toISOString()
  // §5: a cold's onset is the turn mood first lands on "sick" -- only stamps
  // last_cold_at when the rate-limit actually allowed it, so a model that
  // (incorrectly) picks "sick" again mid-cooldown doesn't push the cooldown
  // out further.
  const coldOnset = mood === 'sick' && canCatchCold(priorState.last_cold_at)
  const nextInteractionCount = priorState.interaction_count + 1
  const nextStreakDays = computeStreak(priorState.last_seen_at, priorState.streak_days)
  const nextRelationshipLevel = relationshipLevel(nextInteractionCount)
  // Recomputed independently from the same unmodified priorState chat.ts
  // used to predict signals for the prompt -- same split as computeEnergy's,
  // so this doesn't depend on (or duplicate) what the prompt-building code did.
  const milestonesToAdd = newMilestones(
    { interactionCount: priorState.interaction_count, streakDays: priorState.streak_days, relationshipLevel: priorState.relationship_level },
    { interactionCount: nextInteractionCount, streakDays: nextStreakDays, relationshipLevel: nextRelationshipLevel },
    priorState.milestones
  )

  await Promise.all([
    supabase.from('messages').insert([
      { user_id: userId, role: 'user', content: userMessage },
      { user_id: userId, role: 'assistant', content: reply, mood },
    ]),
    // RPC instead of a plain upsert (design doc
    // docs/superpowers/specs/2026-07-07-byte-v3-character-and-continuity-design.md
    // §4): interaction_count/relationship_level increment atomically
    // in Postgres against the row's current value, not a client-side
    // snapshot -- see supabase/migrations/20260707010000_atomic_character_turn_upsert.sql.
    supabase.rpc('upsert_character_turn', {
      p_user_id: userId,
      p_mood: mood,
      p_energy: computeEnergy(priorState.last_seen_at, priorState.energy),
      p_last_seen_at: now,
      p_streak_days: nextStreakDays,
      p_cold_onset: coldOnset,
      p_new_milestones: milestonesToAdd,
      p_personality_notes: personalityNotes ?? priorState.personality_notes ?? '',
    }),
    ...newFacts.map((content) => upsertFact(userId, content)),
  ])
}

// Dedup against existing facts by content (spec §5b: "deduped against
// existing ones") -- bump last_referenced_at on a repeat instead of
// inserting a duplicate row.
async function upsertFact(userId: string, content: string): Promise<void> {
  const { data: existing } = await supabase
    .from('facts')
    .select('id')
    .eq('user_id', userId)
    .ilike('content', content)
    .maybeSingle()

  if (existing) {
    await supabase.from('facts').update({ last_referenced_at: new Date().toISOString() }).eq('id', existing.id)
  } else {
    await supabase.from('facts').insert({ user_id: userId, content, category: 'other' })
  }
}

// Design doc docs/superpowers/specs/2026-07-07-byte-v3-character-and-continuity-design.md
// §3: closes the greeting path's previous read-only behavior. Unlike
// saveTurn, this deliberately touches ONLY mood/energy -- never
// interaction_count/relationship_level/streak_days/last_seen_at/
// personality_notes/milestones. Opening the app is Byte noticing you're
// there, not a conversation; the
// relationship must only deepen from a real back-and-forth turn. For a
// brand-new user with no character_state row yet, the INSERT path falls
// back to the table's own column defaults (relationship_level 1,
// interaction_count 0, streak_days 0) for everything not given here --
// correct for a first-ever greeting with no history. For a returning
// user, the UPDATE path (on conflict) touches only mood/energy, leaving
// every relationship field untouched.
export async function saveGreeting(userId: string, mood: Mood, energy: number): Promise<void> {
  await supabase.from('character_state').upsert({ user_id: userId, mood, energy }, { onConflict: 'user_id' })
}
