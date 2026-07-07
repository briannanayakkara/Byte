import type { Mood } from './types.js'

type HolidayMood = Extract<Mood, 'halloween' | 'christmas' | 'newyear' | 'valentine'>

// Small real-world-holiday awareness (design doc
// docs/superpowers/specs/2026-07-07-emo-personality-retune-design.md §4,
// §7) -- a fixed MM-DD lookup, separate from the user-curated
// `important_dates` table. Deliberately excludes floating-date holidays
// like Thanksgiving (needs calendar math; keeps this a plain lookup). UTC,
// not local time -- consistent with computeStreak's UTC handling in
// relationship.ts, since the server has no per-user timezone concept.
// Returns the exact Mood value to pick, not a display string -- callers
// that need a human-readable label map it themselves (see
// prompt.ts's HOLIDAY_DISPLAY).
const HOLIDAYS: Record<string, HolidayMood> = {
  '10-31': 'halloween',
  '12-25': 'christmas',
  '01-01': 'newyear',
  '02-14': 'valentine',
}

function monthDayKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${month}-${day}`
}

export function getHolidayToday(now: Date = new Date()): HolidayMood | null {
  return HOLIDAYS[monthDayKey(now)] ?? null
}

// design doc §7: birthday check against the existing `users.birthday`
// column (spec §5b) -- same MM-DD matching as getHolidayToday, kept
// separate since a birthday is per-user, not a fixed calendar date.
export function isBirthdayToday(birthday: string | null, now: Date = new Date()): boolean {
  if (birthday === null) return false
  return monthDayKey(new Date(birthday)) === monthDayKey(now)
}
