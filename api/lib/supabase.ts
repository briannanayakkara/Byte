// Service-role Supabase client (spec §5b, §11) -- server-side only, bypasses
// RLS. Imported solely by api/chat.ts; the browser never talks to Supabase.
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set')
}

export const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
})
