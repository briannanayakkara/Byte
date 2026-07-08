// Small local models don't reliably honor an explicit request for a rare
// Situational/Moves mood ("do a flip", "dance for me") even with forceful
// prompt wording -- verified live: "be sleepy"/"act excited" (Everyday
// reactions, reinforced elsewhere in the prompt) honored the request 3/3
// tries, while "dance for me"/"do a flip" (mentioned only once, in a single
// group-listing line) failed 0/3 and 0/5 despite the reply text itself
// correctly narrating the dance/flip. Same "small local models don't
// reliably follow X" class of problem ensureNameMentioned (chat.ts) already
// guarantees deterministically rather than trusting the prompt -- this
// applies the same fix to mood selection for a curated, low-ambiguity set
// of move words. Deliberately excludes common everyday verbs (walk, run,
// jump, sit) that show up constantly in unrelated sentences ("I need to run
// an errand") -- only words distinctive enough that mentioning them almost
// always signals an actual request.
import type { Mood } from './types.js'

const MOVE_REQUEST_PATTERNS: [RegExp, Mood][] = [
  [/\bbackflip\b/i, 'backflip'],
  [/\bflip\b/i, 'flip'],
  [/\bspin(?:s|ning)?\b/i, 'spin'],
  [/\bmoonwalk(?:s|ing)?\b/i, 'moonwalk'],
  [/\bwiggle(?:s|d)?\b/i, 'wiggle'],
  [/\bdanc(?:e|es|ed|ing)\b/i, 'dancing'],
]

export function detectRequestedMood(message: string): Mood | null {
  for (const [pattern, mood] of MOVE_REQUEST_PATTERNS) {
    if (pattern.test(message)) return mood
  }
  return null
}
