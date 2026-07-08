// Pure parsing/validation of the LLM's JSON response -- split out from
// chat.ts so it's unit-testable without pulling in chat.ts's Supabase-backed
// imports (memory.ts/personality.ts/memory-write.ts all initialize a real
// Supabase client at import time via ./supabase.js, which throws outside a
// configured environment -- exactly what made this untestable as a plain
// export from chat.ts).
import type { FactCategory, Mood } from './types.js'
import { FACT_CATEGORIES } from './types.js'
import { SELECTABLE_MOODS } from './moods.js'

export interface NewFact {
  content: string
  category: FactCategory
}

function stripCodeFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  return fenced ? fenced[1] : text
}

export function parseModelOutput(
  rawText: string,
  fallbackPersonalityNotes: string | null
): { reply: string; mood: Mood; newFacts: NewFact[]; personalityNotes: string | null } {
  try {
    const parsed = JSON.parse(stripCodeFences(rawText).trim())
    const reply = typeof parsed.reply === 'string' ? parsed.reply : null
    const mood = SELECTABLE_MOODS.includes(parsed.mood) ? (parsed.mood as Mood) : 'neutral'
    const newFacts: NewFact[] = Array.isArray(parsed.new_facts)
      ? parsed.new_facts
          .filter((f: unknown): f is { content: unknown; category: unknown } => !!f && typeof f === 'object')
          .map((f: { content: unknown; category: unknown }) => ({
            content: f.content,
            category: FACT_CATEGORIES.includes(f.category as FactCategory) ? f.category : 'other',
          }))
          .filter((f: { content: unknown; category: FactCategory }): f is NewFact => typeof f.content === 'string' && f.content.trim() !== '')
      : []
    const personalityNotes = typeof parsed.personality_notes === 'string' ? parsed.personality_notes : fallbackPersonalityNotes
    if (reply === null) throw new Error('missing reply field')
    return { reply, mood, newFacts, personalityNotes }
  } catch {
    // Spec §5: fall back to neutral mood + raw text if parsing fails.
    return { reply: rawText, mood: 'neutral', newFacts: [], personalityNotes: fallbackPersonalityNotes }
  }
}

// Small local models don't reliably honor "don't ask a question" in the
// fact monologue (buildFactInstruction, prompt.ts) -- verified live: ~2/5
// replies still ended in a rhetorical tag question ("Isn't that cool?",
// "Amazing, right?"). Deterministically flattens a trailing question into
// a statement rather than leaving it to chance, same principle as
// ensureNameMentioned (chat.ts).
export function stripTrailingQuestion(reply: string): string {
  return /\?+\s*$/.test(reply) ? reply.replace(/\?+\s*$/, '.') : reply
}
