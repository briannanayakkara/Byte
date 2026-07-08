# Character v5 Upgrade + Interactive Cursor-Follow + Poke Design

> Goal: two related changes, combined into one plan because they touch the
> same files and interact:
> 1. Port the v5 character upgrade (`reference/character-prototypes/byte_robot_v5.html`)
>    into the live app — three background toys (skateboard, ball, boombox),
>    three new scripted "Play" states (`skate`, `playball`, `jam`), each
>    with a built-in fumble, and a `bored` state that now autonomously
>    switches Byte into one of those Play states on its own after enough
>    time — plus the new `window.Byte.current()` API this requires.
> 2. Make Byte react to the cursor and to being clicked: when the cursor
>    comes near him he walks or runs toward it; clicking directly on him
>    triggers a quick poke reaction. Existing idle-random-move behavior and
>    chat-reply moods keep working.
>
> These interact because v5's bored-autoplay is a mood change that happens
> **inside** the animation engine itself, not from an external caller — so
> the priority scheme for "who's allowed to call `window.Byte.set()`" (part
> 2) has to account for Byte sometimes changing his own mood out from under
> whoever last set it (part 1's whole reason for `current()` existing).

## 1. Part 1: the v5 upgrade

### 1a. What's actually new, vs. what's already fixed in the React port

`Character.tsx`'s current header comment documents that it's a **hand-ported
translation** of the standalone HTML prototypes (v3 → v4), not a generated
copy — the port already carries its own fixes the prototype files don't
have (e.g. `newyear()` here uses `new Date().getUTCFullYear()`; the v5
prototype file still hardcodes `'2026!'`, same as v3/v4 did before that fix
landed). **Porting v5 must be a diff against v4, applied on top of the
current React component — not a wholesale re-translation of the whole
prototype file** — otherwise it silently reintroduces bugs the React port
already fixed.

Comparing `byte_robot_v4.html` (already ported) against
`byte_robot_v5.html` (new), the actual diff is:

- A new `<g id="toys">` SVG group (boombox, skateboard, ball), siblings of
  `#rootG` — always rendered, independent of mood, positioned by new
  `bdX`/`bdRot` (skateboard), `ballX`/`ballY` (ball), and `spk`/note-opacity
  (boombox) variables computed each frame.
- Three new entries in the mood dictionary: `skate()`, `playball()`,
  `jam()` — each just sets `extra.anim` (to `'skate'`, `'ballP'`, `'jam'`
  respectively) and a placeholder "!" reaction text element.
- Three new `renderFrame` blocks (`A === 'skate' | 'ballP' | 'jam'`) —
  full 9–13 second scripted routines with keyframed toy positions and a
  built-in fumble/fail beat partway through each.
- `bored`'s existing personality block gains: after ~6.6s, a "glancing at
  the toys" head-turn; after ~8.6s, `setMood(random Play state)` — fired
  from **inside** `renderFrame`, not from any external caller.
- `window.Byte.current(): Mood` — new, added specifically so external
  callers can tell that a self-triggered change happened.
- A new `'Play'` mood group (`skate`, `playball`, `jam`), inserted after
  `'Moves'` in the group list used for the demo's button UI.

Not ported: the prototype file's own demo button UI (`#groups` div) and the
`_frame`/`_manual` testing hooks on `window.Byte` — v4's port never carried
the demo UI forward either (`Character.tsx` has no buttons; control is only
via `window.Byte`), and nothing in this codebase's test suite touches
`_frame`/`_manual`.

### 1b. Where this touches the codebase

- **`Character.tsx`**: add the toys markup, the three mood functions, the
  three `renderFrame` blocks, the bored-autoplay escalation, `current()` in
  the `window.Byte` object (and its type declaration).
- **`src/types.ts`**: add `'skate' | 'playball' | 'jam'` to the `Mood`
  union.
- **`api/lib/types.ts`**: mirror the same three values in its own `Mood`
  union (this file's header comment already documents it's manually kept
  in sync with the frontend's, no codegen step).
- **`api/lib/moods.ts`**: add a `'Play'` group (`skate`, `playball`, `jam`)
  to `MOOD_GROUPS` — this is the single source of truth added earlier this
  branch specifically so a new mood can't silently become schema-invalid
  or prompt-invisible; adding it here is the *only* backend change needed
  for the LLM to be able to pick these moods (the JSON schema enum, the
  validator, and the prompt's mood listing all derive from this one list).
- **`src/components/MoodBubble.tsx`**: this file's `MOOD_LABELS` map is
  exhaustive over `Mood` (a prior review confirmed "all 34 entries
  present" for a previous mood addition) — add labels for the 3 new moods
  or the type check will fail to compile.
- No other API/prompt-copy changes needed: `buildOutputFormatInstructions`
  in `api/lib/prompt.ts` already renders its mood-group listing from
  `MOOD_GROUPS` dynamically (added this branch, specifically to avoid
  needing a matching prompt-copy edit every time the mood list changes).

## 2. Part 2: cursor-follow — why it's a real addition

`Character.tsx`'s `walk`/`run`/`moonwalk` moods already animate a full gait
cycle, but **in place** — `tx` oscillates back and forth around a fixed
root position. Byte himself never actually translates across the screen;
`App.tsx` centers him with a plain flex container that never moves.
Following the cursor requires an actual on-screen position that changes
over time, layered on top of the existing gait animation, not a change to
the animation itself.

## 3. Architecture

- **`src/hooks/useFollowCursor.ts` (new)** — tracks the mouse position,
  tracks Byte's own `(x, y)` via a ref-driven `requestAnimationFrame` loop,
  decides every frame whether he's idle, walking, or running, and calls
  `window.Byte.set(...)` to drive the mood. Returns `{ x, y }` for the
  caller to apply as a CSS transform.
- **`App.tsx`** — wraps `<Character />` in a positioned element applying
  `transform: translate(x, y)` from the hook (currently a plain centered
  `<div>`). Adds a click/tap handler on the same wrapper for the poke
  interaction. Extends the existing idle random-move `useEffect`'s guard.
- **`Character.tsx`'s existing animation internals are not modified by
  this part** — the hook only ever calls the same `window.Byte.set()`
  entry point every other caller already uses.

## 4. Steering behavior

Pure, unit-testable core (no DOM/timing dependencies):

```ts
interface FollowState {
  byteX: number
  byteY: number
  homeX: number
  homeY: number
}

type FollowDecision =
  | { action: 'idle' }
  | { action: 'walk' | 'run'; targetX: number; targetY: number }

function decideFollowAction(
  state: FollowState,
  cursor: { x: number; y: number } | null, // null when cursor is outside the window or untracked (touch)
  radius: { walk: number; run: number } // walk: 150, run: 250 (defaults)
): FollowDecision
```

- `cursor === null`, or distance `> radius.run`: not engaged. If Byte isn't
  already at `(homeX, homeY)`, steer him back home at walking pace; once
  within a small threshold of home, go idle.
- distance `<= radius.walk`: walk toward the cursor.
- `radius.walk < distance <= radius.run`: run toward the cursor.

The `requestAnimationFrame` loop calls this every frame, moves
`(byteX, byteY)` a fixed step toward the target (simple lerp, not physics),
calls `window.Byte.set('walk' | 'run')` only on an actual mood *change*
(calling `setMood` every frame would restart the gait cycle/particles
constantly — see `Character.tsx`'s `setMood`, which resets `t = 0` and
clears all particle arrays), and applies the resulting position as the
wrapper's `transform`.

**Bounds:** clamped to the viewport, inset ~60px top/left/right and ~120px
at the bottom (clear of the chat input strip).

**Home position:** viewport center — where he already sits today.

**Touch devices:** `cursor` is always `null` (no persistent pointer to
chase) — he stays home, idle-random-moves and bored-autoplay behave exactly
as today. Poke still works via tap.

## 5. Poke reaction

A click/tap directly on the wrapper element triggers a short scripted mood
sequence, independent of the steering loop:

```
surprised (brief) -> dizzy or annoyed (brief, alternate for variety) -> back to whatever he was doing
```

A small sequence of `window.Byte.set(...)` calls on `setTimeout`. No new
animation primitives needed — `surprised`/`dizzy`/`annoyed` already exist.

## 6. Priority / who owns `window.Byte.set()` — revised for v5

Five actors now exist, and one of them (bored-autoplay) isn't an external
caller at all — it happens inside `Character.tsx`'s own render loop. That's
exactly what `window.Byte.current()` is for: any external caller that's
about to call `set()` should check `current()` first to see whether Byte
has already moved himself somewhere else since the last time that caller
set his mood.

Priority, highest wins:

1. **Poke reaction** — always interrupts anything, including self-directed
   play. Sets `isReactingRef.current = true` for its short duration; every
   other actor skips calling `set()` while it's true.
2. **Chat reply mood** (existing, unchanged) — always interrupts anything,
   including self-directed play. The existing `isSendingRef` guard already
   protects this on the idle-move side; cursor-follow gets the same guard.
3. **Cursor-follow engaging** (cursor enters range) — also interrupts
   self-directed play: if Byte is mid-`skate`/`playball`/`jam` and the
   cursor comes within range, he stops and comes to you. Reads as
   attentive, not glitchy. Sets `isFollowingRef.current = true` while
   engaged (see part 4).
4. **Self-directed play** (v5's own bored → autoplay) — entirely internal
   to `Character.tsx`; nothing external calls `set()` for this transition.
   Both the idle-move timer and the follow loop must check
   `window.Byte.current()` before calling `set()` for their *own* reasons
   (a scheduled idle-move tick, or follow-engagement math landing exactly
   on a boundary) and skip their turn if `current()` is currently
   `'skate' | 'playball' | 'jam'` — i.e., don't casually interrupt a Play
   routine just because it happened to be some other actor's regular turn.
   Priority 3 (cursor genuinely entering range) is the one exception that
   still overrides it.
5. **Idle random moves** (existing) — fires only when none of the above
   are active and Byte isn't self-directedly playing.

**How a Play routine ends:** the v5 routines loop indefinitely once
entered (`t % TT`) — nothing inside them exits back to a neutral mood on
its own. That's fine: the existing idle-move timer already fires on its
own regular cadence regardless of current mood, so its next normal tick
naturally supersedes the Play state (once it's allowed to, per priority 5
only firing when nothing else claims priority 4) — no separate exit-timer
needed.

## 7. Testing

- **Unit tests**: `decideFollowAction`'s radius/walk-vs-run/home-return
  logic, given synthetic Byte/cursor positions — no DOM, no timers. A test
  confirming `MOOD_GROUPS`/`SELECTABLE_MOODS` (in `api/lib/moods.ts`)
  includes the three new Play moods (extending the existing
  `moods.test.ts`, same pattern that already guards against mood-list
  drift).
- **Manual browser verification** (no automated coverage for the rAF/DOM
  layer or the SVG animation itself, consistent with `Character.tsx`'s
  existing untested animation loop): cursor near/far transitions; poke
  sequence; idle-random-moves pausing while following and resuming after;
  never walking under the chat input; letting `bored` sit long enough to
  see it autonomously switch to a Play state; confirming cursor-follow
  correctly interrupts an in-progress Play routine; confirming each Play
  routine's fumble beat actually plays (skate wipeout, ball whiff, jam
  overspin) and the toy visuals (skateboard/ball/boombox) animate.

## 8. Explicitly out of scope

- Real physics (momentum, drag-and-fling) — poke is a scripted mood
  sequence, not a simulated knockback.
- Touch-based following — poke-via-tap only.
- Persisting his position across page loads — always starts at home
  (center) on mount.
- The LLM ever explicitly choosing `skate`/`playball`/`jam` as a reply
  mood beyond what `MOOD_GROUPS` already enables generically — no new
  prompt copy calling these out by name; they're just three more entries
  in the existing "pick a mood that fits" instruction.
- Any other backend/API/database change beyond the `Mood` type and
  `MOOD_GROUPS` additions described in part 1b.
