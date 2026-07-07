import type { ChatMessage, Mood } from '../types'

interface ChatResponse {
  reply: string
  mood: Mood
}

// Spec §5: keep the last ~6 messages of browser-held history and send them
// with each request. This is separate from Supabase's longer-term memory
// (spec §5b), which lands server-side in step 7.
const HISTORY_LIMIT = 6

export async function sendChatMessage(message: string, history: ChatMessage[]): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history: history.slice(-HISTORY_LIMIT) }),
  })

  if (!response.ok) {
    throw new Error(`/api/chat responded ${response.status}`)
  }

  return response.json()
}

// Spec §5c "Greeting on return": fetched once on app load, before the user
// has typed anything.
export async function fetchGreeting(): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ greeting: true }),
  })

  if (!response.ok) {
    throw new Error(`/api/chat responded ${response.status}`)
  }

  return response.json()
}
