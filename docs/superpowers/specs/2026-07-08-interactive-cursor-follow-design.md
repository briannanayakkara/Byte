# Interactive Cursor-Follow + Poke Design

> Goal: make Byte react to the cursor and to being clicked, instead of only
> ever standing centered in place. When the cursor comes near him he walks
> or runs toward it; when you click directly on him he reacts with a quick
> poke response. Existing idle-random-move behavior and chat-reply moods
> keep working, with a clear priority order so the three systems don't fight
> over `window.Byte.set()`.

## 1. Why this is a real addition, not a reuse of existing moves

`Character.tsx`'s `walk`/`run`/`moonwalk` moods already animate a full gait
cycle, but they animate **in place** — `tx` oscillates back and forth around
a fixed root position (see `renderFrame`'s walk/run branch, `AMP = 64`,
`tx = AMP * Math.sin(w)`). Byte himself never actually translates across the
screen; `App.tsx` centers him with a plain flex container and never moves
that container. Making him "follow the cursor" requires an actual on-screen
position that changes over time, layered on top of the existing gait
animation, not a change to the animation itself.

## 2. Architecture

- **`src/hooks/useFollowCursor.ts` (new)** — the entire feature lives here.
  Tracks the mouse position, tracks Byte's own `(x, y)` via a ref-driven
  `requestAnimationFrame` loop, decides every frame whether he's idle,
  walking, or running, and calls the existing `window.Byte.set(...)` API to
  drive the mood — exactly the same call every other caller already uses.
  Returns `{ x, y }` (pixels, relative to a fixed home/origin) for the
  caller to apply as a CSS transform.
- **`App.tsx`** — wraps `<Character />` in a positioned element that applies
  `transform: translate(x, y)` from the hook's returned position (currently
  a plain centered `<div>`). Adds an `onClick`/`onPointerDown` handler on
  that same wrapper for the poke interaction. Extends the existing idle
  random-move `useEffect`'s guard condition (currently
  `if (!isSendingRef.current)`) to also check the hook's "is currently
  engaged" flag.
- **`Character.tsx` is not modified.** It only ever receives mood strings
  through the same `window.Byte.set()` entry point it already exposes;
  it has no knowledge of screen position, the cursor, or clicks.

This keeps "where is he" (new, small, pure-function-testable steering
logic) fully separate from "how does his body move" (the existing
~1500-line animation engine) — two units, each independently understandable
and testable, communicating only through the mood string.

## 3. Steering behavior

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

- `cursor === null`, or distance from Byte to cursor `> radius.run`: not
  engaged. If Byte isn't already at `(homeX, homeY)`, steer him back home at
  walking pace; once within a small threshold of home, go idle.
- distance `<= radius.walk`: walk toward the cursor.
- `radius.walk < distance <= radius.run`: run toward the cursor (he's
  behind and trying to keep up).

The `requestAnimationFrame` loop calls this every frame, moves
`(byteX, byteY)` a fixed step toward `targetX/targetY` (simple lerp, not a
physics simulation), calls `window.Byte.set('walk' | 'run')` only on an
actual mood *change* (not every frame — `Character.tsx`'s `setMood` resets
animation phase/particles, so calling it every frame would restart the gait
cycle constantly), and applies the resulting position as the wrapper's
`transform`.

**Bounds:** `(byteX, byteY)` is clamped to the viewport, inset by a margin
(~60px) on the top/left/right and a larger inset (~120px) on the bottom to
stay clear of the chat input strip.

**Home position:** viewport center — the same spot he already occupies
today, so idle/first-load behavior is visually unchanged.

**Touch devices:** no persistent pointer to chase, so `cursor` is always
`null` on touch-only devices (detected via `matchMedia('(pointer: coarse)')`
or the simple absence of `pointermove`/`mousemove` events) — he stays home
and idle-random-moves behave exactly as today. Poke still works via tap
(see below), since that's a discrete event, not continuous tracking.

## 4. Poke reaction

A click/tap directly on the wrapper element (sized to the character's
bounding box, same as today) triggers a short scripted mood sequence,
independent of the steering loop:

```
surprised (brief) -> dizzy or annoyed (brief, alternate for variety) -> back to whatever he was doing
```

Implemented as a small sequence of `window.Byte.set(...)` calls on
`setTimeout`, mirroring the existing pattern already used for
`saveGreeting`/idle timers elsewhere in this codebase (no new animation
primitives needed in `Character.tsx` — `surprised`/`dizzy`/`annoyed` already
exist as moods).

## 5. Priority / who owns `window.Byte.set()`

Four callers now exist. Highest priority wins; a lower-priority caller
checks a ref before calling `set()`:

1. **Poke reaction** — sets `isReactingRef.current = true` for its short
   duration; both the follow loop and idle-move timer skip calling `set()`
   while it's true.
2. **Chat reply mood** (existing, unchanged) — already the freshest signal
   whenever it fires; the follow loop and idle timer naturally don't fire
   mid-request since sending disables input, but the existing
   `isSendingRef` guard on idle-moves already protects this case.
3. **Cursor-follow** (walk/run toward cursor) — sets a new
   `isFollowingRef.current = true` while engaged (distance `<= radius.run`
   or actively walking home); the idle random-move timer's existing guard
   (`if (!isSendingRef.current)`) becomes
   `if (!isSendingRef.current && !isFollowingRef.current)`.
4. **Idle random moves** (existing, unchanged otherwise) — fires only when
   none of the above are active.

## 6. Testing

- **Unit tests** (new `src/hooks/decideFollowAction.test.ts` or colocated
  with the pure function if extracted to its own file): the
  radius/walk-vs-run/home-return decision logic, given synthetic
  Byte/cursor positions — no DOM, no timers.
- **Manual browser verification** (this feature has no automated coverage
  for the rAF/DOM layer, consistent with `Character.tsx`'s existing
  animation loop): move the cursor near/far from Byte and confirm
  walk/run/idle/home-return transitions; click him and confirm the poke
  sequence; confirm idle random moves pause while following and resume
  after; confirm he never walks under the chat input.

## 7. Explicitly out of scope

- Real physics (momentum, drag-and-fling) — poke is a scripted mood
  sequence, not a simulated knockback.
- Touch-based following — poke-via-tap only.
- Persisting his position across page loads — always starts at home
  (center) on mount, matching today's behavior.
- Any backend/API/database change — this is entirely client-side.
