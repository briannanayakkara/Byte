# "Go Play" Button + Play Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Go play" button that sends Byte into a self-directed play loop (cycling toy routines and flourish moves, sharing an LLM-generated fun fact each switch) until the user sends a real chat message.

**Architecture:** A new `fact` request mode on `/api/chat` (structurally identical to the existing `greeting` mode — memory-aware, personality-voiced, but never persisted) backs a new `usePlayMode` React hook that owns the entire client-side loop (pick activity → `window.Byte.set()` → fetch a fact → wait → repeat). `App.tsx` wires in a button, suspends its two existing idle timers while playing, and stops the loop the instant a real message is sent.

**Tech Stack:** TypeScript, React 19 hooks, Vitest (both `api/` and, for the first time, `src/` — see Task 2's `vitest.config.ts` change).

## Global Constraints

- **`fact` mode is never persisted.** No `saveTurn`/`saveGreeting` call, no `messages`/`facts` write, no mood/energy update, and the mood the LLM happens to return for this request is never sent back to the client — the play loop's own activity mood is what's actually displayed, and applying an unrelated LLM-picked mood on top would fight with it.
- **Play mode ends the instant a real message is sent** — `handleSend` calls the hook's `stop()` as its very first action, before anything else, so there's no window where a stale play-loop timer could fire a mood change after the user has re-engaged.
- **No toggle-to-stop UI.** The button is disabled while playing (per explicit product decision) — chat is the only way to end play mode.
- **Existing idle behavior (idle-thought/fact timer, idle-move timer) must stay completely silent while playing** — both gain the same kind of ref-based guard this file already uses for `isSendingRef`.

---

### Task 1: Backend `fact` request mode

**Files:**
- Modify: `api/lib/prompt.ts`
- Modify: `api/lib/prompt.test.ts`
- Modify: `api/chat.ts`
- Modify: `src/lib/chatApi.ts`

**Interfaces:**
- Produces: `buildFactInstruction(): string`; `POST /api/chat` accepts `{ fact: true }` and responds `{ reply: string }` (no `mood`); `fetchPlayFact(): Promise<{ reply: string }>`.

- [ ] **Step 1: Add `buildFactInstruction` to `api/lib/prompt.ts`**

Immediately after `buildGreetingInstruction`'s closing `}`, before the `// Step 3 of docs/byte-base-personality.md §10's assembly order...` comment:

```ts
// docs/superpowers/specs/2026-07-08-go-play-mode-design.md §3: a
// spontaneous aside while Byte is off playing on his own (the "go play"
// button's loop), not a reply to anything the person said -- memory-aware
// (same personality/context as every other request) but deliberately not
// persisted by the caller.
export function buildFactInstruction(): string {
  return `The person isn't talking to you right now -- you're off playing on
your own and just feel like sharing something. Say ONE short, random,
in-character fun fact, observation, or aside -- not a reply to anything,
not a question, just a little spontaneous thought out loud. One line,
playful, matches your voice.`
}
```

- [ ] **Step 2: Add a test in `api/lib/prompt.test.ts`**

Add `buildFactInstruction` to the existing import from `./prompt.js`, then add:

```ts
describe('buildFactInstruction', () => {
  it('asks for a single spontaneous fact, not a reply', () => {
    const text = buildFactInstruction()
    expect(text).toContain('fun fact')
    expect(text).toContain('not a reply')
  })
})
```

- [ ] **Step 3: Wire the `fact` mode into `api/chat.ts`**

Add `buildFactInstruction` to the existing import from `./lib/prompt.js`.

Replace the body-parsing block:

```ts
  const body = (req.body ?? {}) as { message?: unknown; greeting?: unknown; fact?: unknown }
  const isGreeting = body.greeting === true
  const isFact = body.fact === true
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  if (!isGreeting && !isFact && !message) {
    res.status(400).json({ error: 'message is required' })
    return
  }
```

Change only the ternary's condition — from `isGreeting` to `isGreeting || isFact` — leaving the rest of the statement (the `newMilestones(...)` call and its arguments) exactly as it already is:

```ts
    const crossedMilestones = isGreeting || isFact
      ? []
      : newMilestones(
```

Change the `requestedMood` line:

```ts
    const requestedMood = isGreeting || isFact ? null : detectRequestedMood(message)
```

Replace the `systemPrompt` assignment with a three-way branch:

```ts
    // Assembly order per docs/byte-base-personality.md §10: fixed soul, then
    // the evolving memory block, then mechanical output-format instructions.
    const systemPrompt = isGreeting
      ? `${basePersonality}\n\n${buildMemoryBlock(promptMemory, signals)}\n\n${buildGreetingInstruction()}\n\n${buildOutputFormatInstructions()}${specialDayLine}${buildMilestoneReminder(signals.newMilestone)}`
      : isFact
        ? `${basePersonality}\n\n${buildMemoryBlock(promptMemory, signals)}\n\n${buildFactInstruction()}\n\n${buildOutputFormatInstructions()}`
        : `${basePersonality}\n\n${buildMemoryBlock(promptMemory, signals)}\n\n${buildOutputFormatInstructions()}${specialDayLine}${buildMilestoneReminder(signals.newMilestone)}${buildMoveRequestReminder(requestedMood !== null)}`
```

(Fact mode deliberately omits `specialDayLine`/`buildMilestoneReminder`/`buildMoveRequestReminder` — none of those make sense for a spontaneous, un-prompted aside.)

Replace the `messages` array assignment:

```ts
    const messages: ChatMessage[] = isGreeting
      ? [{ role: 'user', content: '(the app just opened -- say hello, no user message yet)' }]
      : isFact
        ? [{ role: 'user', content: '(Byte is off playing on his own -- share a short, random fun fact or observation, not a reply to anything)' }]
        : [...toChatHistory(memory.messages), { role: 'user', content: message }]
```

Replace the write-back block and final response:

```ts
    if (isGreeting) {
      try {
        await saveGreeting(userId, mood, promptMemory.state.energy)
      } catch (writeError) {
        console.error('greeting memory write failed', writeError)
      }
    } else if (!isFact) {
      try {
        await saveTurn(userId, memory.state, { userMessage: message, reply, mood, newFacts, personalityNotes })
      } catch (writeError) {
        // Best-effort (spec §9 step 8 / api-docs endpoints.md): a write
        // failure must not turn a successful reply into a 500 for the user.
        console.error('memory write failed', writeError)
      }
    }
    // isFact: deliberately not persisted -- ephemeral flavor text while
    // playing, see docs/superpowers/specs/2026-07-08-go-play-mode-design.md
    // §3. No messages/facts/mood/energy write, and the mood is never
    // returned to the caller (the play loop's own activity mood is what's
    // actually visible; applying whatever mood this aside happens to carry
    // would fight with that).

    res.status(200).json(isFact ? { reply } : { reply, mood })
```

- [ ] **Step 4: Add `fetchPlayFact` to `src/lib/chatApi.ts`**

```ts
// docs/superpowers/specs/2026-07-08-go-play-mode-design.md §3: fetched
// repeatedly while the "go play" loop is running. Deliberately typed
// without `mood` -- the server never returns one for this request shape
// (the play loop's own activity mood is what's actually displayed).
export async function fetchPlayFact(): Promise<{ reply: string }> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fact: true }),
  })

  if (!response.ok) {
    throw new Error(`/api/chat responded ${response.status}`)
  }

  return response.json()
}
```

- [ ] **Step 5: Verify**

Run: `npm test` — expect PASS.
Run: `npm run build` — expect PASS.
Run: `npm run lint` — expect PASS.

- [ ] **Step 6: Manual live verification against the test user**

Test user: `aa3c4a98-c141-49f5-b975-1ff2b6a485ca` (`Amelie-uat`) — never the real user. With `npm run dev` and Ollama running:

```bash
curl -s -X POST "http://localhost:5173/api/chat?user=aa3c4a98-c141-49f5-b975-1ff2b6a485ca" \
  -H "Content-Type: application/json" -d '{"fact":true}'
```

Confirm the response is `{"reply": "..."}` with **no `mood` key**. Run it 2-3 times and confirm the reply text varies and reads like an in-character aside, not a reply to a message. Then confirm nothing was persisted: query `select interaction_count, milestones from character_state where user_id = 'aa3c4a98-c141-49f5-b975-1ff2b6a485ca';` before and after — `interaction_count` must be unchanged, and `select count(*) from messages where user_id = 'aa3c4a98-c141-49f5-b975-1ff2b6a485ca';` must also be unchanged.

- [ ] **Step 7: Commit**

```bash
git add api/lib/prompt.ts api/lib/prompt.test.ts api/chat.ts src/lib/chatApi.ts
git commit -m "feat: add a fact request mode to /api/chat for the go-play loop"
```

---

### Task 2: `usePlayMode` hook

**Files:**
- Create: `src/hooks/usePlayMode.ts`
- Create: `src/hooks/usePlayMode.test.ts`
- Modify: `vitest.config.ts`

**Interfaces:**
- Produces: `pickNextActivity(previous: Mood | null, random?: () => number): { mood: Mood; durationMs: number }`; `usePlayMode(): { isPlaying: boolean; fact: string | null; start: () => void; stop: () => void }`.
- Consumes: `fetchPlayFact` (Task 1), `window.Byte.set` (existing global).

- [ ] **Step 1: Extend `vitest.config.ts` to cover `src/`**

This project has never had a frontend unit test before — `pickNextActivity` is the first pure, browser-independent logic under `src/` worth testing in isolation. Change:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['api/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
```

- [ ] **Step 2: Write `src/hooks/usePlayMode.ts`**

```ts
import { useCallback, useRef, useState } from 'react'
import { fetchPlayFact } from '../lib/chatApi'
import type { Mood } from '../types'

interface PlayActivity {
  mood: Mood
  durationMs: number
}

// docs/superpowers/specs/2026-07-08-go-play-mode-design.md §2. Each
// duration matches (or is a clean multiple of) that mood's actual
// animation cycle length in Character.tsx, so a switch always lands on a
// natural loop boundary -- never a mid-routine cut.
const PLAY_ACTIVITIES: PlayActivity[] = [
  { mood: 'skate', durationMs: 13_000 },
  { mood: 'playball', durationMs: 10_000 },
  { mood: 'jam', durationMs: 9_000 },
  { mood: 'flip', durationMs: 2_500 },
  { mood: 'backflip', durationMs: 2_500 },
  { mood: 'spin', durationMs: 2_000 },
  { mood: 'jump', durationMs: 1_600 },
  { mood: 'wiggle', durationMs: 3_000 },
  { mood: 'moonwalk', durationMs: 6_000 },
]

// Avoids repeating the immediately-previous activity so back-to-back
// switches always feel like a new thing, not a stutter. Accepts an
// injectable random source purely for deterministic unit testing.
export function pickNextActivity(previous: Mood | null, random: () => number = Math.random): PlayActivity {
  const candidates = previous ? PLAY_ACTIVITIES.filter((a) => a.mood !== previous) : PLAY_ACTIVITIES
  return candidates[Math.floor(random() * candidates.length)]
}

interface UsePlayModeResult {
  isPlaying: boolean
  fact: string | null
  start: () => void
  stop: () => void
}

export function usePlayMode(): UsePlayModeResult {
  const [isPlaying, setIsPlaying] = useState(false)
  const [fact, setFact] = useState<string | null>(null)
  const activeRef = useRef(false)
  const previousMoodRef = useRef<Mood | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const stop = useCallback(() => {
    activeRef.current = false
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsPlaying(false)
    setFact(null)
  }, [])

  const start = useCallback(() => {
    if (activeRef.current) return
    activeRef.current = true
    previousMoodRef.current = null
    setIsPlaying(true)

    function playNext() {
      if (!activeRef.current) return
      const activity = pickNextActivity(previousMoodRef.current)
      previousMoodRef.current = activity.mood
      window.Byte?.set(activity.mood)
      fetchPlayFact()
        .then(({ reply }) => {
          if (activeRef.current) setFact(reply)
        })
        .catch(() => {
          // Non-critical: no fact this round, keep playing regardless.
        })
      timeoutRef.current = setTimeout(playNext, activity.durationMs)
    }
    playNext()
  }, [])

  return { isPlaying, fact, start, stop }
}
```

- [ ] **Step 3: Write `src/hooks/usePlayMode.test.ts`**

Only `pickNextActivity` is tested directly (pure, no DOM/timers needed) — matching this project's existing pattern of testing pure logic and verifying hook/DOM wiring manually.

```ts
import { describe, expect, it } from 'vitest'
import { pickNextActivity } from './usePlayMode.js'

describe('pickNextActivity', () => {
  it('returns a valid activity when there is no previous one', () => {
    const activity = pickNextActivity(null, () => 0)
    expect(activity.mood).toBeTruthy()
    expect(activity.durationMs).toBeGreaterThan(0)
  })

  it('never repeats the immediately-previous activity', () => {
    for (let i = 0; i < 20; i++) {
      const random = () => i / 20
      const activity = pickNextActivity('skate', random)
      expect(activity.mood).not.toBe('skate')
    }
  })

  it('picks the first candidate when random() returns 0', () => {
    const activity = pickNextActivity(null, () => 0)
    expect(activity.mood).toBe('skate')
  })

  it('picks the last candidate when random() returns just under 1', () => {
    const activity = pickNextActivity(null, () => 0.9999)
    expect(activity.mood).toBe('moonwalk')
  })
})
```

- [ ] **Step 4: Verify**

Run: `npm test` — expect PASS (this is the first test file under `src/`, confirming Step 1's config change actually picks it up).
Run: `npm run build` — expect PASS.
Run: `npm run lint` — expect PASS.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts src/hooks/usePlayMode.ts src/hooks/usePlayMode.test.ts
git commit -m "feat: add usePlayMode hook (activity cycling + fact fetching, not yet wired into the UI)"
```

---

### Task 3: Wire into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `usePlayMode` (Task 2).

- [ ] **Step 1: Import the hook**

Add to the existing imports:

```ts
import { usePlayMode } from './hooks/usePlayMode'
```

- [ ] **Step 2: Instantiate the hook and a ref-mirrored "is playing" flag**

Immediately after the existing `const hasBubbleRef = useRef(false)` line:

```ts
  const playMode = usePlayMode()
  const isPlayingRef = useRef(false)

  useEffect(() => {
    isPlayingRef.current = playMode.isPlaying
  }, [playMode.isPlaying])
```

(Mirrors the existing `isSendingRef` pattern immediately above it — the idle-timer effects below need a synchronous, always-current read of "is playing" without depending on their own re-render.)

- [ ] **Step 3: Suspend the idle-thought/fact timer while playing**

In the idle-thought `useEffect`, change the guard condition from:

```ts
        if (!isSendingRef.current && !hasBubbleRef.current) {
```

to:

```ts
        if (!isSendingRef.current && !hasBubbleRef.current && !isPlayingRef.current) {
```

- [ ] **Step 4: Suspend the idle-move timer while playing**

In the idle-move `useEffect`, change the guard condition from:

```ts
        if (!isSendingRef.current) {
```

to:

```ts
        if (!isSendingRef.current && !isPlayingRef.current) {
```

- [ ] **Step 5: Stop play mode the instant a real message is sent**

At the very start of `handleSend`, before any other statement:

```ts
  async function handleSend(text: string) {
    playMode.stop()
    setThought(null)
    setFact(null)
```

- [ ] **Step 6: Show the play-mode fact in the bubble**

Replace the bubble-selection ternary:

```tsx
          {thought ? (
            <ThoughtBubble emojis={thought} />
          ) : fact ? (
            <SpeechBubble text={fact} />
          ) : playMode.fact ? (
            <SpeechBubble text={playMode.fact} />
          ) : (
            bubbleText && <SpeechBubble text={bubbleText} />
          )}
```

- [ ] **Step 7: Add the "Go play" button**

Replace the bottom container:

```tsx
      <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-3 px-4">
        <button
          type="button"
          onClick={playMode.start}
          disabled={isSending || playMode.isPlaying}
          className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          {playMode.isPlaying ? 'playing...' : 'Go play'}
        </button>
        <ChatInput onSend={handleSend} disabled={isSending} />
      </div>
```

- [ ] **Step 8: Verify**

Run: `npm test` — expect PASS.
Run: `npm run build` — expect PASS.
Run: `npm run lint` — expect PASS.

- [ ] **Step 9: Manual smoke check**

Start `npm run dev` and Ollama. Click "Go play" — confirm Byte immediately starts an activity (toy routine or a flourish move), a fun-fact speech bubble appears shortly after (LLM-generated — try it a few times and confirm the wording varies, unlike the static `IDLE_FACTS` list), and after that activity's duration he switches to a different one (never the same one twice in a row) with a fresh fact each time. Confirm the button is disabled and reads "playing..." while active. Confirm the idle-thought and idle-move timers stay completely silent during this (no random emoji-cloud or idle-move override interrupting the loop). Type and send a real message — confirm play mode stops immediately (button re-enables, next reply's mood takes over normally).

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add the Go play button, wire usePlayMode into App.tsx"
```

---

## Self-review notes

- **Spec coverage:** every piece from `docs/superpowers/specs/2026-07-08-go-play-mode-design.md` has a corresponding task — the backend `fact` mode (§3, Task 1), the play loop and activity pool (§2, Task 2), the UI button and idle-timer suspension (§4 and part of §2, Task 3).
- **Placeholder scan:** no TBD/TODO; every step has complete, directly-usable code.
- **Type consistency:** `PlayActivity`/`pickNextActivity`'s signature is defined once (Task 2) and not touched again. `UsePlayModeResult`'s shape (`isPlaying`, `fact`, `start`, `stop`) is exactly what Task 3 consumes, with matching names throughout.
- **Ambiguity check:** the "which activities are in the pool and how long each plays" is fully specified in Task 2's `PLAY_ACTIVITIES` array — no vague "pick something fun" left for the implementer to guess.
