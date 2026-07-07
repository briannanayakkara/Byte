// LLM provider: local Ollama. api/chat.ts only depends on callLLM's
// signature -- swapping to Gemini, Claude Haiku, etc. later means rewriting
// this file's body, nothing else.
//
// Local-only: a cloud serverless function can't reach localhost, so this
// (and /api/chat as a whole) only runs via the local Vite dev server for
// now, not a Vercel/Cloudflare deploy.
import type { ChatMessage } from './types.js'
import { FACT_CATEGORIES } from './types.js'
import { SELECTABLE_MOODS } from './moods.js'

interface OllamaResponse {
  message?: { content?: string }
}

// A bare "format": "json" only guarantees *valid* JSON, not this *shape* --
// llama3.1:8b, under the full personality+memory system prompt, regularly
// omitted or emptied "new_facts" with that alone (verified against a
// running local Ollama). A JSON Schema constrains the model's decoding to
// always include all fields, which fixed it in the same test. The mood enum
// comes from SELECTABLE_MOODS (api/lib/moods.ts) -- previously hardcoded to
// 7 values here while the prompt offered ~43, silently making most moods
// impossible outputs.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    mood: { type: 'string', enum: SELECTABLE_MOODS },
    new_facts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          content: { type: 'string' },
          category: { type: 'string', enum: FACT_CATEGORIES },
        },
        required: ['content', 'category'],
      },
    },
  },
  required: ['reply', 'mood', 'new_facts'],
}

export async function callLLM(systemPrompt: string, messages: ChatMessage[]): Promise<string> {
  const baseUrl = process.env.OLLAMA_URL
  const model = process.env.OLLAMA_MODEL
  if (!baseUrl) throw new Error('OLLAMA_URL is not set')
  if (!model) throw new Error('OLLAMA_MODEL is not set')

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      format: RESPONSE_SCHEMA,
      stream: false,
      options: { num_predict: 200 },
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama responded ${response.status}`)
  }

  const data = (await response.json()) as OllamaResponse
  const text = data.message?.content
  if (typeof text !== 'string') {
    throw new Error('Ollama response had no message content')
  }
  return text
}
