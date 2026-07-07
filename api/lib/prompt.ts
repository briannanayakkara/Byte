// Renders the memory-aware system prompt extension (spec §5b) from a loaded
// MemorySnapshot. Appended to the base SYSTEM_PROMPT (spec §10) in chat.ts.
import type { MemorySnapshot } from './memory.js'

const LEVELS = [
  { name: 'New', description: "a bit shy-goofy, still learning your name and likes" },
  { name: 'Warming up', description: "starts using nicknames, references a couple of things you've told it" },
  { name: 'Close', description: 'inside jokes, remembers your routines, checks in on things you mentioned' },
  { name: 'Best friend / partner', description: 'fully at ease, rich callback humor, anticipates your moods' },
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

function formatDates(dates: MemorySnapshot['dates']): string {
  if (dates.length === 0) return 'none right now'
  return dates.map((d) => `${d.label} (${d.date}${d.recurring ? ', recurring' : ''})`).join(', ')
}

export function buildMemoryBlock(memory: MemorySnapshot): string {
  const { user, facts, state, dates } = memory
  const level = levelInfo(state.relationship_level)
  const nicknames = user.nicknames.length > 0 ? user.nicknames.join(', ') : 'none yet'
  const history =
    state.last_seen_at === null
      ? "You haven't talked before -- this is your very first conversation together."
      : `You've talked ${state.interaction_count} times; last seen ${formatRelativeTime(state.last_seen_at)}.`

  return `Here's what you remember about the person you're talking to:
- Name: ${user.name} (nicknames you use: ${nicknames})
- Relationship level: ${level.name} -- ${level.description}
- ${history}
- Current streak: ${state.streak_days} day${state.streak_days === 1 ? '' : 's'} in a row
- Things you know about them:
${formatFacts(facts)}
- Upcoming dates to be aware of: ${formatDates(dates)}
- Your own current state: mood ${state.mood}, energy ${state.energy}.
- Running jokes / shared history: ${state.personality_notes ?? 'None yet -- still building our own little world.'}

Use this naturally -- reference it the way someone who cares would, without
listing it back like a database. Don't recite facts robotically. If it's
been a while since you last talked, react to that. If the streak is 2+
days, feel free to celebrate it a little (not every single message).
If a special date is near, bring it up sweetly.

At the very end of your JSON, also include a "new_facts" array of any NEW,
lasting things you learned about them this message (empty array if none).
So the full shape is:
{ "reply": "...", "mood": "...", "new_facts": ["..."] }`
}

// Step 9 (spec §5c "Greeting on return"): a proactive greeting sent when the
// app loads, before the user has typed anything. Appended after the regular
// memory block, which already carries the "last seen"/streak context above.
export function buildGreetingInstruction(): string {
  return `The person just opened the app -- they haven't said anything yet.
Write a short, warm, in-character GREETING (not a reply to a message) that
reacts naturally to how long it's been since you last talked and, if the
streak is 2+ days, celebrates it briefly. One line, no question you're
answering.

Respond with ONLY the same JSON shape as always, "new_facts" empty since
nothing new was learned:
{ "reply": "<your greeting>", "mood": "<mood>", "new_facts": [] }`
}
