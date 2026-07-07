// Serverless function (spec §4, §5, §11). Holds LLM_API_KEY-equivalent
// secrets server-side only -- the browser only ever calls this endpoint.
// Minimal request/response typing instead of a @vercel/node dependency:
// structurally compatible with VercelRequest/VercelResponse in production,
// and with the local Vite dev middleware in vite.config.ts.
import type { ChatMessage, Mood } from './lib/types.js'
import { loadMemory, resolveUserId, toChatHistory } from './lib/memory.js'
import { saveGreeting, saveTurn } from './lib/memory-write.js'
import { callLLM } from './lib/llm.js'
import { buildGreetingInstruction, buildMemoryBlock, buildOutputFormatInstructions, buildSpecialDayLine } from './lib/prompt.js'
import { canCatchCold, computeEnergy, computeStreak, newMilestones, relationshipLevel } from './lib/relationship.js'
import { SELECTABLE_MOODS } from './lib/moods.js'
import { loadActiveBasePersonality } from './lib/personality.js'

interface ApiRequest {
  method?: string
  url?: string
  body?: unknown
}

interface ApiResponse {
  status(code: number): ApiResponse
  json(body: unknown): void
}

// Small local models don't reliably follow "always say their name" in a
// long prompt -- if it's missing, swap a generic greeting-opener for a
// named one rather than trusting the model every time.
const GENERIC_OPENERS = /^(hey|hi|hello|aw|oh|omg)\s+(you|there)\b[,!.]?\s*/i

function ensureNameMentioned(reply: string, name: string): string {
  if (reply.toLowerCase().includes(name.toLowerCase())) return reply
  if (GENERIC_OPENERS.test(reply)) return reply.replace(GENERIC_OPENERS, `Hey ${name}! `)
  return `Hey ${name}! ${reply}`
}

function stripCodeFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  return fenced ? fenced[1] : text
}

function parseModelOutput(
  rawText: string,
  fallbackPersonalityNotes: string | null
): { reply: string; mood: Mood; newFacts: string[]; personalityNotes: string | null } {
  try {
    const parsed = JSON.parse(stripCodeFences(rawText).trim())
    const reply = typeof parsed.reply === 'string' ? parsed.reply : null
    const mood = SELECTABLE_MOODS.includes(parsed.mood) ? (parsed.mood as Mood) : 'neutral'
    const newFacts = Array.isArray(parsed.new_facts) ? parsed.new_facts.filter((f: unknown) => typeof f === 'string') : []
    const personalityNotes = typeof parsed.personality_notes === 'string' ? parsed.personality_notes : fallbackPersonalityNotes
    if (reply === null) throw new Error('missing reply field')
    return { reply, mood, newFacts, personalityNotes }
  } catch {
    // Spec §5: fall back to neutral mood + raw text if parsing fails.
    return { reply: rawText, mood: 'neutral', newFacts: [], personalityNotes: fallbackPersonalityNotes }
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = (req.body ?? {}) as { message?: unknown; greeting?: unknown }
  const isGreeting = body.greeting === true
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!isGreeting && !message) {
    res.status(400).json({ error: 'message is required' })
    return
  }

  try {
    const query = new URL(req.url ?? '', 'http://localhost').searchParams
    const userId = resolveUserId(query)
    const [memory, basePersonality] = await Promise.all([loadMemory(userId), loadActiveBasePersonality()])
    // Final-review finding: buildMemoryBlock must see the energy value this
    // turn will actually act on (already decayed for time elapsed since
    // last_seen_at), not the stale raw value stored at the end of the last
    // session -- otherwise a long-absent return reads as full-energy on the
    // first message back and the sick/low-energy arc only shows up starting
    // the second message, one turn later than the design intends. Building
    // a new object here (not mutating memory.state) so saveTurn below still
    // receives the original raw priorState -- it independently recomputes
    // the identical value from the same unmodified inputs for storage, so
    // this change doesn't affect what gets persisted, only what the LLM
    // sees when describing its current state for this reply.
    const promptMemory = { ...memory, state: { ...memory.state, energy: computeEnergy(memory.state.last_seen_at, memory.state.energy) } }
    const specialDayLine = buildSpecialDayLine(memory.user.name, memory.user.birthday)
    const coldAvailable = canCatchCold(memory.state.last_cold_at)
    const predictedInteractionCount = memory.state.interaction_count + 1
    const predictedStreakDays = computeStreak(memory.state.last_seen_at, memory.state.streak_days)
    const predictedRelationshipLevel = relationshipLevel(predictedInteractionCount)
    const crossedMilestones = isGreeting
      ? []
      : newMilestones(
          { interactionCount: memory.state.interaction_count, streakDays: memory.state.streak_days, relationshipLevel: memory.state.relationship_level },
          { interactionCount: predictedInteractionCount, streakDays: predictedStreakDays, relationshipLevel: predictedRelationshipLevel },
          memory.state.milestones
        )
    const signals = { coldAvailable, newMilestone: crossedMilestones[0] ?? null }
    // Assembly order per docs/byte-base-personality.md §10: fixed soul, then
    // the evolving memory block, then mechanical output-format instructions.
    const systemPrompt = isGreeting
      ? `${basePersonality}\n\n${buildMemoryBlock(promptMemory, signals)}${specialDayLine}\n\n${buildGreetingInstruction()}\n\n${buildOutputFormatInstructions()}`
      : `${basePersonality}\n\n${buildMemoryBlock(promptMemory, signals)}${specialDayLine}\n\n${buildOutputFormatInstructions()}`

    // Greeting mode (spec §5c "Greeting on return"): no user message exists
    // yet, so there's no conversational turn to save -- but the resulting
    // mood/energy DO get saved (below, via saveGreeting), so Byte's state
    // stays continuous across devices instead of being thrown away
    // (design doc docs/superpowers/specs/2026-07-07-byte-v3-character-and-continuity-design.md
    // §3).
    const messages: ChatMessage[] = isGreeting
      ? [{ role: 'user', content: '(the app just opened -- say hello, no user message yet)' }]
      : [...toChatHistory(memory.messages), { role: 'user', content: message }]
    // Single call: new_facts (spec §5b) is parsed out of this same JSON
    // response below, not a second round-trip.
    const rawText = await callLLM(systemPrompt, messages)
    const parsed = parseModelOutput(rawText, memory.state.personality_notes)
    const { mood, newFacts, personalityNotes } = parsed
    // The greeting prompt asks the model to always use the person's name,
    // but small local models don't reliably follow that -- guarantee it
    // deterministically rather than leaving it to chance.
    const reply = isGreeting ? ensureNameMentioned(parsed.reply, memory.user.name) : parsed.reply

    if (isGreeting) {
      try {
        await saveGreeting(userId, mood, promptMemory.state.energy)
      } catch (writeError) {
        console.error('greeting memory write failed', writeError)
      }
    } else {
      try {
        await saveTurn(userId, memory.state, { userMessage: message, reply, mood, newFacts, personalityNotes })
      } catch (writeError) {
        // Best-effort (spec §9 step 8 / api-docs endpoints.md): a write
        // failure must not turn a successful reply into a 500 for the user.
        console.error('memory write failed', writeError)
      }
    }

    res.status(200).json({ reply, mood })
  } catch (err) {
    console.error('chat request failed', err)
    // Never leak stack traces or key names in the error body (spec's own
    // security posture) -- the browser's fallback is the in-character
    // "confused" line from spec §8, not this message.
    res.status(500).json({ error: 'chat request failed' })
  }
}
