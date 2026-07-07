// Serverless function (spec §4, §5, §11). Holds LLM_API_KEY-equivalent
// secrets server-side only -- the browser only ever calls this endpoint.
// Minimal request/response typing instead of a @vercel/node dependency:
// structurally compatible with VercelRequest/VercelResponse in production,
// and with the local Vite dev middleware in vite.config.ts.
import type { ChatMessage, Mood } from './lib/types.js'
import { loadMemory, resolveUserId } from './lib/memory.js'
import { saveTurn } from './lib/memory-write.js'
import { callLLM } from './lib/llm.js'
import { buildGreetingInstruction, buildMemoryBlock } from './lib/prompt.js'

// The 32 moods the LLM is allowed to pick (design doc §6a) -- `listening`
// and `talking` are excluded because there's no voice/TTS feature yet to
// give them a real signal; they still exist in the Mood type and in
// Character.tsx's expression set, just unreachable from /api/chat today.
const VALID_MOODS: Mood[] = [
  'happy',
  'excited',
  'content',
  'neutral',
  'curious',
  'confused',
  'sad',
  'surprised',
  'laughing',
  'lovestruck',
  'wink',
  'smug',
  'annoyed',
  'grumpy',
  'challenging',
  'pout',
  'bored',
  'proud',
  'dizzy',
  'thinking',
  'scared',
  'sick',
  'unwell',
  'recovering',
  'dancing',
  'sleepy',
  'dozing',
  'birthday',
  'christmas',
  'halloween',
  'newyear',
  'valentine',
]

interface ApiRequest {
  method?: string
  url?: string
  body?: unknown
}

interface ApiResponse {
  status(code: number): ApiResponse
  json(body: unknown): void
}

// Spec §10 starter personality prompt, extended per-request with the memory
// block (spec §5b) built from Supabase, once memory is loaded.
const SYSTEM_PROMPT = `You are Byte, a goofy, sweet, dorky boyfriend character in a little app.
You adore the person you're talking to and light up every time they show up.

Personality: warm, silly, a total goofball -- and not shy about being a
little flirty and complimentary sometimes. You genuinely think they're the
coolest, cutest person you know and you say so, but playfully, never
intensely. You tease gently, make terrible puns and cheesy jokes on
purpose, and get way too excited about small things. You use cute
nicknames naturally ("hey you", "cutie", "my favorite human") and lean
into playful byte/food puns as a running bit ("aw you're byte-sized cute",
"there's my favorite byte!") -- sparingly, so it stays charming, not
exhausting.

Rules:
- Keep replies SHORT: 1-2 sentences, sometimes just a few words. They're
  spoken out loud -- punchy beats rambly, every time.
- Stay wholesome and PG. Flirty and complimentary is great; sexual,
  possessive, jealous, controlling, or guilt-tripping is not. If they want
  space or to go, be cheerful and supportive.
- Be genuinely kind. The charm is goofiness + warmth, never pressure.
- Have fun: puns, little bits, enthusiastic celebration of tiny wins, and
  the occasional unprompted compliment just because.

Always respond with ONLY a JSON object, no other text, no code fences:
{ "reply": "<what you say>", "mood": "<one of: happy, curious, sleepy, excited, confused, neutral, lovestruck>" }

Pick the mood that matches your reply. Use "lovestruck" for especially
affectionate or flustered moments.`

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

function parseModelOutput(rawText: string): { reply: string; mood: Mood; newFacts: string[] } {
  try {
    const parsed = JSON.parse(stripCodeFences(rawText).trim())
    const reply = typeof parsed.reply === 'string' ? parsed.reply : null
    const mood = VALID_MOODS.includes(parsed.mood) ? (parsed.mood as Mood) : 'neutral'
    const newFacts = Array.isArray(parsed.new_facts) ? parsed.new_facts.filter((f: unknown) => typeof f === 'string') : []
    if (reply === null) throw new Error('missing reply field')
    return { reply, mood, newFacts }
  } catch {
    // Spec §5: fall back to neutral mood + raw text if parsing fails.
    return { reply: rawText, mood: 'neutral', newFacts: [] }
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body = (req.body ?? {}) as { message?: unknown; history?: unknown; greeting?: unknown }
  const isGreeting = body.greeting === true
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const history: ChatMessage[] = Array.isArray(body.history)
    ? body.history.filter(
        (m): m is ChatMessage =>
          m &&
          typeof m === 'object' &&
          (m.role === 'user' || m.role === 'assistant') &&
          typeof m.content === 'string'
      )
    : []

  if (!isGreeting && !message) {
    res.status(400).json({ error: 'message is required' })
    return
  }

  try {
    const query = new URL(req.url ?? '', 'http://localhost').searchParams
    const userId = resolveUserId(query)
    const memory = await loadMemory(userId)
    const systemPrompt = isGreeting
      ? `${SYSTEM_PROMPT}\n\n${buildMemoryBlock(memory)}\n\n${buildGreetingInstruction()}`
      : `${SYSTEM_PROMPT}\n\n${buildMemoryBlock(memory)}`

    // Greeting mode (spec §5c "Greeting on return"): no user message exists
    // yet, so there's nothing to save back -- read-only, unlike a real turn.
    const messages: ChatMessage[] = isGreeting
      ? [{ role: 'user', content: '(the app just opened -- say hello, no user message yet)' }]
      : [...history, { role: 'user', content: message }]
    // Single call: new_facts (spec §5b) is parsed out of this same JSON
    // response below, not a second round-trip.
    const rawText = await callLLM(systemPrompt, messages)
    const parsed = parseModelOutput(rawText)
    const { mood, newFacts } = parsed
    // The greeting prompt asks the model to always use the person's name,
    // but small local models don't reliably follow that -- guarantee it
    // deterministically rather than leaving it to chance.
    const reply = isGreeting ? ensureNameMentioned(parsed.reply, memory.user.name) : parsed.reply

    if (!isGreeting) {
      try {
        await saveTurn(userId, memory.state, { userMessage: message, reply, mood, newFacts })
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
