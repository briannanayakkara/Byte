// Memory write-back (spec §9 step 8, §5b "How memory flows each turn" step
// 3). Called best-effort from chat.ts -- a failure here must never turn a
// successful LLM reply into a 500 for the browser.
import { supabase } from './supabase.js'
import { computeStreak, relationshipLevel } from './relationship.js'
import type { CharacterState, Mood } from './types.js'

interface SaveTurnInput {
  userMessage: string
  reply: string
  mood: Mood
  newFacts: string[]
}

export async function saveTurn(
  userId: string,
  priorState: Omit<CharacterState, 'id' | 'user_id'>,
  { userMessage, reply, mood, newFacts }: SaveTurnInput
): Promise<void> {
  const now = new Date().toISOString()
  const interactionCount = priorState.interaction_count + 1

  await Promise.all([
    supabase.from('messages').insert([
      { user_id: userId, role: 'user', content: userMessage },
      { user_id: userId, role: 'assistant', content: reply, mood },
    ]),
    // upsert, not update: the first-ever turn for a user has no existing
    // character_state row (spec §9 step 6 seeding deliberately skips it).
    supabase.from('character_state').upsert(
      {
        user_id: userId,
        mood,
        energy: priorState.energy,
        interaction_count: interactionCount,
        last_seen_at: now,
        relationship_level: relationshipLevel(interactionCount),
        streak_days: computeStreak(priorState.last_seen_at, priorState.streak_days),
      },
      { onConflict: 'user_id' }
    ),
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
