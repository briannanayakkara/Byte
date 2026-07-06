// TypeScript mirrors of the Supabase schema (spec §5b). Keep in sync with
// supabase/migrations/20260707000000_initial_schema.sql manually -- no
// codegen step in this project yet.

export type Mood = 'happy' | 'curious' | 'sleepy' | 'excited' | 'confused' | 'neutral' | 'lovestruck'

export interface User {
  id: string
  name: string
  nicknames: string[]
  birthday: string | null
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
  user_id: string
  mood: Mood
  energy: number
  relationship_level: number
  interaction_count: number
  last_seen_at: string | null
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
