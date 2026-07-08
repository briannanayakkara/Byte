// src/types/admin.ts
// src/-side mirror of the Supabase row shapes the admin panel needs. src/
// and api/ are separate TypeScript project roots (tsconfig.app.json only
// includes src, tsconfig.node.json only includes api) so this can't import
// api/lib/types.ts directly -- same duplication convention src/types.ts
// already follows for Mood/ChatMessage. Keep in sync with
// supabase/migrations/*.sql and api/lib/types.ts by hand.

export const FACT_CATEGORIES = [
  'likes',
  'dislikes',
  'people',
  'events',
  'running_joke',
  'person',
  'routine',
  'preference',
  'life_event',
  'other',
] as const
export type AdminFactCategory = (typeof FACT_CATEGORIES)[number]

export interface AdminUser {
  id: string
  name: string
  nicknames: string[]
  birthday: string | null
  notes: string | null
  location: string | null
  pronouns: string | null
  is_test: boolean
  created_at: string
}

export interface AdminFact {
  id: string
  user_id: string
  content: string
  category: AdminFactCategory
  confidence: number | null
  created_at: string
  last_referenced_at: string
}

export interface AdminMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  mood: string | null
  created_at: string
}

export interface AdminCharacterState {
  id: string
  user_id: string
  mood: string
  energy: number
  relationship_level: number
  interaction_count: number
  last_seen_at: string | null
  streak_days: number
  personality_notes: string | null
  last_cold_at: string | null
  milestones: string[]
}

export interface AdminImportantDate {
  id: string
  user_id: string
  label: string
  date: string
  recurring: boolean
  notes: string | null
}

export interface AdminPersonalityBase {
  id: string
  version: number
  active: boolean
  distilled_prompt: string
}
