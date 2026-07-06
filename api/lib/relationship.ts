// Pure functions for character_state derived fields (spec §5b "Relationship
// levels" and "streak tracking" §9 step 9), kept independently testable per
// query-patterns.md.

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
