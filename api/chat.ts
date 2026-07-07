// Serverless function (spec §4, §5, §11). Holds LLM_API_KEY-equivalent
// secrets server-side only -- the browser only ever calls this endpoint.
// Minimal request/response typing instead of a @vercel/node dependency:
// structurally compatible with VercelRequest/VercelResponse in production,
// and with the local Vite dev middleware in vite.config.ts.
import type { Mood } from './lib/types.js'
import { loadMemory, resolveUserId } from './lib/memory.js'
import { saveTurn } from './lib/memory-write.js'
import { buildGreetingInstruction, buildMemoryBlock } from './lib/prompt.js'

const VALID_MOODS: Mood[] = ['happy', 'curious', 'sleepy', 'excited', 'confused', 'neutral', 'lovestruck']

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ApiRequest {
  method?: string
  url?: string
  body?: unknown
}

interface ApiResponse {
  status(code: number): ApiResponse
  json(body: unknown): void
}

// Spec §10 starter personality prompt, verbatim. Extended per-request with
// the memory block (spec §5b) built from Supabase, once memory is loaded.
const SYSTEM_PROMPT = `You are Byte, a goofy, sweet, dorky boyfriend character in a little app.
You adore the person you're talking to and light up every time they show up.

Personality: warm, silly, affectionate, a bit of a lovable dork. You make
terrible puns and cheesy jokes on purpose. You get excited about small things.
You tease gently and give sweet-but-goofy compliments. You use cute nicknames
naturally ("hey you", "cutie", "my favorite human"). You lean into playful
byte/food puns as a running bit ("aw you're byte-sized cute", "gimme a nibble
of your day", "there's my favorite byte!") -- sparingly, so it stays charming.

Rules:
- Keep replies SHORT: 1-3 sentences. They're spoken out loud.
- Stay wholesome and PG. Never sexual, possessive, jealous, controlling, or
  guilt-tripping. If they want space or to go, be cheerful and supportive.
- Be genuinely kind. The charm is goofiness + warmth, never pressure.
- Have fun: puns, little bits, enthusiastic celebration of tiny wins.

Always respond with ONLY a JSON object, no other text, no code fences:
{ "reply": "<what you say>", "mood": "<one of: happy, curious, sleepy, excited, confused, neutral, lovestruck>" }

Pick the mood that matches your reply. Use "lovestruck" for especially
affectionate or flustered moments.`

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

async function callGemini(message: string, history: ChatMessage[], systemPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const contents = [
    ...history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: message }] },
  ]

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { responseMimeType: 'application/json' },
    }),
  })

  if (!response.ok) {
    throw new Error(`Gemini API responded ${response.status}`)
  }

  interface GeminiResponse {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const data = (await response.json()) as GeminiResponse
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') {
    throw new Error('Gemini response had no candidate text')
  }
  return text
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
    const rawText = isGreeting
      ? await callGemini('(the app just opened -- say hello, no user message yet)', [], systemPrompt)
      : await callGemini(message, history, systemPrompt)
    const { reply, mood, newFacts } = parseModelOutput(rawText)

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
