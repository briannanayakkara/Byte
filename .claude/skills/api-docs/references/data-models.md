# Data models

TypeScript mirrors of the Supabase schema in spec §5b. These belong in a
shared server-side types file once `/api` exists (step 5) — don't duplicate
them ad hoc per query.

```ts
export type Mood =
  | 'happy' | 'curious' | 'sleepy' | 'excited'
  | 'confused' | 'neutral' | 'lovestruck'

export interface User {
  id: string // uuid
  name: string
  nicknames: string[]
  birthday: string | null // date
  notes: string | null
  is_test: boolean
  created_at: string
}

export interface Fact {
  id: string
  user_id: string
  content: string
  category: 'likes' | 'dislikes' | 'people' | 'events' | 'other'
  confidence: number | null
  created_at: string
  last_referenced_at: string
}

export interface Message {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  mood: Mood | null
  created_at: string
}

export interface CharacterState {
  id: string
  user_id: string // unique — one row per user (spec §5b)
  mood: Mood
  energy: number // 0-100
  relationship_level: number
  interaction_count: number
  last_seen_at: string
  streak_days: number
  personality_notes: string | null
}

export interface ImportantDate {
  id: string
  user_id: string
  label: string
  date: string
  recurring: boolean
  notes: string | null
}
```

Keep this file and the actual Supabase migration SQL (added in step 6) in
sync manually — there's no codegen step in this project yet.
