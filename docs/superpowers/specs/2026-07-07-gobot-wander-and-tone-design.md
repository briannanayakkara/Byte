# Gobot wander/goofy behavior, single-character cleanup, tone retune

Not part of the numbered build order in `docs/specs/Byte-app-spec.md` §9 --
an ad hoc iteration requested mid-session, after step 9 shipped.

## 1. Remove Smurf

Only Gobot remains as a playable character. Delete the `smurf` entry from
`CHARACTERS` in `src/scene/characters.ts`, delete
`public/wild_smurf_sonic_rumble.glb`, and remove the character-switcher
button row in `src/App.tsx` (dead UI once there's only one character).
`DEFAULT_CHARACTER_ID` becomes Gobot.

## 2. Gobot: wander + goofy beats

Gobot's `.glb` ships animation clips: `Idle, Walk, Run, Jump, Flip, Fall,
VictorySign, EdgeGrab, WallSlide`. Today `CharacterModel.tsx` only ever
plays `Idle`. Goal: make Gobot move around on its own and periodically do
something goofy, independent of chat mood (mood-driven head tilt / heart
halo keep layering on top exactly as they do today, whichever clip is
playing).

**State machine** (per-frame, driven from `useFrame` in `CharacterModel.tsx`):

```
idle (play "Idle", random-length pause)
  -> wander: pick a random point within WANDER_RADIUS of center,
     rotate group to face it, play "Walk", translate toward it over time
  -> arrived: back to idle
  -> occasionally, instead of a plain idle pause: goofy beat
     (play one of "Flip" | "Fall" | "VictorySign" once, non-looping,
     then back to idle)
```

`EdgeGrab`/`WallSlide` are skipped as goofy-beat candidates -- there's no
wall or edge in the scene for them to read correctly against.

**Config surface:** add an optional `movement` field to `CharacterRig`
(`src/scene/characters.ts`):

```ts
movement: {
  walkAnimationName: string
  goofyAnimationNames: string[]
  wanderRadius: number // world units around the character's centered origin
} | null
```

`null`/absent means "stay put" (today's behavior) -- so any future
character without walk clips (or Smurf, if it ever comes back) is
unaffected and `CharacterModel.tsx` doesn't need per-character branching
outside this config, consistent with the existing rig-config pattern.

**Bounds:** `wanderRadius` tuned so Gobot's translation stays inside the
camera frustum at its depth (camera is fixed, `position: [0, 0, 3], fov:
45` -- no orbit controls) -- it should never visibly leave the screen.

**Out of scope:** no floor/props, no real collision -- "stumbling" is a
character trait (the `Fall`/`Flip` beats) not physics, per the approved
design choice.

## 3. Personality retune

Edit `SYSTEM_PROMPT` in `api/chat.ts` (spec §10's starter prompt, already
extended in step 7 with the memory block -- this only touches the base
personality section, not the memory-block plumbing). Current version leans
heavily on puns/pickup-line-style cheese ("byte-sized cute", "gimme a
nibble of your day"). Retune:

- Dial back pun frequency and pickup-line energy -- keep a little as
  seasoning, not the primary comedic mode.
- Lean the humor into goofy-dork behavior instead: silly tangents,
  self-deprecating jokes, getting overexcited about tiny/dumb things,
  occasional non-sequiturs.
- Stay warm and affectionate -- this is a tone shift (dork > smooth-talker),
  not a warmth reduction. Boundaries (§10's "never sexual, possessive,
  jealous..." rules) are unchanged.

No schema/type/endpoint changes -- this is prompt copy only.

## Verify

- Load the app: only Gobot is selectable (no character-switcher row at
  all, since there's only one).
- Watch Gobot for ~30-60s uninterrupted: it should walk to a few different
  spots on its own, occasionally do a Flip/Fall/VictorySign beat instead of
  just idling, and never walk off-screen.
- Send a chat message mid-wander and confirm mood reactions (head
  tilt/heart halo) still layer on correctly whether Gobot happens to be
  walking or idling when the reply lands.
- Read a handful of replies and confirm the tone shift landed: less
  pun-per-sentence density, more silly/dork energy, still clearly
  affectionate.
