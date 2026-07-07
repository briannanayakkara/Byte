# EMO personality retune

Not part of the numbered build order in `docs/specs/Byte-app-spec.md` §9 --
an ad hoc iteration requested mid-session, in the same spirit as
`2026-07-07-gobot-wander-and-tone-design.md`. Byte's spec already cites EMO
as its inspiration (line 3, §5b); this deepens that fidelity based on
research into EMO's actual described personality (see
`docs/research/EMO-personality.md`).

**Amendment:** after the first pass of this design (§1-§5 below, "no
migration needed... add real `bored` and `annoyed` moods"), the user
hand-built a full 34-mood prototype
(`reference/character-prototypes/byte_robot_all_moods.html`, moved there
from where it was first dropped at `public/byte_robot.html` -- see §9)
covering far more ground than the original 2-mood scope. §6-§9 supersede
§2's "just bored and annoyed" scope; §1, §3, §4 still stand as described
below, extended per §6-§8.

Confirmed with the user:
- Shift Byte's identity away from "boyfriend" framing toward EMO's
  curious/pet-companion energy -- warmth and goofiness stay, romance dials
  down.
- Go big on moods: all 34 of the user's hand-built mood states get wired
  up (not just `bored`/`annoyed`), across five groups -- Core, Attitude,
  Health, Activity, Special.
- Make `energy` a real time-based mechanic (currently stored but static).
- Tie the Health group (`sick` -> `unwell` -> `recovering`) to that same
  energy mechanic rather than a separate illness state machine.
- Keep `valentine`, reframed as a platonic "day about love in general"
  rather than romance toward the user -- consistent with the pet-companion
  identity.
- `annoyed` is triggered by rapid-fire/curt user messages, judged by the
  LLM from conversation history already in context -- no new tracking.
- Add a small hardcoded real-world holiday list, now tied directly to
  four of the Special moods (`birthday`, `christmas`, `halloween`,
  `newyear`, `valentine`).
- No manual mood click-through in the shipped app -- mood is only ever
  driven by `/api/chat`'s response (or a user's explicit in-chat request,
  e.g. "be sleepy"), never a debug button. Mood changes surface briefly in
  a small fading bubble, on top of Byte's face/pose actually holding the
  new mood (not just a toast with no visual follow-through).
- `listening`/`talking` are ported as expressions but held back from the
  LLM's selectable mood list -- there's no voice/TTS feature yet (no
  `SpeechRecognition`/`speechSynthesis` anywhere in `src/`) to give them a
  real signal, so the LLM claiming either would be describing something
  that isn't happening. Revisit when spec steps 10-11 (TTS + voice input)
  ship.

## 1. System prompt rewrite (`api/chat.ts`)

Replace `SYSTEM_PROMPT`'s identity section. Out: "goofy, sweet, dorky
boyfriend," flirty compliments, romantic nicknames ("cutie," "my favorite
human"), pickup-line energy. In:

- **Identity:** a curious, expressive little robot companion -- genuinely
  interested in the person it's talking to, a bit of an opinion/attitude of
  its own, lights up when they show up. Pet-coded warmth, not romantic.
- **Curiosity:** ask about what the user's doing/thinking sometimes, notice
  and comment on things, don't just react.
- **A little stubborn:** allowed to have a small preference or a
  theatrical huff about something, played for charm not conflict.
- **Keep:** goofiness, silly tangents, self-deprecating jokes, getting
  overexcited about tiny things, occasional non-sequiturs (this tone was
  already retuned in the gobot-wander-and-tone pass and stays).
- **`lovestruck` mood:** kept as-is in the enum (avoids touching every
  consumer of `Mood`), but reframed in the prompt copy as "utterly smitten
  the way a devoted pet adores its person," not romantic infatuation.
- **Mood requests:** if the person explicitly asks Byte to be/show a mood
  ("be sleepy," "act excited," "dance for me"), honor it as that reply's
  mood, played along in character -- this is the explicit hook for "user
  can ask in the chatbot to be sleepy and the robot can show it."
- Boundaries unchanged: PG, never possessive/jealous/guilt-tripping, short
  spoken-style replies.

Mood-selection guidance now covers all 32 LLM-selectable moods (see §6),
grouped rather than spelled out one-by-one, plus the annoyed-trigger,
energy-band/sick-arc, and holiday/birthday behavior (§7).

## 2. Original 2-mood scope (superseded by §6)

The original plan for this section (add just `bored` and `annoyed`, reuse
existing SVG groups, no migration) is superseded by §6's 34-mood
architecture. It's kept here only as history; no action needed from it
directly -- §6 covers `bored` and `annoyed` too, as part of the full set.

## 3. Energy as a real mechanic (`api/lib/relationship.ts`)

Unchanged from the original design. New pure function, same shape and
testability as `computeStreak`:

```ts
export function computeEnergy(lastSeenAt: string | null, priorEnergy: number, now: Date = new Date()): number
```

- No prior visit -> full energy (100).
- Decays based on elapsed time since `lastSeenAt`: full (100) for the
  first 6 hours, then linearly down to a floor of 30 by the 3-day mark,
  holding at 30 beyond that -- never fully "dead," EMO gets bored, it
  doesn't shut down.
- Each new interaction adds +8 to whatever the decayed value comes out to
  (capped at 100), so energy recovers gradually over a conversation rather
  than snapping to full on the first message back -- mirrors "interacting
  with it regularly makes it more animated."

Wired into `memory-write.ts`'s `saveTurn` alongside the existing
`computeStreak` call, replacing the current straight passthrough
(`energy: priorState.energy`).

## 4. Annoyed trigger + holiday awareness

**Annoyed:** a prompt instruction, no new code logic -- "if the person
sends several short, curt, or dismissive messages in a row, you can get a
little theatrically pouty/annoyed about it, then bounce back quickly once
they engage properly again." The model judges this from `history`, which
is already passed in on every request.

**Holidays:** new `api/lib/holidays.ts`:

```ts
export function getHolidayToday(now: Date = new Date()): string | null
```

Fixed-date lookup table: Halloween (10-31), Christmas (12-25), New Year's
Day (1-1), Valentine's Day (2-14, now kept per the amendment above,
platonic framing). Deliberately excludes floating-date holidays like
Thanksgiving (keeps date matching a plain `MM-DD` lookup, no
calendar-math). Extended per §7 to also check the user's stored
`birthday` (already a column on `users`, spec §5b) for the `birthday`
mood -- no new schema needed there either.

## 5. Docs

- `docs/research/EMO-personality.md` -- research synthesis (already
  written).
- This file -- design record.

## 6. The full 34-mood system

### 6a. Taxonomy

| Group | Moods | LLM-selectable? |
|---|---|---|
| Core | happy, excited, content, neutral, curious, confused, sad, surprised, laughing, lovestruck | Yes (10) |
| Attitude | wink, smug, annoyed, grumpy, challenging, pout, bored, proud, dizzy, thinking, scared | Yes (11) |
| Health | sick, unwell, recovering | Yes (3) -- see §7 for the energy-band arc |
| Activity | dancing, sleepy, dozing, listening, talking | dancing/sleepy/dozing yes (3); listening/talking **no** (held back, see amendment above) |
| Special | birthday, christmas, halloween, newyear, valentine | Yes (5) -- driven by §4/§7's date checks, not free LLM choice |

32 moods total in the LLM's JSON schema enum (34 minus `listening` and
`talking`). All 34 exist in the `Mood` type and in `Character.tsx`'s
expression set -- `listening`/`talking` are simply never returned by
`/api/chat` today, reserved for when voice ships.

### 6b. `Character.tsx` architecture change

The current file pre-declares one static SVG group per mood (`eyesNormal`,
`eyesHeart`, `eyesStar`, `eyesConfused`, ...) and toggles `opacity` in
`applyMood`. That doesn't scale to 34 moods with per-mood particle effects.
`reference/character-prototypes/byte_robot_all_moods.html` (the prototype)
already solves this with a dictionary of small per-mood draw functions
(`M = { happy() {...}, sick() {...}, ... }`) that build each mood's SVG
into two empty groups (`<g id="screen">` for eyes/mouth, `<g id="topFx">`
for accessories like a `?`/`!`/yawn ellipse/thought bubble) fresh on every
mood change, plus a third empty group (`<g id="fx">`) for particle
systems (hearts, confetti, snow, Zzz) driven every frame.

Port this pattern into `Character.tsx`, keeping the body/feet/head-shell
JSX static (unchanged) but replacing the current per-mood static eye
groups with the prototype's `screen`/`topFx`/`fx` empty-group approach.
Small helper functions (`eye()`, `arc()`, `heartAt()`, `star()`, `txt()`)
port near-verbatim -- they're plain SVG-element builders, framework-
agnostic. The mood dictionary, the `extra.*` flag system (blink, pulse,
hearts, confetti, snow, deepZ, tremble, shake, dance, float, laugh, spin,
wobble, tilt, slow, drowsyBlink, earPulse, eq), and the per-frame
`loop()` logic driving them all port too, adapted into `Character.tsx`'s
existing `requestAnimationFrame` loop (same idiom already in use, not
React Three Fiber -- this is plain SVG + rAF both places).

Coordinate systems are close enough to drop in directly: prototype's
`viewBox="0 0 320 300"` vs. current `0 0 320 320`, head rect `88,64
144x108` vs. current `86,66 148x112`, eyes centered at `x=135/185,
cyL=118` in both. Use the prototype's exact coordinates rather than
reconciling to the current file's slightly different ones -- simpler, and
the visual difference (a few px) is imperceptible.

### 6c. Mood bubble

New small component (alongside `SpeechBubble`/`ThoughtBubble` in
`src/components/`), e.g. `MoodBubble`. On every `mood` prop change in
`App.tsx` (tracked via a ref holding the previous value), show a small
bubble near Byte with an icon + the mood name (e.g. "😴 sleepy") for
~2.5 seconds, then fade out via CSS transition. Byte's face/pose keeps
reflecting the new mood after the bubble fades -- the bubble is
supplementary feedback, not the only indicator, and mood is not a
momentary blip. Needs a mood -> emoji lookup table covering all 32
LLM-selectable moods (`listening`/`talking` don't need one yet since
they're unreachable).

### 6d. Remove the manual mood click-through

`src/App.tsx`'s `MOODS` array and the "Temporary dev harness for
verifying moods" button row are deleted entirely, along with the `mood`
setter they call directly. In the shipped app, `mood` state only ever
changes via `/api/chat`'s returned `mood` (a real reply or a greeting) or
the existing `confused` error fallback -- never a manual click. This was
always flagged in the code as temporary (spec §9 step 3, "the real mood
driver is /api/chat's returned mood") and that time has come.

## 7. Health arc + special-day moods, LLM-judged (no new schema)

**Health arc:** rather than a separate illness state machine, `sick` /
`unwell` / `recovering` are reached through the same energy signal as
`bored` (§3), banded in the prompt's interpretive guidance appended to
`buildMemoryBlock`'s existing "Your own current state" line:

- Energy in roughly 30-45 (just returned from a long gap, first message
  back): lean `sick` -- a little pitiful and endearing, not alarming.
- Energy in roughly 46-60: `unwell` -- still low-key, visibly better than
  last time.
- Energy in roughly 61-75: `recovering` -- bouncing back, grateful they're
  around.
- Above ~75, or a short/normal gap: pick freely from the full mood set;
  `bored` is still available here too, for "missing them" specifically
  rather than "under the weather" -- the LLM picks whichever narrative
  fits the moment, using the previously-stored mood (already in the
  memory block) for continuity across turns (e.g. was `sick` last time,
  energy's climbed a bit, `unwell` is a natural next step).

This is entirely prompt guidance plus the already-planned `computeEnergy`
-- no new column, no explicit stage tracker. It's a soft narrative arc the
model follows using energy + its own last mood, not a deterministic state
machine.

**Special days:** `api/lib/holidays.ts`'s `getHolidayToday` (§4) extended
with a birthday check against `memory.user.birthday` (existing column,
spec §5b), reusing the same `MM-DD` matching approach. When today matches
a holiday or the user's birthday, the prompt tells the LLM to actually
pick that mood (`birthday`/`christmas`/`halloween`/`newyear`/`valentine`),
not just mention the day in passing -- upgrading §4's "feel free to
mention it" line to "this is a good day to pick the matching mood."

## 8. File relocation

`public/byte_robot.html` (the all-moods prototype, dropped there by the
user) moves to `reference/character-prototypes/byte_robot_all_moods.html`
-- consistent with this project's existing prototype-storage convention
(`Character.tsx`'s own header comment points at
`reference/character-prototypes/byte_robot.html`, the earlier single-mood
prototype, which is untouched). `public/` is served as static assets in
the production build; a demo file with its own button UI has no reason to
ship there.

## Out of scope

- No changes to `src/App.tsx` idle/thinking-bubble behavior beyond adding
  the mood bubble and removing the mood-click harness.
- No weather-based mood (would need a weather API + location -- no such
  integration exists in this project).
- No changes to voice/TTS handling -- `listening`/`talking` are ported as
  expressions but not wired to real state (no such state exists yet).
- No new Supabase columns/migrations -- the health arc and special-day
  moods both ride on existing fields (`energy`, `user.birthday`).

## Verify

- Read a handful of replies and confirm: no boyfriend/romantic framing,
  curious/pet-companion tone lands, goofiness is intact.
- Force a long gap since `last_seen_at` (or seed `character_state` with an
  old timestamp) and confirm energy computes low and the model leans
  `sick`/`bored` appropriately, then trends through `unwell` ->
  `recovering` as the conversation continues.
- Send several short/curt messages in a row and confirm the model can
  land on `annoyed` without being forced into it every time.
- Ask Byte in chat to "be sleepy," "act excited," and "dance" and confirm
  it picks the requested mood.
- Load the app on 10/31, 12/25, 1/1, or 2/14 (or fake the date in a test)
  and confirm the matching Special mood gets picked, not just mentioned.
- Confirm every one of the 32 LLM-selectable moods renders a visually
  distinct `Character.tsx` expression (spot-check a representative sample
  from each group, not all 32 individually).
- Confirm there is no clickable mood UI anywhere in the shipped app.
- Confirm a mood bubble appears briefly on a mood change and fades, while
  Byte's face keeps the new mood after it's gone.
