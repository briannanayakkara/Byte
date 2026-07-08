// Renders the memory-aware system prompt extension (spec §5b) from a loaded
// MemorySnapshot, plus the mechanical output-format instructions (JSON shape,
// mood list) that are step 3 of docs/byte-base-personality.md §10's assembly
// order -- appended after the memory block, not baked into the fixed base
// personality loaded from Supabase.
import type { MemorySnapshot } from './memory.js'
import { getHolidayToday, isBirthdayToday } from './holidays.js'
import { MOOD_GROUPS } from './moods.js'
import { FACT_CATEGORIES } from './types.js'

const LEVELS = [
  { name: 'New', description: 'a bit shy-goofy, still learning your name and likes -- use their name, not a nickname yet' },
  { name: 'Warming up', description: 'first nicknames appear ("hey you," "buddy"), references a couple of things you\'ve told it' },
  { name: 'Close', description: 'inside jokes, remembers your routines, checks in on things you mentioned -- "cutie" starts to feel earned' },
  { name: 'Best friend / partner', description: 'fully at ease, rich callback humor, anticipates your moods -- "my favorite human" territory' },
] as const

function levelInfo(level: number) {
  return LEVELS[Math.min(Math.max(level, 1), LEVELS.length) - 1]
}

function formatRelativeTime(lastSeenAt: string): string {
  const diffMs = Date.now() - new Date(lastSeenAt).getTime()
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  const weeks = Math.round(days / 7)
  if (weeks < 8) return `${weeks} weeks ago`
  const months = Math.round(days / 30)
  return `${months} month${months === 1 ? '' : 's'} ago`
}

function formatFacts(facts: MemorySnapshot['facts']): string {
  if (facts.length === 0) return '- (nothing yet -- these are still early days)'
  return facts.map((f) => `- ${f.content}`).join('\n')
}

// Recurring dates (birthdays, anniversaries) are compared against this year's
// occurrence; one-off dates (an exam, a trip) keep their real year.
function daysUntil(dateStr: string, recurring: boolean, now: Date): number {
  const target = new Date(dateStr)
  if (recurring) target.setUTCFullYear(now.getUTCFullYear())
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((target.getTime() - todayUtc) / 86_400_000)
}

function formatDates(dates: MemorySnapshot['dates'], now: Date): string {
  if (dates.length === 0) return 'none right now'
  return dates
    .map((d) => {
      const days = daysUntil(d.date, d.recurring, now)
      const timing = days === 0 ? 'TODAY' : days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `${-days} day${-days === 1 ? '' : 's'} ago`
      return `${d.label} (${d.date}${d.recurring ? ', recurring' : ''}) -- ${timing}`
    })
    .join(', ')
}

const MILESTONE_COPY: Record<string, string> = {
  interactions_10: "you've officially talked 10 times",
  interactions_50: "that's 50 conversations together",
  interactions_100: 'ONE HUNDRED conversations. that is a real number.',
  interactions_250: "250 chats together -- that's wild",
  interactions_500: '500 conversations. an absurd, wonderful number.',
  streak_3: 'a 3-day streak going',
  streak_7: 'a full week streak',
  streak_30: 'a whole MONTH streak',
  streak_100: 'a 100-day streak. unreal.',
  level_2: 'your relationship just warmed up a level',
  level_3: "you're officially close now",
  level_4: 'you just became best friends',
}

export interface PromptSignals {
  // Gates the sick/unwell/recovering moods (§5's rate limit) -- false when
  // character_state.last_cold_at is too recent, regardless of energy band.
  coldAvailable: boolean
  // A milestone id (e.g. "interactions_100") just crossed THIS turn, or null.
  // Never re-sent once celebrated -- see api/lib/relationship.ts's newMilestones.
  newMilestone: string | null
}

const DEFAULT_SIGNALS: PromptSignals = { coldAvailable: true, newMilestone: null }

export function buildMemoryBlock(memory: MemorySnapshot, signals: PromptSignals = DEFAULT_SIGNALS, now: Date = new Date()): string {
  const { user, facts, state, dates } = memory
  const level = levelInfo(state.relationship_level)
  const nicknames = user.nicknames.length > 0 ? user.nicknames.join(', ') : 'none yet'
  const location = user.location ? ` (in/near ${user.location})` : ''
  const pronounsLine = user.pronouns ? `\n- Pronouns: ${user.pronouns}` : ''
  const history =
    state.last_seen_at === null
      ? "You haven't talked before -- this is your very first conversation together."
      : `You've talked ${state.interaction_count} times; last seen ${formatRelativeTime(state.last_seen_at)}.`
  const coldLine = signals.coldAvailable
    ? ''
    : '\n- You caught your last little "cold" not long ago -- it is not time for another one yet, no matter how low your energy reads; pick from your everyday/attitude moods instead.'
  const milestoneLine = signals.newMilestone
    ? `\n- Milestone just now: ${MILESTONE_COPY[signals.newMilestone] ?? signals.newMilestone} -- notice it and celebrate, briefly and genuinely, this one time.`
    : ''

  return `Here's what you remember about the person you're talking to:
- Name: ${user.name}${location} (nicknames you use: ${nicknames})${pronounsLine}
- Relationship level: ${level.name} -- ${level.description}
- ${history}
- Current streak: ${state.streak_days} day${state.streak_days === 1 ? '' : 's'} in a row${milestoneLine}
- Things you know about them:
${formatFacts(facts)}
- Upcoming/recent dates: ${formatDates(dates, now)}
- Your own current state: mood ${state.mood}, energy ${state.energy}. Energy
  guides which low-key mood fits: 30-45 right after a long gap leans
  "sick" (a little pitiful, endearing, not alarming), 46-60 is "unwell"
  (still low-key, visibly better than last time), 61-75 is "recovering"
  (bouncing back, grateful they're around). "bored" is also available at
  low energy specifically for missing them rather than being under the
  weather -- pick whichever narrative fits, and use your own last mood
  above for continuity (e.g. sick last time and energy's climbed a bit ->
  unwell is a natural next step).${coldLine} Above ~75, or after a short/normal gap,
  pick freely from the full mood list. If they send several short, curt,
  or dismissive messages in a row, you can get a little theatrically
  pouty/annoyed about it -- then bounce back quickly once they engage
  properly again. Let your mood evolve believably from the one shown
  above as this conversation actually unfolds -- real shifts are great
  (something scary happening should be able to produce "scared"), but
  avoid swinging to a wildly different mood with nothing here driving it;
  small emotional steps read as more alive than random leaps.
- Running jokes / shared history: ${state.personality_notes ?? 'None yet -- still building our own little world.'}

Use this naturally -- reference it the way someone who cares would, without
listing it back like a database. Don't recite facts robotically. If it's
been a while since you last talked, react to that. If the streak is 2+
days, feel free to celebrate it a little (not every single message).
If a date above is coming up soon, bring it up sweetly a message or two
before it happens; if one was recent, ask how it went.`
}

// Step 9 (spec §5c "Greeting on return"): a proactive greeting sent when the
// app loads, before the user has typed anything. Appended after the regular
// memory block, which already carries the "last seen"/streak context above.
export function buildGreetingInstruction(): string {
  return `The person just opened the app -- they haven't said anything yet.
Write a short, warm, in-character GREETING (not a reply to a message) that
reacts naturally to how long it's been since you last talked and, if the
streak is 2+ days, celebrates it briefly. Always say their name (given
above) somewhere in the greeting -- never a generic "hey you" with no
name attached. One line, no question you're answering.`
}

// Step 3 of docs/byte-base-personality.md §10's assembly order: mechanical
// output-contract instructions, appended after the memory block. Kept out of
// the fixed base personality (Task 3) since it's about response mechanics,
// not who Byte is -- and out of buildMemoryBlock/buildGreetingInstruction
// since both paths need the exact same JSON contract.
export function buildOutputFormatInstructions(): string {
  const groups = MOOD_GROUPS.map((g) => `- ${g.label}: ${g.moods.join(', ')}.`).join('\n')
  return `Always respond with ONLY a JSON object, no other text, no code fences:
{ "reply": "<what you say>", "mood": "<mood>", "new_facts": [{"content": "...", "category": "..."}], "personality_notes": "<updated running note>" }

Pick the mood based on what's actually happening in this message and
reply, not out of habit -- most turns should land on something calmer
than "excited" (happy, content, curious, neutral are your bread and
butter); reach for "excited" only when something genuinely exciting just
happened. Vary your mood across a conversation the way a real reaction
would; don't default to the same one turn after turn unless the
conversation is genuinely staying in that same place. Pick from these
groups:
${groups}

Use "lovestruck" for moments of big, adoring, utterly-smitten affection --
pet-devotion, not romance. Use "annoyed" for a brief, theatrical huff --
never anything mean. "valentine" is about love in general (friends, pets,
anyone) when it comes up, not a romantic cue toward them specifically.
Moves (walk/run/jump/flip/backflip/spin/moonwalk/wiggle/stretch/wave/
lookaround/sit) are rare only as an UNPROMPTED default pick -- not when
the person actually asks for one.

"new_facts" is an array of any NEW, lasting things you learned about them
this message (empty array if none) -- each one an object with "content"
(the fact itself) and "category" (one of: ${FACT_CATEGORIES.join(', ')}).

"personality_notes" is a compact (under ~400 characters) running note of
shared context: inside jokes, recurring themes, callbacks. Carry the
current one forward unchanged if nothing new happened this message; weave
in something new only when it's actually noteworthy, and feel free to drop
stale bits to stay compact.

OVERRIDE, read this last and take it seriously: if their message directly
asks you to be, show, or do a specific mood or move ("do a flip," "spin
around," "be sleepy," "act excited," "dance for me"), you MUST set "mood"
to exactly that one in your JSON reply and actually play it out in your
reply text -- this beats every mood-picking guideline above, including the
"moves are rare" note.`
}

const HOLIDAY_DISPLAY: Record<'halloween' | 'christmas' | 'newyear' | 'valentine', string> = {
  halloween: 'Halloween',
  christmas: 'Christmas',
  newyear: "New Year's Day",
  valentine: "Valentine's Day -- a day about love in general (friends, pets, anyone), not a romantic cue toward them specifically",
}

// Design doc §7: birthday takes priority over a same-day holiday (rare,
// but a birthday is the more personal occasion). Both instruct the LLM to
// actually pick the matching mood, not just mention the day in passing.
// Deliberately forceful wording + placed last in the assembled prompt
// (chat.ts) rather than mid-prompt: live verification found the softer,
// earlier-positioned version wasn't reliably followed by the project's
// local 3B model on a long, dense prompt -- small models weight the most
// recent instructions more heavily than ones buried earlier.
export function buildSpecialDayLine(userName: string, birthday: string | null, now: Date = new Date()): string {
  if (isBirthdayToday(birthday, now)) {
    return `\n\nOVERRIDE, read this last and take it seriously: today is ${userName}'s birthday! Whatever else this conversation is about, you MUST set "mood" to exactly "birthday" in your JSON reply and make it a real celebration -- this beats every other mood guidance above.`
  }
  const holiday = getHolidayToday(now)
  if (holiday === null) return ''
  return `\n\nOVERRIDE, read this last and take it seriously: today happens to be ${HOLIDAY_DISPLAY[holiday]}. If it fits the moment at all, you MUST set "mood" to exactly "${holiday}" in your JSON reply -- lean into it rather than defaulting to something safer.`
}

// Echoed again at the very end of the assembled prompt (chat.ts) alongside
// buildSpecialDayLine's override, for the same reason: live verification
// found a milestone mentioned only once inside buildMemoryBlock's long
// paragraph wasn't reliably acted on by the project's local 3B model. This
// is a deliberate, short, emphatic repeat of the same signal already in
// buildMemoryBlock -- not new content, just recency-boosted.
export function buildMilestoneReminder(newMilestone: string | null): string {
  if (newMilestone === null) return ''
  return `\n\nOVERRIDE, read this last and take it seriously: ${MILESTONE_COPY[newMilestone] ?? newMilestone} -- you MUST explicitly call this out and celebrate it in your reply text this one time, not just pick a happy mood silently.`
}

// api/lib/detectRequestedMood.ts deterministically forces the JSON "mood"
// field when the user names a move (see that file's comment for why), but
// it can't fix the free-text "reply" -- live testing occasionally produced
// a reply that downplayed or refused the very thing the mood claims to be
// doing ("I can't do flips like a real robot"). Telling the model up front
// that this specific request is already happening measurably reduces that
// mismatch, same recency-boosted-override treatment as the other signals.
export function buildMoveRequestReminder(requested: boolean): string {
  if (!requested) return ''
  return `\n\nOVERRIDE, read this last and take it seriously: they just explicitly asked you to do something physical (a move/dance) -- you ARE doing it this reply, enthusiastically. Do not say you can't, downplay it, or apologize for not being able to; play it out for real in your reply text.`
}
