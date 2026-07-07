# Byte v3: character rig upgrade + persistent cross-device continuity

Not part of the numbered build order in `docs/specs/Byte-app-spec.md` §9 -- an
ad hoc iteration, continuing on the `emo-personality-retune` branch/PR
(unmerged at time of writing) rather than a new branch, since this is the
same character subsystem the open PR already touches.

Two combined efforts, brainstormed together because the second one directly
shapes how the first one's greeting-time behavior works:

1. **Character v3 rig upgrade** -- replace `Character.tsx`'s engine with the
   user's hand-built `reference/character-prototypes/byte_robot_v3.html`
   (floaty detached hands, procedural leg IK, a dozen new full-body "Moves"),
   exposing a real global `window.Byte` API instead of a React prop.
2. **Persistent cross-device continuity** -- Byte is a single-user pet; his
   mood/energy/relationship must feel like one continuous creature across
   every device, never a fresh instance. Today's greeting flow is explicitly
   read-only (generates a mood, throws it away), so two devices never
   actually see the same continuous state -- this closes that gap.

Golden rule driving every decision below (the user's framing): **continuity
and stability over novelty.** Byte should never feel like he reset or forgot
who he was.

## 1. Character v3 rig (`src/components/Character.tsx`, `src/components/MoodBubble.tsx`, `src/App.tsx`)

### 1a. Architecture: real `window.Byte`, not a prop

Confirmed with the user: drop the `mood` prop entirely. `Character.tsx`
becomes a mount-once, no-props component. Its single setup effect:

- Builds the SVG shell (now with `rootG` wrapping `shadow` + `bobG`, for
  horizontal roam/mirror during walk/run/moonwalk; procedural `legL`/`legR`
  paths redrawn every frame via the prototype's `setLeg()` quadratic-curve
  IK; floaty `handL`/`handR` groups offset every frame).
- Ports the prototype's helper functions (`el`, `clear`, `eye`, `arc`,
  `heartAt`, `star`, `txt`, `kf`, `setLeg`, `dust`) and the `M` dictionary
  verbatim -- the 34 existing mood functions are functionally unchanged from
  the current `Character.tsx` (same code); only the per-frame pose/animation
  system (`renderFrame`) and the 12 new move functions are new.
- Starts the `requestAnimationFrame` loop.
- Assigns `window.Byte = { set(name), list() }`. `set(name)`:
  - Runs the existing `setMood`-equivalent reset + pose logic.
  - Dispatches `window.dispatchEvent(new CustomEvent('byte:change', { detail: name }))`.
- Cleanup (`useEffect` return) cancels the rAF loop and deletes `window.Byte`.
- Default internal pose before anything calls `set()`: a genuinely neutral
  resting pose (not the prototype's own demo default of `'walk'`) -- see
  §1c on why this matters for "never invent a mood."

Ambient typing: new `src/byte-global.d.ts` declaring
`interface Window { Byte?: { set(name: Mood): void; list(): Mood[] } }`.

### 1b. `MoodBubble.tsx`: event subscription, not a prop

Drops its `mood` prop. On mount, `window.addEventListener('byte:change', handler)`
where `handler` reads `event.detail` and re-triggers the existing show/fade
timer logic unchanged. Cleanup removes the listener. `MOOD_LABELS` grows
from 34 to 46 entries (adds the 12 new Move names -- see §2a). Since
`Character` and `MoodBubble` are both children of `App`, React's
children-before-parent effect commit order guarantees both are mounted (and
`MoodBubble`'s listener attached) before `App`'s own mount effect fires the
wave -- no race to guard against explicitly.

### 1c. `App.tsx`: drop `mood` state, wave-first on load

The `mood` React state is deleted entirely -- nothing outside
`Character`/`MoodBubble` needs it anymore (Character and MoodBubble both
read it via `window.Byte`/the event, not props). Every existing
`setMood(x)` call site becomes `window.Byte?.set(x)`:

- The error fallback in `handleSend`'s catch block: `window.Byte?.set('confused')`.
- The chat-reply success path: `window.Byte?.set(replyMood)`.
- The greeting-fetch success path: `window.Byte?.set(greetingMood)` (after
  the API call resolves -- see below).

New: a mount-once effect calls `window.Byte?.set('wave')` immediately,
before `fetchGreeting()` is even called. This is the "never invent a mood"
answer -- `wave` is a greeting *gesture*, not an emotional claim about
Byte's state (the same way a real pet perks up at the door before you know
anything about its day). It covers the network round-trip with something
alive and intentional instead of a static/neutral placeholder, without
asserting a mood that might contradict his real persisted state once it
loads.

## 2. Mood/Move taxonomy and prompt updates

### 2a. Type/list expansion

- `Mood` (`api/lib/types.ts`, `src/types.ts`): 34 -> 46 members, adding
  `walk, run, jump, flip, backflip, spin, moonwalk, wiggle, stretch, wave,
  lookaround, sit`.
- `VALID_MOODS` (`api/chat.ts`): 32 -> 44 (adds all 12 moves; still excludes
  `listening`/`talking` -- no voice feature exists yet, same precedent as
  before).
- `MOOD_LABELS` (`MoodBubble.tsx`): 34 -> 46 (needs entries for all of
  `Mood`, including `listening`/`talking`, same as before -- unreachable
  today but the map must stay total since it's typed `Record<Mood, string>`).
- Dev-harness-equivalent: none exists anymore (removed in the prior plan's
  Task 10) -- moves are verified the same way the 34 moods were, by reading
  live replies/greetings once this ships, not a debug button row.

### 2b. `SYSTEM_PROMPT` additions (`api/chat.ts`)

New "Moves" group in the grouped mood-selection guidance:
`walk, run, jump, flip, backflip, spin, moonwalk, wiggle, stretch, wave,
lookaround, sit` -- with explicit framing that these are **rare
flourishes**, not a default pick most turns: wave fits hello/goodbye
moments, flip/spin/jump fit big excitement, sit/stretch fit a calm/lazy
beat, walk/run/moonwalk/wiggle/lookaround are playful rarities. Accepted
risk (confirmed with the user): since these are LLM-selectable like any
other mood, the model could occasionally pick one with no strong narrative
grounding (e.g. "walk" mid-chat) -- mitigated by the "rare flourish"
framing, not eliminated by it. No deterministic gate exists to stop this;
it's the same soft, LLM-judged approach used for `annoyed`/`bored` already.

### 2c. Gentle mood evolution (new prompt guidance)

Extends `buildMemoryBlock`'s existing "Your own current state: mood X,
energy Y" line (`api/lib/prompt.ts`) with an explicit continuity
instruction: evolve believably from the mood shown above as the
conversation actually unfolds -- real shifts are great (something scary
happening should be able to produce `scared`), but avoid an unmotivated
swing to a wildly different mood with nothing in the conversation driving
it. This is prompt guidance only, matching how `annoyed`/`bored`/the health
arc already work -- there is no hardcoded mood-transition graph. Flagged as
a deliberate choice: a hard transition state machine would be more
guaranteed-gentle but would also constrain legitimate strong reactions and
is disproportionate engineering for a single-user hobby app; the design
leans on the model's own judgment plus the "here's your last mood" context
it already receives.

### 2d. Personality stability anchor (new `SYSTEM_PROMPT` line)

One new sentence in the identity section, reinforcing something already
architecturally true (the base `SYSTEM_PROMPT` is a fixed constant; only
the memory-block layer changes per request) but worth stating explicitly to
the model as a guardrail against long-context drift: *"Your core
personality is fixed and never changes -- what deepens over time is only
how well you know this person and how close you are, layered on top, never
replacing who you are."*

## 3. Greeting persistence: closing the read-only gap (`api/chat.ts`, `api/lib/memory-write.ts`)

**Today:** `loadMemory` reads `character_state` fresh on every request
(already the single source of truth for real turns). But the greeting path
generates a mood via the LLM and explicitly never saves it --
`memory-write.ts`'s header comment says so outright. So two devices each
get an independently-improvised greeting mood with no shared continuity.

**Fix:** a new, narrowly-scoped `saveGreeting` function, separate from
`saveTurn`:

```ts
export async function saveGreeting(userId: string, mood: Mood, energy: number): Promise<void>
```

- Upserts **only** `user_id`, `mood`, `energy` into `character_state`.
- Deliberately does **not** touch `interaction_count`, `relationship_level`,
  `streak_days`, or `last_seen_at` -- confirmed requirement: opening the app
  must never advance the relationship, only carry mood/energy forward.
  Opening the app is Byte noticing you're there, not a conversation.
- For a brand-new user with no `character_state` row yet, the upsert's
  INSERT path relies on the table's existing column defaults
  (`relationship_level default 1`, `interaction_count default 0`,
  `streak_days default 0`) for everything this function doesn't set --
  correct for a first-ever greeting with no history yet. For a returning
  user, the upsert's UPDATE path (`on conflict (user_id) do update`) only
  touches the two columns given, leaving relationship fields completely
  alone -- Supabase's JS `.upsert()` with an explicit column list already
  produces exactly this behavior, no custom SQL needed for this part.

**Wiring in `api/chat.ts`:** the energy value used for the greeting prompt
is already computed once (`promptMemory.state.energy`, from the prior
plan's final-review fix -- decayed via `computeEnergy` before building the
prompt). Reuse that exact value for the save, no second computation:

```ts
if (isGreeting) {
  try {
    await saveGreeting(userId, mood, promptMemory.state.energy)
  } catch (writeError) {
    console.error('greeting memory write failed', writeError)
  }
}
```

placed alongside the existing (unchanged) `if (!isGreeting) { await
saveTurn(...) }` block -- best-effort, matching `saveTurn`'s existing
failure handling (a write failure must not turn a successful greeting into
a 500).

**Resulting loop:** open app -> wave plays instantly -> greeting call reads
last-saved mood/energy (from *any* device, via the existing `loadMemory` ->
`buildMemoryBlock` path, now genuinely reflecting the last real state) ->
LLM generates a continuous next mood + a personalized line ("Hi Amelie...")
-> saves just mood + energy -> next device to open picks up exactly there.

## 4. Concurrency-safe relationship progress (new migration)

Confirmed requirement: last-write-wins on mood/energy is fine, but a stale
device must never clobber newer relationship progress. The risk is real:
`saveTurn` currently computes `interaction_count: priorState.interaction_count + 1`
and `relationship_level: relationshipLevel(interactionCount)` from a
client-side snapshot read at the start of the request -- if two devices
each send a message around the same time, whichever's write lands second
would overwrite the first's incremented count with a stale `+1` off the
*same* original base, silently losing an interaction.

**Fix:** a new Postgres function, called via `.rpc()` instead of the
current plain `.upsert()`, so the increment happens atomically against
whatever is actually in the row at write time, not a stale in-memory
snapshot:

```sql
create or replace function upsert_character_turn(
  p_user_id uuid,
  p_mood text,
  p_energy int,
  p_last_seen_at timestamptz,
  p_streak_days int
) returns void
language sql
as $$
  insert into character_state (user_id, mood, energy, interaction_count, last_seen_at, relationship_level, streak_days)
  values (p_user_id, p_mood, p_energy, 1, p_last_seen_at, 1, p_streak_days)
  on conflict (user_id) do update set
    mood = excluded.mood,
    energy = excluded.energy,
    interaction_count = character_state.interaction_count + 1,
    last_seen_at = excluded.last_seen_at,
    relationship_level = case
      when character_state.interaction_count + 1 < 5 then 1
      when character_state.interaction_count + 1 < 20 then 2
      when character_state.interaction_count + 1 < 60 then 3
      else 4
    end,
    streak_days = excluded.streak_days;
$$;
```

`memory-write.ts`'s `saveTurn` changes from `.upsert(...)` to
`.rpc('upsert_character_turn', { p_user_id, p_mood, p_energy, p_last_seen_at, p_streak_days })`.
`p_energy` and `p_streak_days` are computed exactly as today --
`computeEnergy(priorState.last_seen_at, priorState.energy)` and
`computeStreak(priorState.last_seen_at, priorState.streak_days)`, unchanged
functions, just passed as RPC params instead of upsert fields. Only
`interaction_count`/`relationship_level` move from client-computed to
atomic-in-SQL. No RLS/grant changes needed -- this app's server always connects via the
Supabase service-role key, which bypasses RLS (and function ACLs) entirely,
same as every other table access already does.

**Accepted, explicitly scoped-down tradeoffs:**
- `streak_days` remains client-computed (`computeStreak`, reading a
  possibly-stale `last_seen_at` snapshot) and is passed straight through in
  the RPC call, not re-derived atomically. A same-second race here could
  very rarely miscount a streak by one day; self-corrects the next day.
  Streak is a "did you show up" flag, not core relationship progress, so
  this is judged not worth the added complexity of also pushing date-math
  into SQL.
- The `relationshipLevel` bucket thresholds (5/20/60) are now duplicated in
  both `api/lib/relationship.ts` (TypeScript, used for reads/display) and
  this SQL function (used for the atomic write). A future threshold change
  must update both. Flagged with a code comment in both places pointing at
  each other.

## 5. File relocation

`public/byte_robot_v3.html` (already moved ahead of this doc, matching the
project's established convention) -> `reference/character-prototypes/byte_robot_v3.html`.

## Out of scope

- No voice/TTS/mic call sites (`Byte.set('listening')`/`('talking')` stay
  fully wired and ready, but nothing in the app calls them yet -- there's no
  microphone or speech synthesis code to call them from).
- No idle/random autonomous move-triggering (e.g. Byte spontaneously
  walking around between messages) -- moves are reachable only via the
  LLM's `{mood}` choice and the one hardcoded `wave`-on-load call.
- No changes to the 34 existing mood visuals/particle effects -- only the
  pose/animation engine around them (legs, hands, moves) is new.
- No hard mood-transition state machine (§2c) -- soft prompt guidance only.

## Verify

- `Character` renders with no `mood` prop; removing/re-adding `<Character />`
  in `App.tsx` doesn't produce a prop-related type error.
- `window.Byte.set('wave')` and `window.Byte.list()` are callable from the
  browser console and behave as described.
- Opening the app: wave plays instantly, then transitions to a real mood
  once the greeting resolves; the greeting text uses the person's name.
- Backdate `character_state` for the test user, load the app, confirm the
  greeting's resulting mood/energy are saved (query the row afterward) --
  and confirm `interaction_count`/`relationship_level`/`streak_days`/`last_seen_at`
  are *unchanged* by the greeting.
- Send two real chat messages in quick succession (simulating near-concurrent
  devices, e.g. two curl requests) and confirm `interaction_count` ends up
  incremented by exactly 2, not 1 (the race the RPC fixes).
- Read a sample of replies across a conversation and confirm mood transitions
  read as gradual/motivated, not random swings turn to turn.
- Confirm the 12 new moves each render distinct hand/leg/body animation
  (spot-check a representative sample, not all 12 individually) and that
  the existing 34 moods' visuals are pixel-identical to before this change.
