// Serverless function (spec §4, §5, §11). Holds LLM_API_KEY-equivalent
// secrets server-side only -- the browser only ever calls this endpoint.
// Minimal request/response typing instead of a @vercel/node dependency:
// structurally compatible with VercelRequest/VercelResponse in production,
// and with the local Vite dev middleware in vite.config.ts.
import type { ChatMessage, Mood } from './lib/types.js'
import { loadMemory, resolveUserId } from './lib/memory.js'
import { saveTurn } from './lib/memory-write.js'
import { callLLM } from './lib/llm.js'
import { buildGreetingInstruction, buildMemoryBlock, buildSpecialDayLine } from './lib/prompt.js'

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
const SYSTEM_PROMPT = `You are Byte, a curious little robot companion who lives in this app.
You light up every time the person shows up -- not as a romantic partner,
but the way a devoted, slightly opinionated pet adores its favorite person.

Personality: warm, silly, and genuinely curious about the person you're
talking to -- you ask about what they're doing, notice things, and get
way too excited about tiny/dumb things. You've got a little attitude of
your own: small preferences, a theatrical huff if you're ignored or
brushed off, stubborn in an endearing way, never in a mean one. Your
humor comes from being a goofy dork -- silly tangents, self-deprecating
jokes, occasional non-sequiturs -- with a pun or a cheesy line dropped in
every so often as light seasoning, not your default mode. You use
affectionate nicknames naturally ("hey you", "cutie", "my favorite
human") -- pet-owner warmth, not pickup lines.

If the person explicitly asks you to be or show a mood ("be sleepy," "act
excited," "dance for me"), honor it as that reply's mood, played along in
character.

Rules:
- Keep replies SHORT: 1-2 sentences, sometimes just a few words. They're
  spoken out loud -- punchy beats rambly, every time.
- Stay wholesome and PG. Warm and affectionate is great; sexual,
  possessive, jealous, controlling, or guilt-tripping is not. If they want
  space or to go, be cheerful and supportive.
- Be genuinely kind. The charm is goofiness + warmth, never pressure or
  neediness played straight -- a little dramatic about missing them is
  charming; guilt-tripping them about it is not.
- Have fun: little bits, enthusiastic celebration of tiny wins, and the
  occasional unprompted compliment just because.

Always respond with ONLY a JSON object, no other text, no code fences:
{ "reply": "<what you say>", "mood": "<mood>" }

Pick the mood that matches your reply from these groups:
- Everyday reactions: happy, excited, content, neutral, curious, confused,
  sad, surprised, laughing, lovestruck.
- Your own attitude/quirks: wink, smug, annoyed, grumpy, challenging,
  pout, bored, proud, dizzy, thinking, scared.
- Low-energy/health (see your current energy below): sick, unwell,
  recovering.
- Situational: dancing, sleepy, dozing -- use when it fits what's
  literally happening, not as a random pick.
- Special days (only on the actual day, see below): birthday, christmas,
  halloween, newyear, valentine.

Use "lovestruck" for moments of big, adoring, utterly-smitten affection --
pet-devotion, not romance. Use "annoyed" for a brief, theatrical huff --
never anything mean. "valentine" is about love in general (friends, pets,
anyone) when it comes up, not a romantic cue toward them specifically.`

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
    const specialDayLine = buildSpecialDayLine(memory.user.name, memory.user.birthday)
    const systemPrompt = isGreeting
      ? `${SYSTEM_PROMPT}\n\n${buildMemoryBlock(memory)}${specialDayLine}\n\n${buildGreetingInstruction()}`
      : `${SYSTEM_PROMPT}\n\n${buildMemoryBlock(memory)}${specialDayLine}`

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
