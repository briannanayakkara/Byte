# "Go Play" Button + Play Mode Design

> Goal: a button that sends Byte off to entertain himself — cycling through
> the toy routines and a few flourish moves, sharing an LLM-generated fun
> fact each time he switches — until the user sends a real chat message,
> at which point he stops and talks to them normally.

## 1. Why this exists

The v5 character upgrade added an *autonomous* bored → Play-routine chain,
but in practice it almost never fires: the idle-move timer in `App.tsx`
never sets the `bored` mood, so the 9-second bored-escalation timer rarely
gets a chance to run at all. Rather than tune idle-mood probabilities to
make an indirect, chance-based trigger slightly more likely, this is a
direct, deterministic, user-initiated alternative: click a button, he goes
to play, on a fixed reliable cadence, until you talk to him.

## 2. Play loop

**New hook: `src/hooks/usePlayMode.ts`.** Owns the entire loop; no new state
needed elsewhere except a boolean `isPlaying` that `App.tsx` uses to
suspend its own idle timers.

```ts
const PLAY_ACTIVITIES: { mood: Mood; durationMs: number }[] = [
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
```

Each duration matches (or is a clean multiple of) that mood's actual
animation cycle length in `Character.tsx`, so a switch always lands on a
natural loop boundary — never a mid-routine cut.

On start:
1. Pick a random `PLAY_ACTIVITIES` entry, `window.Byte.set(mood)`.
2. Fetch a fun fact (see §3) and show it via the existing `SpeechBubble`.
3. After `durationMs`, repeat from step 1 — a different random entry each
   time (simple "don't repeat the immediately-previous one" check, so it
   doesn't feel stuck if the RNG picks the same activity twice in a row).
4. Stop entirely the moment `handleSend` fires a real message (checked via
   a ref the hook exposes, flipped by `App.tsx`) — the in-flight fact
   fetch/timer is cancelled, and the very next mood-setting call (the chat
   reply) naturally takes over the visible mood, exactly like every other
   external `Byte.set()` call already does today.

**Suspending existing idle behavior while playing:** `App.tsx`'s idle-move
timer and idle-thought/fact timer both gain an `isPlaying` check (a ref,
same pattern as the existing `isSendingRef`) so they don't fire mood
changes or show their own bubble content over the play loop's.

## 3. LLM-generated fun facts (new backend piece)

A new `fact` request mode on `/api/chat`, structurally identical to the
existing `greeting` mode:

- `POST /api/chat` with `{ fact: true }` (alongside the existing
  `{ greeting: true }` and `{ message: string }` shapes).
- Loads memory + the active `personality_base` distilled prompt exactly as
  every other request does (so facts can naturally reference things Byte
  knows about the user, same personality voice).
- New prompt instruction (`buildFactInstruction()` in `api/lib/prompt.ts`):
  "Say a short, random, in-character fun fact, observation, or aside — not
  a reply to anything, they haven't said anything. One line."
- Returns `{ reply }` only — no `mood` is applied by the caller (the
  play loop's own activity mood already drives what's visually happening;
  applying whatever mood the fact-response happens to carry would fight
  with that).
- **Not persisted anywhere** — no `saveTurn`/`saveGreeting` call, no
  `messages`/`facts` writes, no mood/energy update. Pure ephemeral flavor
  text, deliberately kept out of conversation history so it can't leak into
  a later real reply's context and doesn't inflate `interaction_count`.

`src/lib/chatApi.ts` gains `fetchPlayFact(): Promise<{ reply: string }>`,
following the exact shape of the existing `fetchGreeting()`.

## 4. UI

A new button (e.g. in `src/App.tsx`, near `ChatInput`), plain and simple:
"Go play". While play mode is active, the button is disabled (matches your
choice that chat is the only way to stop — no toggle-back click). Clicking
it starts `usePlayMode`'s loop immediately with the first activity.

## 5. Testing

- **Unit test**: `PLAY_ACTIVITIES` duration/mood pairing is static data, not
  worth testing in isolation. The "don't repeat the previous activity"
  picker is a small pure function worth a quick unit test.
- **Manual verification**: click "Go play", confirm he cycles through
  toy routines and flourishes with fun facts appearing each switch, confirm
  idle-move/idle-thought timers stay silent while playing, confirm typing
  and sending a message immediately stops play mode and gets a normal
  reply. Confirm the fact bubble content is LLM-generated (varies, in
  character) not the static `IDLE_FACTS` list.

## 6. Explicitly out of scope

- No toggle-to-stop button state (chat-only stop, per your explicit choice).
- No persistence of play-mode facts/moods to Supabase.
- Not reusing the static `IDLE_FACTS` array for this feature (superseded by
  the LLM-generated facts, per your correction) — that array keeps being
  used for the existing, separate idle-thought behavior when not playing.
