// Loads the FIXED base personality layer (docs/byte-base-personality.md,
// stored in personality_base per its §10). Read-only at runtime -- nothing in
// this codebase ever writes to personality_base outside a migration/seed.
import { supabase } from './supabase.js'

export async function loadActiveBasePersonality(): Promise<string> {
  const { data, error } = await supabase.from('personality_base').select('distilled_prompt').eq('active', true).single()
  if (error) throw error
  return data.distilled_prompt as string
}
