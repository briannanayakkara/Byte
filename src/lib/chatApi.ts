import type { Mood } from '../types'

interface ChatResponse {
  reply: string
  mood: Mood
}

export async function sendChatMessage(message: string): Promise<ChatResponse> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
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

// docs/superpowers/specs/2026-07-08-go-play-mode-design.md §3: fetched
// repeatedly while the "go play" loop is running. Deliberately typed
// without `mood` -- the server never returns one for this request shape
// (the play loop's own activity mood is what's actually displayed).
export async function fetchPlayFact(): Promise<{ reply: string }> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fact: true }),
  })

  if (!response.ok) {
    throw new Error(`/api/chat responded ${response.status}`)
  }

  return response.json()
}
