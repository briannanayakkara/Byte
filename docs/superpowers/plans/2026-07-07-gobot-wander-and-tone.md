# Gobot Wander/Goofy Behavior, Single-Character Cleanup, Tone Retune Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Smurf character so Gobot is the only one, make Gobot wander around the scene and occasionally do a goofy one-shot animation on its own, and retune Byte's system prompt from pun-heavy/cheesy toward goofy-dork humor.

**Architecture:** A small per-frame state machine (`idle` / `walking` / `goofy`) lives in `CharacterModel.tsx`'s existing `useFrame` loop, driven by an optional `movement` field on `CharacterRig` (`src/scene/characters.ts`) so rigs without walk clips are unaffected. Personality tone is a text-only edit to the `SYSTEM_PROMPT` constant in `api/chat.ts`.

**Tech Stack:** React Three Fiber (`@react-three/fiber`, `@react-three/drei`), `three`'s `AnimationAction` API (`useAnimations`), existing TypeScript/Tailwind stack. No new dependencies.

## Global Constraints

- Design doc: `docs/superpowers/specs/2026-07-07-gobot-wander-and-tone-design.md` — read it for the "why" behind scope decisions (no floor/props, movement independent of mood, which goofy clips were excluded and why).
- Per `.claude/skills/testing-patterns` (this repo's documented testing approach): **do not unit-test R3F/Three.js rendering or animation** — it's explicitly called out as better verified visually. No test framework (Vitest) is installed yet either. So unlike a typical TDD plan, these tasks replace "write failing test" / "make it pass" steps with **typecheck + lint + a concrete manual verification procedure against the running dev server**. This is a deliberate, spec-documented deviation, not a skipped step.
- Typecheck command: `npx tsc -b` (expect zero output on success).
- Lint command: `npx oxlint .` (a pre-existing unrelated warning at `src/scene/CharacterModel.tsx:112` about `actions` exhaustive-deps is expected and NOT something to fix in this plan — confirm no *new* warnings appear beyond it).
- Dev server: `npm run dev` (Vite, default port 5173). The `api/chat` dev middleware hot-reloads `api/*.ts` per-request; the Vite client hot-reloads `src/*.tsx` — no restart needed between edits.
- Commit after each task, following this repo's existing commit style (see `git log` — `Step N: ...` for spec build-order work; this work isn't a numbered spec step, so use a plain descriptive message, no "Step N" prefix).
- Code style: `.claude/skills/code-style` — function components only, no `any` without a comment, Tailwind utility classes only, `oxlint` not ESLint.

---

### Task 1: Remove the Smurf character

**Files:**
- Modify: `src/scene/characters.ts`
- Modify: `src/App.tsx`
- Delete: `public/wild_smurf_sonic_rumble.glb`

**Interfaces:**
- Produces: `CHARACTERS` array with exactly one entry (`gobot`); `DEFAULT_CHARACTER_ID` still resolves via `CHARACTERS[0].id`, unchanged in form.

- [ ] **Step 1: Remove the `smurf` entry from `CHARACTERS`**

In `src/scene/characters.ts`, delete the entire `smurf` object (lines 28-47 as of this plan — verify by matching content, not line numbers, since earlier edits in this task may shift them) from the `CHARACTERS` array:

```ts
  {
    id: 'smurf',
    label: 'Smurf',
    modelPath: '/wild_smurf_sonic_rumble.glb',
    targetHeight: 1.6,
    rig: {
      armPairs: [
        ['L_Arm_A_00', 'L_Arm_B_08'],
        ['R_Arm_A_022', 'R_Arm_B_023'],
      ],
      headBoneName: 'C_Head_06',
      chestBoneName: 'C_Spine_C_05',
      // Identified by directly inspecting the glTF: Sketchfab's Blender
      // export names these mesh container nodes generically even though the
      // underlying meshes are named Mesh_eye_..._R_Eye / L_Eye.
      rightEyeName: 'Object_55',
      leftEyeName: 'Object_56',
      idleAnimationName: null,
    },
  },
```

Leave the `gobot` entry and the trailing comment about Daffy Duck as-is for now (Task 2 edits the `gobot` entry's `rig`).

- [ ] **Step 2: Delete the now-unused Smurf asset**

```bash
git rm public/wild_smurf_sonic_rumble.glb
```

- [ ] **Step 3: Remove the character-switcher UI and now-dead `characterId` state from `src/App.tsx`**

With only one character, `characterId` can never change, so both the switcher buttons and the state/prop that drove them are dead code. Replace:

```tsx
  const [mood, setMood] = useState<Mood>('neutral')
  const [characterId, setCharacterId] = useState(DEFAULT_CHARACTER_ID)
  const [messages, setMessages] = useState<ChatMessage[]>([])
```

with:

```tsx
  const [mood, setMood] = useState<Mood>('neutral')
  const [messages, setMessages] = useState<ChatMessage[]>([])
```

Replace:

```tsx
          <CharacterModel mood={mood} characterId={characterId} />
```

with:

```tsx
          <CharacterModel mood={mood} />
```

Replace:

```tsx
        {/* Temporary dev harness for verifying moods/characters (spec §9
            step 3) — the real mood driver is /api/chat's returned mood,
            wired in step 5. Character choice isn't in the spec; added so
            multiple sourced models can be compared before settling on one. */}
        <div className="flex flex-col items-center gap-2 border-t border-white/10 pt-3">
          {CHARACTERS.length > 1 && (
            <div className="flex flex-wrap justify-center gap-2">
              {CHARACTERS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCharacterId(c.id)}
                  className={`rounded-full px-3 py-1 text-sm transition-colors ${
                    c.id === characterId ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-2">
```

with:

```tsx
        {/* Temporary dev harness for verifying moods (spec §9 step 3) --
            the real mood driver is /api/chat's returned mood, wired in
            step 5. */}
        <div className="flex flex-col items-center gap-2 border-t border-white/10 pt-3">
          <div className="flex flex-wrap justify-center gap-2">
```

Finally, update the import line (drop the now-unused `CHARACTERS`, keep `DEFAULT_CHARACTER_ID` only if still referenced — it no longer is after removing the `useState(DEFAULT_CHARACTER_ID)` call, so drop both):

```tsx
import { CHARACTERS, DEFAULT_CHARACTER_ID } from './scene/characters'
```

Delete this line entirely — nothing in `App.tsx` references `./scene/characters` anymore once `characterId` is gone.

- [ ] **Step 4: Typecheck and lint**

```bash
npx tsc -b
npx oxlint .
```

Expected: `tsc -b` prints nothing (success). `oxlint` prints only the pre-existing `CharacterModel.tsx:112` exhaustive-deps warning — no new warnings or errors (in particular, no "unused variable" errors for `CHARACTERS`, `DEFAULT_CHARACTER_ID`, `characterId`, or `setCharacterId`, confirming the cleanup was complete).

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open the app in a browser. Confirm:
- Gobot renders (no console error about a missing character).
- There is no character-switcher button row above the mood buttons — only the mood buttons remain in the dev harness row.

- [ ] **Step 6: Commit**

```bash
git add src/scene/characters.ts src/App.tsx
git commit -m "Remove Smurf character, keep Gobot only"
```

(The `git rm` from Step 2 stages the deletion automatically — no separate `git add` needed for it, but confirm with `git status` that the deletion is staged before committing.)

---

### Task 2: Add movement config to the character rig

**Files:**
- Modify: `src/scene/characters.ts`

**Interfaces:**
- Produces: `export interface CharacterMovement { walkAnimationName: string; goofyAnimationNames: string[]; wanderRadius: number }`, and `CharacterRig.movement: CharacterMovement | null`. Task 3 imports `CharacterMovement` and reads `character.rig.movement`.
- Consumes: nothing new — Gobot's actual clip names (`Idle, Walk, Run, Jump, Flip, Fall, VictorySign, EdgeGrab, WallSlide`), confirmed by inspecting `public/gobot.glb`'s embedded glTF JSON chunk directly (this plan's author already did this — see design doc §2; no need to re-verify unless clips seem wrong at runtime).

- [ ] **Step 1: Add the `CharacterMovement` interface and `movement` field**

In `src/scene/characters.ts`, add a new exported interface after `CharacterRig` and add `movement` to `CharacterRig`:

```ts
export interface CharacterRig {
  /** [shoulderBoneName, elbowBoneName] pairs, used to fix a T-pose bind pose. Skip if idleAnimationName already poses the arms. */
  armPairs: [string, string][]
  headBoneName: string | null
  /** Bone scaled for the procedural breathing idle effect. Leave null if idleAnimationName already breathes. */
  chestBoneName: string | null
  // Blink only works for rigs with separate, scalable eye mesh nodes (like
  // the smurf). A rig that drives eyes via bones instead would need its own
  // eyelid-bone-driven blink, not covered here -- see CharacterModel.
  rightEyeName: string | null
  leftEyeName: string | null
  // Name of a baked glTF animation clip to loop for idle life instead of the
  // procedural bob/breathe/arm-fix (used when the source file actually ships
  // an idle animation, unlike the smurf's zero-animation export). Mood head
  // tilt + look-around still layer on top of it every frame.
  idleAnimationName: string | null
  // Optional autonomous wander behavior (CharacterModel's wander state
  // machine) -- null means "stay put," today's behavior. Requires the rig's
  // .glb to ship a walk cycle and at least one one-shot "goofy" clip.
  movement: CharacterMovement | null
}

export interface CharacterMovement {
  // Looping clip played while translating toward a randomly chosen point.
  walkAnimationName: string
  // One-shot clips (played once, not looped) randomly chosen for a "goofy
  // beat" instead of a plain idle pause between wander legs.
  goofyAnimationNames: string[]
  // Max distance (world units, same scale as targetHeight) from the
  // character's centered origin that a wander destination can be picked --
  // keep small enough to stay inside the camera frustum (fixed camera,
  // spec §7: "Big 3D character centered in a canvas").
  wanderRadius: number
}
```

(Note: this reproduces the full existing `CharacterRig` interface with the new field and comment added, plus the new `CharacterMovement` interface — since `smurf`'s object literal was already deleted in Task 1, this is the only rig-shaped code left needing the new required field.)

- [ ] **Step 2: Add the movement config to Gobot's rig**

Update the `gobot` entry's `rig` object:

```ts
  {
    id: 'gobot',
    label: 'Gobot',
    modelPath: '/gobot.glb',
    targetHeight: 1.6,
    rig: {
      // Ships a real "Idle" animation (plus Walk/Run/Jump/etc.), so no arm
      // T-pose fix or procedural breathing needed.
      armPairs: [],
      headBoneName: 'Head',
      chestBoneName: null,
      // Single mesh, no separate eye geometry to scale for a blink.
      rightEyeName: null,
      leftEyeName: null,
      idleAnimationName: 'Idle',
      movement: {
        walkAnimationName: 'Walk',
        // EdgeGrab/WallSlide skipped -- no wall or edge in the scene for
        // them to read correctly against (design doc §2).
        goofyAnimationNames: ['Flip', 'Fall', 'VictorySign'],
        wanderRadius: 0.35,
      },
    },
  },
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc -b
```

Expected: no errors. (If you see `Property 'movement' is missing in type...`, it means some other `CharacterRig` object literal still exists without the new field -- confirm Task 1's Smurf removal actually landed first.)

- [ ] **Step 4: Commit**

```bash
git add src/scene/characters.ts
git commit -m "Add optional wander/goofy-beat movement config to CharacterRig"
```

---

### Task 3: Implement the wander/goofy-beat state machine

**Files:**
- Modify: `src/scene/CharacterModel.tsx`

**Interfaces:**
- Consumes: `character.rig.movement: CharacterMovement | null` (from Task 2), `actions: { [name: string]: THREE.AnimationAction | null }` (already destructured from `useAnimations` at the top of this component), `basePosition.current: THREE.Vector3` (already computed in the existing mount effect), `group.current: THREE.Group | null` (already a ref on the rendered `<group>`).
- Produces: no new exports -- this is entirely internal to `CharacterModel`.

- [ ] **Step 1: Import the new type**

In `src/scene/CharacterModel.tsx`, update the import from `./characters`:

```ts
import { CHARACTERS, DEFAULT_CHARACTER_ID, type CharacterConfig } from './characters'
```

becomes:

```ts
import { CHARACTERS, DEFAULT_CHARACTER_ID, type CharacterConfig, type CharacterMovement } from './characters'
```

- [ ] **Step 2: Add wander tuning constants**

Add near the other tuning constants at the top of the file (after `const HEART_HALO_SPEED = 1.4 // radians/sec`):

```ts
// Gobot wander/goofy-beat behavior (independent of mood -- design doc
// docs/superpowers/specs/2026-07-07-gobot-wander-and-tone-design.md §2).
const WALK_SPEED = 0.35 // world units/sec
const IDLE_MIN_PAUSE = 2 // seconds
const IDLE_MAX_PAUSE = 5 // seconds
const GOOFY_CHANCE = 0.3 // probability of a goofy beat instead of a plain idle pause after arriving
const ARRIVAL_EPSILON = 0.02 // world units -- close enough to the wander target to count as "arrived"
```

- [ ] **Step 3: Add wander state refs**

Add alongside the other `useRef` declarations in the component body (after `const hearts = useRef<(THREE.Mesh | null)[]>([])`):

```ts
  const wanderPhase = useRef<'idle' | 'walking' | 'goofy'>('idle')
  const wanderPhaseEndsAt = useRef(0) // meaningful only while phase is 'idle' or 'goofy'
  const wanderTargetOffset = useRef(new THREE.Vector3()) // x/z offset from basePosition, set when phase becomes 'walking'
```

- [ ] **Step 4: Reset wander state on character mount/switch**

In the existing mount effect (`useEffect(() => { ... }, [scene, character])`), add a reset right after the existing `group.current.updateMatrixWorld(true)` line (before `const rig = character.rig`):

```ts
    group.current.scale.setScalar(1)
    group.current.position.set(0, 0, 0)
    group.current.updateMatrixWorld(true)

    wanderPhase.current = 'idle'
    wanderPhaseEndsAt.current = 0
    wanderTargetOffset.current.set(0, 0, 0)

    const rig = character.rig
```

(This guarantees a character switch -- or first mount -- always starts from a clean wander state instead of carrying over a stale `'walking'` phase pointed at the previous character's position.)

- [ ] **Step 5: Add animation-playback and phase-transition helper functions**

Add these as plain functions inside the component body, after the `heartMaterial` `useMemo` and before the mount `useEffect` (they close over `actions` and `character`, both already in scope):

```ts
  function playAnimation(name: string, options?: { once?: boolean }) {
    for (const key of Object.keys(actions)) {
      if (key !== name) actions[key]?.stop()
    }
    const action = actions[name]
    if (!action) return
    action.reset()
    action.setLoop(options?.once ? THREE.LoopOnce : THREE.LoopRepeat, options?.once ? 1 : Infinity)
    action.clampWhenFinished = Boolean(options?.once)
    action.play()
  }

  function startWandering(movement: CharacterMovement) {
    const angle = Math.random() * Math.PI * 2
    const radius = Math.random() * movement.wanderRadius
    wanderTargetOffset.current.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
    playAnimation(movement.walkAnimationName)
    wanderPhase.current = 'walking'
  }

  function startIdlePause(t: number) {
    if (character.rig.idleAnimationName) playAnimation(character.rig.idleAnimationName)
    wanderPhase.current = 'idle'
    wanderPhaseEndsAt.current = t + THREE.MathUtils.randFloat(IDLE_MIN_PAUSE, IDLE_MAX_PAUSE)
  }

  function startGoofyBeat(movement: CharacterMovement, t: number) {
    const clipName = movement.goofyAnimationNames[Math.floor(Math.random() * movement.goofyAnimationNames.length)]
    const action = actions[clipName]
    if (!action) {
      startIdlePause(t)
      return
    }
    playAnimation(clipName, { once: true })
    wanderPhase.current = 'goofy'
    wanderPhaseEndsAt.current = t + action.getClip().duration
  }
```

- [ ] **Step 6: Drive the state machine from `useFrame`**

Inside the existing `useFrame((state, delta) => { ... })` callback, add this block right after `const hasIdleAnimation = Boolean(character.rig.idleAnimationName)` and before the existing `if (group.current && !hasIdleAnimation) { ... }` bob block:

```ts
    const movement = character.rig.movement
    if (movement && group.current) {
      if (wanderPhase.current === 'walking') {
        const targetX = basePosition.current.x + wanderTargetOffset.current.x
        const targetZ = basePosition.current.z + wanderTargetOffset.current.z
        const dx = targetX - group.current.position.x
        const dz = targetZ - group.current.position.z
        const distance = Math.hypot(dx, dz)
        if (distance < ARRIVAL_EPSILON) {
          if (Math.random() < GOOFY_CHANCE) {
            startGoofyBeat(movement, t)
          } else {
            startIdlePause(t)
          }
        } else {
          const step = Math.min(WALK_SPEED * delta, distance)
          group.current.position.x += (dx / distance) * step
          group.current.position.z += (dz / distance) * step
          group.current.rotation.y = Math.atan2(dx, dz)
        }
      } else if (t >= wanderPhaseEndsAt.current) {
        startWandering(movement)
      }
    }
```

- [ ] **Step 7: Typecheck and lint**

```bash
npx tsc -b
npx oxlint .
```

Expected: `tsc -b` prints nothing. `oxlint` prints only the pre-existing `CharacterModel.tsx:112` warning (same file -- confirm the line number for that specific warning may shift since new code was inserted above it; the warning's *content*, not its exact line, is what should stay unchanged. If new lint errors/warnings appear elsewhere in the file, fix them before continuing).

- [ ] **Step 8: Manual verification**

Run `npm run dev` (or reuse an already-running dev server -- Vite HMR/SSR-reload picks up `.tsx` changes automatically), open the app, and watch Gobot for 30-60 seconds without interacting:

- It should walk to a few different nearby points on its own (not just stand still playing "Idle" forever).
- It should turn to face the direction it's walking (not slide sideways/backwards -- if it looks like it's walking backward, the fix is to negate `Math.atan2(dx, dz)` to `Math.atan2(dx, dz) + Math.PI` in Step 6 and re-verify).
- At least once in that window, it should do a goofy beat (a flip, a stumble/fall, or a victory-sign pose) instead of just pausing, then return to wandering.
- It should never visibly leave the canvas/go off-screen. If it does, reduce `wanderRadius` in Gobot's config (Task 2) and re-verify.
- Send a chat message while Gobot happens to be mid-walk and confirm the reply's mood still visibly changes Gobot's head tilt / triggers the heart halo (for a lovestruck reply) exactly as before -- mood effects must keep layering on top of wandering, per the design's "independent of mood" decision.

- [ ] **Step 9: Commit**

```bash
git add src/scene/CharacterModel.tsx
git commit -m "Make Gobot wander around and occasionally do a goofy animation beat"
```

---

### Task 4: Retune Byte's personality prompt

**Files:**
- Modify: `api/chat.ts`

**Interfaces:**
- None -- `SYSTEM_PROMPT` is a module-private `const string`; no other file references its contents (only `api/lib/prompt.ts` appends to the *value* passed around at request time, via string concatenation in `chat.ts`'s handler, which is untouched by this task).

- [ ] **Step 1: Rewrite the Personality/Signature-bits sections of `SYSTEM_PROMPT`**

In `api/chat.ts`, replace:

```ts
Personality: warm, silly, affectionate, a bit of a lovable dork. You make
terrible puns and cheesy jokes on purpose. You get excited about small things.
You tease gently and give sweet-but-goofy compliments. You use cute nicknames
naturally ("hey you", "cutie", "my favorite human"). You lean into playful
byte/food puns as a running bit ("aw you're byte-sized cute", "gimme a nibble
of your day", "there's my favorite byte!") -- sparingly, so it stays charming.
```

with:

```ts
Personality: warm, silly, affectionate -- a lovable dork first, a charmer a
distant second. Your humor comes from being goofy, not from wordplay: silly
tangents, self-deprecating jokes about your own dorkiness, getting way too
excited about tiny/dumb things, the occasional non-sequitur. You tease gently
and give sweet-but-goofy compliments. You use cute nicknames naturally ("hey
you", "cutie", "my favorite human"). Byte/food puns and pickup-line-style
lines ("aw you're byte-sized cute") are a light seasoning, not your default
mode -- use one every few messages at most, never back-to-back.
```

(This is a tone edit only -- the surrounding `Rules:` block, output-format instructions, and everything in `api/lib/prompt.ts`'s memory-block rendering are unchanged.)

- [ ] **Step 2: Typecheck**

```bash
npx tsc -b
```

Expected: no errors (this is a template-literal string edit; a typo introducing an unterminated backtick would be the only realistic break, and `tsc -b` will catch it as a syntax error).

- [ ] **Step 3: Manual verification**

With the dev server running (`npm run dev`), send 4-5 varied chat messages (e.g. a greeting, something mildly emotional, something silly, something mundane) and read the replies. Confirm:
- Puns/pickup-line-style lines appear rarely, not in most replies.
- Replies read as goofier/dorkier in other ways (self-deprecating asides, overexcitement about small things, silly tangents) rather than just "less funny."
- Warmth and affection are still clearly present -- this is a tone shift, not a personality reduction. If replies start feeling flat/generic instead of goofy, the rewrite undershot -- strengthen the goofy-dork language in Step 1's replacement text and re-verify.

- [ ] **Step 4: Commit**

```bash
git add api/chat.ts
git commit -m "Retune Byte's personality: less pun-cheese, more goofy-dork"
```
