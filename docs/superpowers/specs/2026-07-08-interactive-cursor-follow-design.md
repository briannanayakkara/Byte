# Character v5 Upgrade: Toys, Play States, and Native Interactivity

> **Revision note:** an earlier version of this doc designed a React-side
> `useFollowCursor` hook and poke-reaction sequencer, on the assumption that
> cursor-following and click-poke needed to be built in app code. That
> assumption was wrong — a subsequent update to the v5 prototype file added
> all of that natively (pointer tracking, follow/arrive state machine, a
> hidden `poke` mood, and `pos()`/`poke()`/`interactive()` on `window.Byte`).
> Investigation (diffing the prototype file before/after, reading
> `App.tsx`/`MoodBubble.tsx`/`SpeechBubble.tsx`/`ThoughtBubble.tsx`, and
> reading `Character.tsx`'s actual JSX) confirmed this and found no
> pointer-event blockers in the existing app. This version of the doc
> reflects that: **this is now a porting task, not a design task** — every
> behavior decision (follow radius, poke variants, arrival behavior) was
> already made in the prototype file; the job is to faithfully translate it
> into the React component, the same way v3→v4 was ported before.

## 1. What's new, vs. what's already fixed in the React port

`Character.tsx`'s header comment documents that it's a **hand-ported
translation** of the standalone HTML prototypes, not a generated copy — the
port carries its own fixes the prototype files don't have (e.g. `newyear()`
here uses `new Date().getUTCFullYear()`; the raw prototype still hardcodes
`'2026!'`). **Porting v5 must be a diff against v4, applied on top of the
current React component — not a wholesale re-translation** — otherwise it
silently reintroduces bugs the React port already fixed.

Diffing `byte_robot_v4.html` (already ported) against
`byte_robot_v5.html` (`reference/character-prototypes/`, 749 lines), the
actual new surface is:

**Toys & Play states:**
- A new `<g id="toys">` SVG group (boombox, skateboard, ball), siblings of
  `#rootG` — always rendered, positioned each frame by `bdX`/`bdRot`
  (skateboard), `ballX`/`ballY` (ball), `spk`/note-opacity (boombox).
- Three new mood-dictionary entries: `skate()`, `playball()`, `jam()`.
- Three new `renderFrame` blocks (`A === 'skate' | 'ballP' | 'jam'`) — full
  9–13s scripted routines with keyframed toy positions and a built-in
  fumble beat.
- `bored`'s block gains: after ~6.6s, a glance at the toys; after ~8.6s,
  `setMood(random Play state)` — fired from **inside** `renderFrame`, not
  by any external caller.
- A new `'Play'` group (`skate`, `playball`, `jam`) in the demo's own
  `GROUPS` list (the button-UI grouping, not ported — see below).

**Native cursor + click interactivity:**
- `pointer = {x, y, t, in}` and `follow = {on, arr}` state, updated by
  `pointermove`/`pointerleave`/`pointerdown` listeners on the SVG root.
- Every frame: if interactive, the pointer is fresh (<2.4s old), current
  mood is in a curated "calm" set (`FOLLOW_OK` — happy, excited, content,
  neutral, curious, confused, laughing, lovestruck, bored, proud, smug,
  wave, walk, run, wiggle, lookaround), and not already following: his head
  tracks the cursor horizontally; if the cursor is 34–132px away
  horizontally and within 130px vertically, he engages follow.
- While following: walks or runs (`run` if the remaining distance is
  >90px) toward the cursor's x position (world offset clamped ±76px from
  center); on arrival, does a little hop-hop and tracks the cursor "like a
  cat." Disengages if not interactive, pointer leaves, goes stale, mood
  leaves `FOLLOW_OK`, or **any external `Byte.set()` call happens** — every
  `setMood()` resets `follow.on = false` unconditionally, which is exactly
  why the existing idle-move timer and chat-reply mood-setting need zero
  changes to coexist with this.
- A hidden `'poke'` mood (not in the public `list()`/`GROUPS`): triggered
  by `pointerdown` within a hit-test region roughly matching his body
  (`|x − byteX| < 62`, `y ∈ [54, 284]` in the 320×300 stage). Picks one of
  three ~950ms reactions — tickled giggle, startled hop, or (forced if
  poked 3+ times within 4.2s) an annoyed swat — then automatically restores
  whatever mood was active before the poke.
- New `window.Byte` methods: `pos()` (current world x), `poke(variant?)`
  (trigger programmatically), `interactive(bool)` (kill-switch — also
  cancels any in-progress follow/pointer state when turned off).
- Not ported: the prototype's own demo button UI (`#groups` div) and the
  `_frame`/`_manual`/`_pointer` testing hooks — v4's port never carried the
  demo UI forward either (`Character.tsx` has no buttons), and nothing in
  this codebase's test suite touches those internal hooks.

## 2. Confirmed safe — no coordination logic needed in app code

This was the main open question and it's resolved by inspection, not
assumption:

- **Idle random-move timer** (`App.tsx`) calls `window.Byte.set(random)` on
  its existing schedule, guarded by `isSendingRef` — unchanged. Because
  every `setMood()` resets `follow.on = false`, an idle-move tick correctly
  cancels an in-progress chase, exactly matching "any `Byte.set()` call
  simply takes over."
- **Chat-reply mood** (`handleSend` in `App.tsx`) — same, unchanged.
- **`MoodBubble.tsx`** already listens to a `'byte:change'` window event
  (dispatched by the *ported* `setMood`, not present in the raw prototype —
  this was added specifically for this app) rather than polling — so it
  already reflects self-directed changes correctly, **provided the port
  keeps firing that event from every new internal path** (poke, follow
  engaging/arriving, bored-autoplay). This is the one integration detail
  that needs explicit attention during the port; everything else is
  already event-driven correctly.
- **Pointer events reach the character today** — verified by reading the
  actual JSX: `Character.tsx`'s `<svg>` has no `pointer-events` restriction,
  and every sibling overlay in `App.tsx` (`MoodBubble`, `SpeechBubble`,
  `ThoughtBubble`) is already `pointer-events-none` and positioned clear of
  his body (`MoodBubble` is a small top-right badge; the speech/thought
  bubbles float above his head via `bottom-full`). No blockers to fix.

## 3. Where this touches the codebase

- **`Character.tsx`**: port the toys markup, the three mood functions, the
  three `renderFrame` blocks, the bored-autoplay escalation, the
  pointer/follow/poke state and event listeners, and the expanded
  `window.Byte` object (`pos`, `poke`, `interactive`) — ensuring
  `'byte:change'` keeps firing from every mood-changing path, including the
  new internal ones.
- **`src/byte-global.d.ts`**: add `pos(): number`, `poke(variant?: number): void`,
  `interactive(enabled: boolean): void` to the `Window.Byte` type.
- **`src/types.ts`**: add `'skate' | 'playball' | 'jam'` to the `Mood`
  union. (The internal-only `'poke'` mood is *not* added here — it's never
  externally set or returned by `current()`/`list()` in the source file,
  so it has no reason to exist in the app's public `Mood` type.)
- **`api/lib/types.ts`**: mirror the same three values (this file's header
  comment already documents it's manually kept in sync, no codegen step).
- **`api/lib/moods.ts`**: add a `'Play'` group (`skate`, `playball`, `jam`)
  to `MOOD_GROUPS` — **per your decision, these should be LLM-selectable**,
  same as every other mood. This is the only backend change needed: the
  JSON schema enum, the validator, and the prompt's mood-group listing in
  `api/lib/prompt.ts` all derive from this one list already (added earlier
  this branch specifically so a new mood can't silently go
  schema-invalid/prompt-invisible).
- **`src/components/MoodBubble.tsx`**: `MOOD_LABELS` is `Record<Mood, string>`
  — exhaustive, so `tsc` will fail to build without adding labels for the
  three new moods.

## 4. Testing

- **Unit test**: extend the existing `api/lib/moods.test.ts` to confirm
  `MOOD_GROUPS`/`SELECTABLE_MOODS` includes the three new Play moods (same
  pattern already guarding against mood-list drift).
- **Manual browser verification** (no automated coverage for the SVG
  animation/pointer layer, consistent with `Character.tsx`'s existing
  untested animation loop):
  1. `npm run dev`, open the app.
  2. Move the cursor near Byte (within ~130px) while he's in a calm mood —
     his head should track it, then he should walk/run over and settle
     into a little hop-hop, continuing to track the cursor.
  3. Move the cursor away or let it go stale — he should stop and resume
     normal idle behavior.
  4. Click directly on his body — a ~1s poke reaction (giggle, startled
     hop) plays, then he returns to whatever mood he was in. Click 3+ times
     quickly — the reaction should become an annoyed swat.
  5. Leave him alone in `bored` for ~9 seconds (idle-move timer will
     eventually pick `bored`, or trigger it via `window.Byte.set('bored')`
     in the console) — he should autonomously switch into a random Play
     state and run its full routine, fumble included.
  6. Confirm `MoodBubble`'s label updates correctly for both the
     bored→Play autotransition and a poke reaction, not just for
     externally-set moods.
  7. Confirm sending a chat message or an idle-move tick correctly
     interrupts an in-progress follow-chase or Play routine.

## 5. Explicitly out of scope

- Any new app-side cursor-tracking, steering, or poke-reaction logic — all
  of it is native to the ported file now.
- Persisting his position across page loads — always starts at home
  (center) on mount, matching today's behavior.
- Any other backend/API/database change beyond the `Mood` type and
  `MOOD_GROUPS` additions described in section 3.
