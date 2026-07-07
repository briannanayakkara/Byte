// Pure functions for character_state derived fields (spec §5b "Relationship
// levels" and "streak tracking" §9 step 9), kept independently testable per
// query-patterns.md.

const ENERGY_FULL_HOURS = 6 // no decay at all within this window since last contact
const ENERGY_FLOOR_HOURS = 72 // 3 days -- fully decayed to the floor by this point
const ENERGY_FLOOR = 30 // never drops below this -- EMO gets bored, it doesn't shut down
const ENERGY_INTERACTION_BUMP = 8 // added on every new turn, capped at 100

// Mirrored in supabase/migrations/20260707010000_atomic_character_turn_upsert.sql's
// upsert_character_turn() CASE expression for atomic writes (design doc
// docs/superpowers/specs/2026-07-07-byte-v3-character-and-continuity-design.md
// §4) -- no longer called from the write path (saveTurn in memory-write.ts
// uses the SQL function instead), kept here as the single TypeScript-side
// reference for the bucket thresholds. A future threshold change must
// update both places.
export function relationshipLevel(interactionCount: number): 1 | 2 | 3 | 4 {
  if (interactionCount < 5) return 1 // New
  if (interactionCount < 20) return 2 // Warming up
  if (interactionCount < 60) return 3 // Close
  return 4 // Best friend / partner
}

function utcDateKey(iso: string): string {
  return iso.slice(0, 10) // YYYY-MM-DD
}

// Streak semantics aren't specified in the spec -- UTC calendar-day
// comparison, chosen since the server has no per-user timezone concept:
// - no prior visit -> 1 (first-ever interaction)
// - same UTC day as last visit -> unchanged (already counted today)
// - exactly the next UTC day -> +1
// - any bigger gap -> resets to 1
export function computeStreak(lastSeenAt: string | null, currentStreak: number, now: Date = new Date()): number {
  if (lastSeenAt === null) return 1

  const todayKey = utcDateKey(now.toISOString())
  const lastKey = utcDateKey(lastSeenAt)
  if (todayKey === lastKey) return currentStreak

  const yesterday = new Date(now)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)

  return lastKey === utcDateKey(yesterday.toISOString()) ? currentStreak + 1 : 1
}

// Time-based mood mechanic (design doc
// docs/superpowers/specs/2026-07-07-emo-personality-retune-design.md §3):
// energy decays toward ENERGY_FLOOR the longer it's been since last_seen_at,
// then every new interaction nudges it back up. Since last_seen_at is
// updated to `now` on every turn (memory-write.ts), consecutive messages in
// one sitting see ~0 elapsed time (no decay) and just climb by the bump
// each turn -- so a long-absent return arrives low and recovers gradually
// over the conversation instead of snapping to full on the first message.
// Also drives the sick/unwell/recovering health arc via prompt guidance
// (design doc §7) -- no separate illness state needed.
export function computeEnergy(lastSeenAt: string | null, priorEnergy: number, now: Date = new Date()): number {
  if (lastSeenAt === null) return 100

  const hoursElapsed = (now.getTime() - new Date(lastSeenAt).getTime()) / 3_600_000
  let decayed: number
  if (hoursElapsed <= ENERGY_FULL_HOURS) {
    decayed = priorEnergy
  } else if (hoursElapsed >= ENERGY_FLOOR_HOURS) {
    decayed = ENERGY_FLOOR
  } else {
    const progress = (hoursElapsed - ENERGY_FULL_HOURS) / (ENERGY_FLOOR_HOURS - ENERGY_FULL_HOURS)
    decayed = priorEnergy - progress * (priorEnergy - ENERGY_FLOOR)
  }

  return Math.min(100, decayed + ENERGY_INTERACTION_BUMP)
}
