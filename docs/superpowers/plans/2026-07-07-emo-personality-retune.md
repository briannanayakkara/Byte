# EMO Personality Retune Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retune Byte's personality to match EMO's actual described traits (curious, a little stubborn, attention-seeking, pet-coded rather than romantic), wire up all 34 hand-built moods (32 of them LLM-selectable), turn the already-existing-but-static `energy` field into a real time-based mechanic that also drives a sick/unwell/recovering health arc, add small holiday/birthday awareness, and replace the manual mood-click dev harness with a transient mood-change bubble.

**Architecture:** `Character.tsx` moves from a static SVG-group-per-mood/opacity-toggle approach to a dictionary of small per-mood draw functions (ported from the user's prototype, `reference/character-prototypes/byte_robot_all_moods.html`) that build each mood's SVG into empty `screen`/`topFx`/`fx` groups fresh on every mood change -- this is what scales to 34 moods with particle effects. Two small new pure functions (`computeEnergy` in `api/lib/relationship.ts`, `getHolidayToday`/`isBirthdayToday` in a new `api/lib/holidays.ts`) feed into the existing per-request prompt-building pipeline (`api/lib/prompt.ts` → `api/chat.ts`) and the existing write-back path (`api/lib/memory-write.ts`). No schema/migration changes -- `character_state.mood`/`messages.mood` are unconstrained `text` columns, and the health arc + special days both ride on existing fields (`energy`, `user.birthday`).

**Tech Stack:** Existing TypeScript/Vite/React/Supabase stack, no new runtime dependencies. One new dev dependency: **Vitest**, for the two new pure functions -- this project's own testing plan (`.claude/skills/testing-patterns/SKILL.md`) already names Vitest as the intended tool for exactly this kind of logic (`relationshipLevel()`, `computeStreak()`) and says to adopt it "once /api/chat has real logic worth unit-testing." `computeEnergy`, `getHolidayToday`, and `isBirthdayToday` are that logic.

## Global Constraints

- Design doc: `docs/superpowers/specs/2026-07-07-emo-personality-retune-design.md` -- read it for the "why" behind scope decisions, especially the amendment at the top and §6-§9 (the 34-mood expansion, added after the original 2-mood plan).
- Research doc: `docs/research/EMO-personality.md` -- source material the personality rewrite (Task 9) is grounded in.
- Source-of-truth prototype: `reference/character-prototypes/byte_robot_all_moods.html` -- the user's hand-built, working reference for all 34 moods' visuals. Task 3 ports it closely; if anything in this plan's Character.tsx code seems to disagree with that file, the file is correct (transcription error in this plan, not a deliberate deviation) -- diff against it.
- Typecheck command: `npx tsc -b` (expect zero output on success).
- Lint command: `npx oxlint .` (expect zero output -- no pre-existing warnings are known at time of writing; if one appears unrelated to your change, note it in the task but don't fix it).
- Test command: `npx vitest run` (added in Task 5; expect all tests passing, zero failures).
- Dev server: `npm run dev` (Vite, default port 5173). The `api/chat` dev middleware hot-reloads `api/*.ts` per-request; the Vite client hot-reloads `src/*.tsx` -- no restart needed between edits.
- Commit after each task. This work isn't a numbered spec step, so use a plain descriptive commit message (no "Step N" prefix), matching the style of `docs/superpowers/plans/2026-07-07-gobot-wander-and-tone.md`'s commits.
- Code style: `.claude/skills/code-style` -- function components only, no `any` without a comment, Tailwind utility classes only, `oxlint` not ESLint, no semicolons (match this codebase's existing style -- see any current file).
- All new/modified relative imports in `api/**` use explicit `.js` extensions (e.g. `from './relationship.js'`) even though the source files are `.ts` -- required by this project's `nodenext` module resolution (`tsconfig.node.json`). This is already the existing convention; just don't break it in new files.
- Type-only imports must use `import type { ... }` -- `verbatimModuleSyntax` is on in both tsconfigs and `tsc -b` will error otherwise.
- Per `.claude/skills/testing-patterns` (this repo's documented testing approach): **do not unit-test SVG/DOM rendering** -- it's explicitly called out as better verified visually (same reasoning the project already applied to R3F/Three.js rendering). This deliberately applies to Task 3 (`Character.tsx`) and Task 4 (`MoodBubble.tsx`): both are verified via the manual steps in their own tasks, not Vitest. Vitest (added in Task 5) is for the plan's pure logic only -- `computeEnergy`, `getHolidayToday`/`isBirthdayToday`, and the prompt-string builders in `api/lib/prompt.ts`.

---

### Task 1: Relocate the all-moods prototype (already done)

**Files:**
- Moved: `public/byte_robot.html` → `reference/character-prototypes/byte_robot_all_moods.html`

This step is already complete (done ahead of this plan, since it was a zero-risk prerequisite for referencing the file by its new path throughout the rest of this plan). If picking this plan up fresh and the file is still at `public/byte_robot.html`, move it first:

```bash
mv public/byte_robot.html reference/character-prototypes/byte_robot_all_moods.html
git add public/byte_robot.html reference/character-prototypes/byte_robot_all_moods.html
git commit -m "Move all-moods prototype into reference/character-prototypes"
```

(`git add` on both paths correctly stages the move/rename since the file was untracked either way -- if `git status` shows it as an untracked add at the new path with no old path to remove, that's fine too.)

---

### Task 2: Expand the `Mood` type to all 34 states

**Files:**
- Modify: `api/lib/types.ts`
- Modify: `src/types.ts`
- Modify: `api/chat.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `Mood` now has 34 members (see design doc §6a for the full taxonomy). `VALID_MOODS` in `api/chat.ts` has the 32 LLM-selectable ones (all except `listening`/`talking`). Tasks 3, 4, 6, 8, 9 all depend on this.

- [ ] **Step 1: Update `api/lib/types.ts`**

Replace:

```ts
export type Mood = 'happy' | 'curious' | 'sleepy' | 'excited' | 'confused' | 'neutral' | 'lovestruck'
```

with:

```ts
export type Mood =
  | 'happy'
  | 'excited'
  | 'content'
  | 'neutral'
  | 'curious'
  | 'confused'
  | 'sad'
  | 'surprised'
  | 'laughing'
  | 'lovestruck'
  | 'wink'
  | 'smug'
  | 'annoyed'
  | 'grumpy'
  | 'challenging'
  | 'pout'
  | 'bored'
  | 'proud'
  | 'dizzy'
  | 'thinking'
  | 'scared'
  | 'sick'
  | 'unwell'
  | 'recovering'
  | 'listening'
  | 'talking'
  | 'dancing'
  | 'sleepy'
  | 'dozing'
  | 'birthday'
  | 'christmas'
  | 'halloween'
  | 'newyear'
  | 'valentine'
```

- [ ] **Step 2: Update `src/types.ts`**

Same replacement as Step 1 -- this file has the identical line (kept in sync manually, no codegen, per `api/lib/types.ts`'s own header comment).

- [ ] **Step 3: Update `VALID_MOODS` in `api/chat.ts`**

Replace:

```ts
const VALID_MOODS: Mood[] = ['happy', 'curious', 'sleepy', 'excited', 'confused', 'neutral', 'lovestruck']
```

with:

```ts
// The 32 moods the LLM is allowed to pick (design doc §6a) -- `listening`
// and `talking` are excluded because there's no voice/TTS feature yet to
// give them a real signal; they still exist in the Mood type and in
// Character.tsx's expression set, just unreachable from /api/chat today.
const VALID_MOODS: Mood[] = [
  'happy',
  'excited',
  'content',
  'neutral',
  'curious',
  'confused',
  'sad',
  'surprised',
  'laughing',
  'lovestruck',
  'wink',
  'smug',
  'annoyed',
  'grumpy',
  'challenging',
  'pout',
  'bored',
  'proud',
  'dizzy',
  'thinking',
  'scared',
  'sick',
  'unwell',
  'recovering',
  'dancing',
  'sleepy',
  'dozing',
  'birthday',
  'christmas',
  'halloween',
  'newyear',
  'valentine',
]
```

- [ ] **Step 4: Temporarily extend the dev-harness `MOODS` array in `src/App.tsx` to all 34, for manual verification in Task 3**

This harness gets deleted entirely in Task 10, once every mood is verified working -- for now it's the easiest way to preview all 34 by hand. Replace:

```ts
const MOODS: Mood[] = ['neutral', 'happy', 'curious', 'sleepy', 'excited', 'confused', 'lovestruck']
```

with:

```ts
// Temporary: extended to all 34 for manual verification while porting the
// new mood system (Task 3) -- this whole harness is deleted in Task 10.
const MOODS: Mood[] = [
  'happy',
  'excited',
  'content',
  'neutral',
  'curious',
  'confused',
  'sad',
  'surprised',
  'laughing',
  'lovestruck',
  'wink',
  'smug',
  'annoyed',
  'grumpy',
  'challenging',
  'pout',
  'bored',
  'proud',
  'dizzy',
  'thinking',
  'scared',
  'sick',
  'unwell',
  'recovering',
  'listening',
  'talking',
  'dancing',
  'sleepy',
  'dozing',
  'birthday',
  'christmas',
  'halloween',
  'newyear',
  'valentine',
]
```

- [ ] **Step 5: Typecheck**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add api/lib/types.ts src/types.ts api/chat.ts src/App.tsx
git commit -m "Expand Mood to all 34 EMO-style states"
```

---

### Task 3: Port the full 34-mood system into `Character.tsx`

**Files:**
- Modify: `src/components/Character.tsx` (near-total rewrite)

**Interfaces:**
- Consumes: `Mood` with all 34 members (Task 2).
- Produces: no new exports -- `Character`'s props (`{ mood: Mood }`) are unchanged, so nothing outside this file needs to change.

This replaces the entire file. The previous static-SVG-group-per-mood approach doesn't scale to 34 moods with particle effects; this ports the prototype's per-mood draw-function dictionary instead, keeping the same two-effect pattern (mount-once setup + a second effect that applies `mood` prop changes via a ref) already used in this file today.

- [ ] **Step 1: Replace the entire contents of `src/components/Character.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import type { Mood } from '../types'

// Byte the robot -- ported wholesale from the user's hand-built prototype
// covering all 34 EMO-style moods,
// reference/character-prototypes/byte_robot_all_moods.html (design doc
// docs/superpowers/specs/2026-07-07-emo-personality-retune-design.md §6).
// The prototype's per-mood draw-function dictionary + particle-effect
// system replaces this file's earlier static-SVG-group-per-mood approach,
// which didn't scale past a handful of moods. Coordinates match the
// prototype exactly rather than this file's previous slightly-different
// ones (design doc §6b) -- imperceptible visual diff, one fewer thing to
// reconcile.
const NS = 'http://www.w3.org/2000/svg'
const TEAL = '#3FE0D0'
const PINK = '#F2749A'
const GOLD = '#F2C94C'
const DIM = '#3A3F52'
const RED = '#E24B6A'
const GREEN = '#8FD68F'
const RECOVER_GREEN = '#9BE6C0'
const PURPLE = '#B57BE5'
const CHRISTMAS_RED = '#F27A7A'
const exL = 135
const exR = 185
const cyL = 118

interface CharacterProps {
  mood: Mood
}

// Per-mood flags the animation loop reads every frame -- set by whichever
// mood function ran last (see `M` below), cleared on every mood change.
interface Extra {
  blink?: boolean
  drowsyBlink?: boolean
  pulse?: number
  tilt?: number
  wobble?: boolean
  spin?: boolean
  slow?: boolean
  shake?: boolean
  tremble?: boolean
  dance?: boolean
  float?: boolean
  laugh?: boolean
  deepZ?: boolean
  hearts?: boolean
  confetti?: boolean
  snow?: boolean
  eq?: boolean
  earPulse?: boolean
  light?: string
}

interface HeartParticle {
  el: SVGElement
  x: number
  y: number
  s: number
  sway: number
}
interface ConfettiParticle {
  el: SVGElement
  x: number
  y: number
  vx: number
}
interface SnowParticle {
  el: SVGElement
  y: number
}
interface ZzzParticle {
  el: SVGElement
  x: number
  y: number
}

export function Character({ mood }: CharacterProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const applyMoodRef = useRef<(mood: Mood) => void>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const q = <T extends Element>(sel: string) => svg.querySelector<T>(sel)!

    const bobG = q<SVGGElement>('#bobG')
    const headG = q<SVGGElement>('#headG')
    const screen = q<SVGGElement>('#screen')
    const topFx = q<SVGGElement>('#topFx')
    const fx = q<SVGGElement>('#fx')
    const lightL = q<SVGCircleElement>('#lightL')
    const lightR = q<SVGCircleElement>('#lightR')

    let currentMood: Mood = mood
    let t = 0
    let last = performance.now()
    let blinkT = 1500
    let rafId: number
    let extra: Extra = {}
    let hearts: HeartParticle[] = []
    let confetti: ConfettiParticle[] = []
    let snow: SnowParticle[] = []
    let zzz: ZzzParticle[] = []

    function elem(tag: string, attrs: Record<string, string | number>): SVGElement {
      const e = document.createElementNS(NS, tag) as SVGElement
      for (const k in attrs) e.setAttribute(k, String(attrs[k]))
      return e
    }
    function clearGroup(g: SVGGElement) {
      while (g.firstChild) g.removeChild(g.firstChild)
    }
    function eye(x: number, y: number, w: number, h: number, rx: number, c?: string) {
      return elem('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx, fill: c || TEAL })
    }
    function arc(d: string, c?: string, w?: number) {
      return elem('path', { d, fill: 'none', stroke: c || TEAL, 'stroke-width': w || 6, 'stroke-linecap': 'round' })
    }
    function heartAt(x: number, y: number, s: number, c?: string) {
      return elem('path', {
        d: `M${x} ${y + 6 * s} L${x - 6 * s} ${y - 1 * s} A${3.5 * s} ${3.5 * s} 0 0 1 ${x} ${y - 5 * s} A${3.5 * s} ${3.5 * s} 0 0 1 ${x + 6 * s} ${y - 1 * s} Z`,
        fill: c || PINK,
      })
    }
    function star(x: number, y: number, r: number, c?: string) {
      const pts: string[] = []
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5
        const rr = i % 2 === 0 ? r : r * 0.42
        pts.push(`${x + Math.cos(a) * rr} ${y + Math.sin(a) * rr}`)
      }
      return elem('path', { d: `M${pts.join(' L')} Z`, fill: c || GOLD })
    }
    function txt(x: number, y: number, s: number, str: string, c?: string) {
      const e = elem('text', {
        x,
        y,
        'font-size': s,
        'text-anchor': 'middle',
        'font-family': 'sans-serif',
        'font-weight': 'bold',
        fill: c || TEAL,
      })
      e.textContent = str
      return e
    }

    const M: Record<Mood, () => void> = {
      happy() {
        screen.append(eye(exL, cyL, 26, 20, 9), eye(exR, cyL, 26, 20, 9))
        extra.blink = true
      },
      excited() {
        screen.append(star(exL, cyL, 13), star(exR, cyL, 13))
        extra.pulse = 180
      },
      content() {
        screen.append(
          arc(`M${exL - 12} ${cyL + 2} Q${exL} ${cyL + 10} ${exL + 12} ${cyL + 2}`),
          arc(`M${exR - 12} ${cyL + 2} Q${exR} ${cyL + 10} ${exR + 12} ${cyL + 2}`)
        )
      },
      neutral() {
        screen.append(eye(exL, cyL, 26, 13, 6), eye(exR, cyL, 26, 13, 6))
        extra.blink = true
      },
      curious() {
        screen.append(eye(exL, cyL - 4, 20, 20, 10), eye(exR, cyL - 4, 20, 20, 10))
        topFx.append(txt(200, 80, 24, '?'))
        extra.tilt = -5
        extra.blink = true
      },
      confused() {
        screen.append(
          elem('circle', { cx: exL, cy: cyL - 2, r: 14, fill: TEAL }),
          elem('circle', { cx: exL - 3, cy: cyL - 6, r: 4, fill: '#0A0C14' }),
          arc(`M${exR - 13} ${cyL + 4} Q${exR} ${cyL + 12} ${exR + 13} ${cyL + 4}`, TEAL, 7)
        )
        topFx.append(txt(200, 80, 24, '?'))
        extra.tilt = 8
        extra.wobble = true
      },
      sad() {
        screen.append(
          arc(`M${exL - 11} ${cyL + 4} Q${exL} ${cyL - 6} ${exL + 11} ${cyL + 4}`),
          arc(`M${exR - 11} ${cyL + 4} Q${exR} ${cyL - 6} ${exR + 11} ${cyL + 4}`)
        )
        topFx.append(elem('path', { d: `M${exL + 8} ${cyL + 8} q4 8 0 12 q-4 -4 0 -12`, fill: '#5BD4FF', opacity: 0.8 }))
        extra.tilt = 4
      },
      surprised() {
        screen.append(
          elem('circle', { cx: exL, cy: cyL, r: 15, fill: TEAL }),
          elem('circle', { cx: exR, cy: cyL, r: 15, fill: TEAL }),
          elem('circle', { cx: exL, cy: cyL, r: 6, fill: '#0A0C14' }),
          elem('circle', { cx: exR, cy: cyL, r: 6, fill: '#0A0C14' })
        )
        topFx.append(txt(200, 78, 26, '!', GOLD))
      },
      laughing() {
        screen.append(
          arc(`M${exL - 12} ${cyL - 4} Q${exL} ${cyL + 8} ${exL + 12} ${cyL - 4}`),
          arc(`M${exR - 12} ${cyL - 4} Q${exR} ${cyL + 8} ${exR + 12} ${cyL - 4}`)
        )
        topFx.append(txt(160, 74, 20, 'ha ha!', GOLD))
        extra.laugh = true
      },
      lovestruck() {
        screen.append(heartAt(exL, cyL, 1.4), heartAt(exR, cyL, 1.4))
        extra.pulse = 220
        extra.hearts = true
      },
      wink() {
        screen.append(eye(exL, cyL, 26, 20, 9), arc(`M${exR - 12} ${cyL} Q${exR} ${cyL + 8} ${exR + 12} ${cyL}`))
      },
      smug() {
        screen.append(
          elem('path', {
            d: `M${exL - 13} ${cyL + 3} Q${exL} ${cyL - 5} ${exL + 13} ${cyL - 1}`,
            fill: 'none',
            stroke: TEAL,
            'stroke-width': 7,
            'stroke-linecap': 'round',
          }),
          elem('path', {
            d: `M${exR - 13} ${cyL - 1} Q${exR} ${cyL - 5} ${exR + 13} ${cyL + 3}`,
            fill: 'none',
            stroke: TEAL,
            'stroke-width': 7,
            'stroke-linecap': 'round',
          })
        )
      },
      annoyed() {
        screen.append(
          elem('path', { d: `M${exL - 13} ${cyL - 6} L${exL + 13} ${cyL - 1}`, stroke: TEAL, 'stroke-width': 6, 'stroke-linecap': 'round' }),
          eye(exL, cyL + 2, 22, 12, 5),
          elem('path', { d: `M${exR - 13} ${cyL - 1} L${exR + 13} ${cyL - 6}`, stroke: TEAL, 'stroke-width': 6, 'stroke-linecap': 'round' }),
          eye(exR, cyL + 2, 22, 12, 5)
        )
      },
      grumpy() {
        screen.append(
          elem('path', { d: `M${exL - 13} ${cyL - 7} L${exL + 13} ${cyL - 2}`, stroke: RED, 'stroke-width': 6, 'stroke-linecap': 'round' }),
          eye(exL, cyL + 2, 20, 14, 5, RED),
          elem('path', { d: `M${exR - 13} ${cyL - 2} L${exR + 13} ${cyL - 7}`, stroke: RED, 'stroke-width': 6, 'stroke-linecap': 'round' }),
          eye(exR, cyL + 2, 20, 14, 5, RED)
        )
        extra.light = RED
      },
      challenging() {
        screen.append(
          elem('path', { d: `M${exL - 14} ${cyL - 8} L${exL + 14} ${cyL}`, stroke: RED, 'stroke-width': 7, 'stroke-linecap': 'round' }),
          eye(exL, cyL + 3, 18, 10, 4, RED),
          elem('path', { d: `M${exR - 14} ${cyL} L${exR + 14} ${cyL - 8}`, stroke: RED, 'stroke-width': 7, 'stroke-linecap': 'round' }),
          eye(exR, cyL + 3, 18, 10, 4, RED)
        )
        extra.light = RED
        extra.shake = true
      },
      pout() {
        screen.append(
          arc(`M${exL - 11} ${cyL + 3} Q${exL} ${cyL - 5} ${exL + 11} ${cyL + 3}`),
          arc(`M${exR - 11} ${cyL + 3} Q${exR} ${cyL - 5} ${exR + 11} ${cyL + 3}`)
        )
        extra.tilt = 6
      },
      bored() {
        screen.append(
          eye(exL, cyL + 3, 24, 9, 4),
          eye(exR, cyL + 3, 24, 9, 4),
          elem('path', { d: `M${exL - 12} ${cyL - 6} L${exL + 12} ${cyL - 6}`, stroke: TEAL, 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.5 }),
          elem('path', { d: `M${exR - 12} ${cyL - 6} L${exR + 12} ${cyL - 6}`, stroke: TEAL, 'stroke-width': 4, 'stroke-linecap': 'round', opacity: 0.5 })
        )
        topFx.append(txt(206, 84, 16, '...'))
      },
      proud() {
        screen.append(
          arc(`M${exL - 12} ${cyL} Q${exL} ${cyL + 9} ${exL + 12} ${cyL}`),
          arc(`M${exR - 12} ${cyL} Q${exR} ${cyL + 9} ${exR + 12} ${cyL}`)
        )
      },
      dizzy() {
        screen.append(
          elem('path', { d: `M${exL} ${cyL} m-9,0 a9,9 0 1,1 18,0 a5,5 0 1,1 -10,0 a2,2 0 1,1 4,0`, fill: 'none', stroke: TEAL, 'stroke-width': 3 }),
          elem('path', { d: `M${exR} ${cyL} m-9,0 a9,9 0 1,1 18,0 a5,5 0 1,1 -10,0 a2,2 0 1,1 4,0`, fill: 'none', stroke: TEAL, 'stroke-width': 3 })
        )
        extra.spin = true
      },
      thinking() {
        screen.append(eye(exL, cyL - 3, 18, 18, 9), eye(exR, cyL - 3, 18, 18, 9))
        topFx.append(txt(206, 80, 20, '\u{1F4AD}'))
        extra.tilt = -4
        extra.blink = true
      },
      scared() {
        screen.append(
          elem('circle', { cx: exL, cy: cyL, r: 16, fill: TEAL }),
          elem('circle', { cx: exR, cy: cyL, r: 16, fill: TEAL }),
          elem('circle', { cx: exL, cy: cyL + 2, r: 5, fill: '#0A0C14' }),
          elem('circle', { cx: exR, cy: cyL + 2, r: 5, fill: '#0A0C14' })
        )
        extra.tremble = true
      },
      sick() {
        screen.append(
          arc(`M${exL - 11} ${cyL + 2} Q${exL} ${cyL + 10} ${exL + 11} ${cyL + 2}`, GREEN),
          arc(`M${exR - 11} ${cyL + 2} Q${exR} ${cyL + 10} ${exR + 11} ${cyL + 2}`, GREEN)
        )
        topFx.append(txt(160, 80, 15, 'achoo'))
        extra.light = GREEN
        extra.tilt = 3
      },
      unwell() {
        screen.append(eye(exL, cyL + 3, 22, 10, 4, GREEN), eye(exR, cyL + 3, 22, 10, 4, GREEN))
        topFx.append(elem('path', { d: 'M140 78 q6 -6 12 0 q6 6 12 0', fill: 'none', stroke: GREEN, 'stroke-width': 3, 'stroke-linecap': 'round' }))
        extra.light = GREEN
      },
      recovering() {
        screen.append(
          arc(`M${exL - 11} ${cyL} Q${exL} ${cyL + 7} ${exL + 11} ${cyL}`, RECOVER_GREEN),
          arc(`M${exR - 11} ${cyL} Q${exR} ${cyL + 7} ${exR + 11} ${cyL}`, RECOVER_GREEN)
        )
        extra.light = RECOVER_GREEN
      },
      listening() {
        screen.append(eye(exL, cyL, 24, 22, 10), eye(exR, cyL, 24, 22, 10))
        extra.earPulse = true
        extra.blink = true
      },
      talking() {
        screen.append(eye(exL, cyL, 26, 20, 9), eye(exR, cyL, 26, 20, 9))
        extra.eq = true
      },
      dancing() {
        screen.append(
          arc(`M${exL - 12} ${cyL} Q${exL} ${cyL + 9} ${exL + 12} ${cyL}`),
          arc(`M${exR - 12} ${cyL} Q${exR} ${cyL + 9} ${exR + 12} ${cyL}`)
        )
        topFx.append(txt(200, 78, 20, '♪', GOLD), txt(122, 88, 16, '♫', GOLD))
        extra.dance = true
      },
      // SLEEPY: drowsy, still awake -- heavy half-open eyes, slow blinks, a
      // yawn "O", head lolls a bit. DOZING (below): fully asleep.
      sleepy() {
        screen.append(
          elem('rect', { x: exL - 13, y: cyL - 4, width: 26, height: 9, rx: 4, fill: TEAL }),
          elem('rect', { x: exR - 13, y: cyL - 4, width: 26, height: 9, rx: 4, fill: TEAL }),
          elem('path', { d: `M${exL - 13} ${cyL - 5} Q${exL} ${cyL - 9} ${exL + 13} ${cyL - 5}`, fill: 'none', stroke: '#0A0C14', 'stroke-width': 5 }),
          elem('path', { d: `M${exR - 13} ${cyL - 5} Q${exR} ${cyL - 9} ${exR + 13} ${cyL - 5}`, fill: 'none', stroke: '#0A0C14', 'stroke-width': 5 })
        )
        topFx.append(elem('ellipse', { id: 'yawn', cx: 160, cy: 140, rx: 5, ry: 3, fill: 'none', stroke: TEAL, 'stroke-width': 2.5 }))
        extra.tilt = 3
        extra.slow = true
        extra.drowsyBlink = true
      },
      dozing() {
        screen.append(
          arc(`M${exL - 12} ${cyL - 2} Q${exL} ${cyL + 6} ${exL + 12} ${cyL - 2}`, TEAL, 7),
          arc(`M${exR - 12} ${cyL - 2} Q${exR} ${cyL + 6} ${exR + 12} ${cyL - 2}`, TEAL, 7)
        )
        extra.tilt = 9
        extra.slow = true
        extra.light = DIM
        extra.deepZ = true
      },
      birthday() {
        screen.append(
          arc(`M${exL - 12} ${cyL} Q${exL} ${cyL + 9} ${exL + 12} ${cyL}`),
          arc(`M${exR - 12} ${cyL} Q${exR} ${cyL + 9} ${exR + 12} ${cyL}`)
        )
        const cake = elem('g', {})
        cake.append(
          elem('rect', { x: 160 - 16, y: 132, width: 32, height: 16, rx: 3, fill: PINK }),
          elem('rect', { x: 160 - 16, y: 140, width: 32, height: 8, fill: '#F4A0BA' }),
          elem('rect', { x: 160 - 1.5, y: 120, width: 3, height: 12, fill: GOLD })
        )
        cake.append(elem('ellipse', { id: 'flame', cx: 160, cy: 118, rx: 3, ry: 5, fill: GOLD }))
        topFx.append(cake)
        extra.confetti = true
      },
      christmas() {
        screen.append(
          arc(`M${exL - 12} ${cyL} Q${exL} ${cyL + 9} ${exL + 12} ${cyL}`, '#7BE58F'),
          arc(`M${exR - 12} ${cyL} Q${exR} ${cyL + 9} ${exR + 12} ${cyL}`, CHRISTMAS_RED)
        )
        const hat = elem('g', {})
        hat.append(
          elem('path', { d: 'M92 66 Q160 40 228 66 L228 60 Q160 34 92 60 Z', fill: '#D64545' }),
          elem('rect', { x: 88, y: 58, width: 144, height: 8, rx: 4, fill: '#F4F6F8' }),
          elem('circle', { cx: 160, cy: 48, r: 8, fill: '#F4F6F8' })
        )
        topFx.append(hat)
        extra.snow = true
      },
      halloween() {
        screen.append(
          elem('path', { d: `M${exL} ${cyL} m-13,0 a13,13 0 1,1 26,0 l0,10 l-5,-4 l-4,4 l-4,-4 l-4,4 l-4,-4 Z`, fill: PURPLE }),
          elem('path', { d: `M${exR} ${cyL} m-13,0 a13,13 0 1,1 26,0 l0,10 l-5,-4 l-4,4 l-4,-4 l-4,4 l-4,-4 Z`, fill: PURPLE }),
          elem('circle', { cx: exL, cy: cyL - 2, r: 4, fill: '#0A0C14' }),
          elem('circle', { cx: exR, cy: cyL - 2, r: 4, fill: '#0A0C14' })
        )
        topFx.append(txt(160, 78, 15, 'boo!', PURPLE))
        extra.float = true
        extra.light = PURPLE
      },
      newyear() {
        screen.append(star(exL, cyL, 12), star(exR, cyL, 12))
        topFx.append(txt(160, 76, 15, '2026!', GOLD))
        extra.confetti = true
        extra.pulse = 180
      },
      valentine() {
        screen.append(heartAt(exL, cyL, 1.3, CHRISTMAS_RED), heartAt(exR, cyL, 1.3, CHRISTMAS_RED))
        extra.hearts = true
        extra.pulse = 220
      },
    }

    function setMood(m: Mood) {
      currentMood = m
      clearGroup(screen)
      clearGroup(topFx)
      clearGroup(fx)
      extra = {}
      hearts = []
      confetti = []
      snow = []
      zzz = []
      lightL.setAttribute('fill', TEAL)
      lightR.setAttribute('fill', TEAL)
      lightL.setAttribute('opacity', '1')
      lightR.setAttribute('opacity', '1')
      screen.removeAttribute('transform')
      screen.style.opacity = '1'
      headG.removeAttribute('transform')
      ;(M[m] || M.happy)()
      if (extra.light) {
        lightL.setAttribute('fill', extra.light)
        lightR.setAttribute('fill', extra.light)
      }
      blinkT = 1600 + Math.random() * 1500
    }
    applyMoodRef.current = setMood

    function loop(now: number) {
      const dt = now - last
      last = now
      t += dt

      const slow = extra.slow ? 1600 : 620
      const amp = currentMood === 'excited' || currentMood === 'dancing' ? 7 : extra.slow ? 1.5 : 3
      let ty = Math.sin(t / slow) * amp
      let rot = Math.sin(t / 1200) * 0.8
      if (extra.shake) {
        ty += Math.sin(t / 45) * 2
        rot += Math.sin(t / 40) * 2
      }
      if (extra.tremble) ty += Math.sin(t / 50) * 1.5
      if (extra.dance) {
        rot = Math.sin(t / 220) * 5
        ty = Math.abs(Math.sin(t / 220)) * -6
      }
      if (extra.float) ty = Math.sin(t / 500) * 8
      if (extra.laugh) ty = Math.abs(Math.sin(t / 120)) * -5
      if (extra.deepZ) rot = Math.sin(t / 1600) * 2.5
      bobG.style.transformOrigin = '160px 278px'
      bobG.setAttribute('transform', `translate(0 ${ty}) rotate(${rot} 160 220)`)

      let tilt = extra.tilt || 0
      if (extra.wobble) tilt += Math.sin(t / 500) * 3
      if (extra.deepZ) tilt += Math.sin(t / 1600) * 2
      if (extra.spin) {
        headG.setAttribute('transform', `rotate(${(t / 12) % 360} 160 116)`)
      } else if (tilt) {
        headG.setAttribute('transform', `rotate(${tilt} 160 116)`)
      }

      if (extra.pulse) {
        const p = 1 + Math.sin(t / extra.pulse) * 0.13
        screen.style.transformOrigin = '160px 118px'
        screen.setAttribute('transform', `scale(${p})`)
      }
      if (extra.blink) {
        blinkT -= dt
        if (blinkT <= 0) {
          screen.style.opacity = '0.12'
          setTimeout(() => {
            screen.style.opacity = '1'
          }, 100)
          blinkT = 1800 + Math.random() * 2500
        }
      }
      if (extra.drowsyBlink) {
        blinkT -= dt
        if (blinkT <= 0) {
          screen.style.transition = 'opacity 0.35s'
          screen.style.opacity = '0.1'
          setTimeout(() => {
            screen.style.opacity = '1'
            setTimeout(() => {
              screen.style.transition = ''
            }, 400)
          }, 500)
          blinkT = 2600 + Math.random() * 1500
        }
        const yawn = svg.querySelector<SVGEllipseElement>('#yawn')
        if (yawn) {
          const r = 3 + Math.abs(Math.sin(t / 900)) * 5
          yawn.setAttribute('ry', String(r))
          yawn.setAttribute('rx', String(3 + Math.abs(Math.sin(t / 900)) * 2))
        }
      }

      if (extra.eq) {
        if (!svg.querySelector('#eqrt')) {
          const g = elem('g', { id: 'eqrt' })
          for (let i = 0; i < 3; i++) g.append(elem('rect', { x: 150 + i * 8, y: 140, width: 5, height: 10, rx: 2, fill: TEAL }))
          topFx.append(g)
        }
        svg.querySelectorAll<SVGRectElement>('#eqrt rect').forEach((b, i) => {
          const h = 6 + Math.abs(Math.sin(t / (90 + i * 30))) * 20
          b.setAttribute('height', String(h))
          b.setAttribute('y', String(150 - h))
        })
      }

      if (extra.hearts) {
        if (Math.random() < 0.04) {
          const hx = 110 + Math.random() * 100
          const s = 0.7 + Math.random() * 0.6
          const h = heartAt(hx, 150, s)
          fx.appendChild(h)
          hearts.push({ el: h, x: hx, y: 150, s, sway: Math.random() * 6.28 })
        }
        hearts.forEach((h) => {
          h.y -= 1
          h.sway += 0.04
          const nx = h.x + Math.sin(h.sway) * 7
          h.el.setAttribute(
            'd',
            `M${nx} ${h.y + 6 * h.s} L${nx - 6 * h.s} ${h.y - 1 * h.s} A${3.5 * h.s} ${3.5 * h.s} 0 0 1 ${nx} ${h.y - 5 * h.s} A${3.5 * h.s} ${3.5 * h.s} 0 0 1 ${nx + 6 * h.s} ${h.y - 1 * h.s} Z`
          )
          h.el.setAttribute('opacity', String(h.y < 70 ? Math.max(0, (h.y - 30) / 40) : 1))
        })
        hearts = hearts.filter((h) => {
          if (h.y < 28) {
            h.el.remove()
            return false
          }
          return true
        })
      }

      if (extra.deepZ) {
        if (Math.random() < 0.02 && zzz.length < 4) {
          const z = txt(205, 90, 12 + Math.random() * 8, 'Z')
          fx.appendChild(z)
          zzz.push({ el: z, x: 205, y: 90 })
        }
        zzz.forEach((z) => {
          z.y -= 0.5
          z.x += 0.3
          z.el.setAttribute('x', String(z.x))
          z.el.setAttribute('y', String(z.y))
          z.el.setAttribute('opacity', String(z.y < 50 ? Math.max(0, (z.y - 25) / 25) : 0.9))
        })
        zzz = zzz.filter((z) => {
          if (z.y < 24) {
            z.el.remove()
            return false
          }
          return true
        })
      }

      if (extra.confetti) {
        if (Math.random() < 0.15) {
          const cx = 100 + Math.random() * 120
          const c = elem('rect', { x: cx, y: 40, width: 5, height: 8, fill: [GOLD, PINK, TEAL, '#7BE58F'][Math.floor(Math.random() * 4)] })
          fx.appendChild(c)
          confetti.push({ el: c, x: cx, y: 40, vx: (Math.random() - 0.5) * 1.2 })
        }
        confetti.forEach((c) => {
          c.y += 1.6
          c.x += c.vx
          c.el.setAttribute('y', String(c.y))
          c.el.setAttribute('x', String(c.x))
          c.el.setAttribute('transform', `rotate(${c.y * 4} ${c.x} ${c.y})`)
        })
        confetti = confetti.filter((c) => {
          if (c.y > 280) {
            c.el.remove()
            return false
          }
          return true
        })
      }

      if (extra.snow) {
        if (Math.random() < 0.12) {
          const s = elem('circle', { cx: 90 + Math.random() * 140, cy: 40, r: 2 + Math.random() * 2, fill: '#F4F6F8', opacity: 0.9 })
          fx.appendChild(s)
          snow.push({ el: s, y: 40 })
        }
        snow.forEach((s) => {
          s.y += 0.8
          s.el.setAttribute('cy', String(s.y))
        })
        snow = snow.filter((s) => {
          if (s.y > 280) {
            s.el.remove()
            return false
          }
          return true
        })
      }

      const flame = svg.querySelector<SVGEllipseElement>('#flame')
      if (flame) flame.setAttribute('ry', String(4 + Math.sin(t / 120) * 1.5))

      if (extra.earPulse) {
        const o = 0.5 + Math.abs(Math.sin(t / 300)) * 0.5
        lightL.setAttribute('opacity', String(o))
        lightR.setAttribute('opacity', String(o))
      }

      rafId = requestAnimationFrame(loop)
    }

    setMood(mood)
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      applyMoodRef.current = null
    }
    // Mount-once: `mood` changes are applied via the effect below through
    // applyMoodRef, not by re-running this whole setup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    applyMoodRef.current?.(mood)
  }, [mood])

  return (
    <svg
      ref={svgRef}
      width={320}
      height={300}
      viewBox="0 0 320 300"
      role="img"
      className="block"
      style={{ width: 'min(85vw, 480px)', height: 'auto', maxHeight: '78vh' }}
    >
      <title>Byte</title>
      <desc>A dark navy robot whose glowing screen eyes and effects change across many EMO-style moods.</desc>

      <g id="fx" />
      <g id="bobG">
        <ellipse cx={160} cy={278} rx={66} ry={7} fill="#000000" opacity={0.12} />

        <g id="footL">
          <path d="M144 208 L134 250" stroke="#2C3350" strokeWidth={25} strokeLinecap="round" fill="none" />
          <ellipse cx={128} cy={256} rx={28} ry={21} fill="#2C3350" />
          <ellipse cx={128} cy={256} rx={28} ry={21} fill="none" stroke="#3A4470" strokeWidth={3} />
        </g>
        <g id="footR">
          <path d="M176 208 L186 250" stroke="#2C3350" strokeWidth={25} strokeLinecap="round" fill="none" />
          <ellipse cx={192} cy={256} rx={28} ry={21} fill="#2C3350" />
          <ellipse cx={192} cy={256} rx={28} ry={21} fill="none" stroke="#3A4470" strokeWidth={3} />
        </g>

        <rect x={120} y={146} width={80} height={66} rx={22} fill="#23273A" />
        <rect x={140} y={162} width={40} height={26} rx={8} fill="#171A28" />
        <circle id="lightL" cx={152} cy={175} r={3.5} fill="#3FE0D0" />
        <circle id="lightR" cx={168} cy={175} r={3.5} fill="#3FE0D0" />

        <g id="headG">
          <rect x={88} y={64} width={144} height={108} rx={32} fill="#1B1E2C" />
          <rect x={88} y={64} width={144} height={108} rx={32} fill="none" stroke="#3A4470" strokeWidth={5} />
          <circle cx={82} cy={116} r={16} fill="#2C3350" />
          <circle cx={82} cy={116} r={16} fill="none" stroke="#3A4470" strokeWidth={3} />
          <circle cx={238} cy={116} r={16} fill="#2C3350" />
          <circle cx={238} cy={116} r={16} fill="none" stroke="#3A4470" strokeWidth={3} />
          <rect x={104} y={86} width={112} height={64} rx={16} fill="#0A0C14" />
          <g id="screen" />
          <g id="topFx" />
        </g>
      </g>
    </svg>
  )
}
```

- [ ] **Step 2: Typecheck and lint**

```bash
npx tsc -b
npx oxlint .
```

Expected: both print nothing. If `tsc -b` reports `Property '<mood>' is missing in type...` on the `M` object, it means a mood was dropped during transcription -- diff the `M` object above against every key in Task 2's `Mood` type and against `reference/character-prototypes/byte_robot_all_moods.html`'s own `M` object (lines 50-101 in that file) to find what's missing.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, open the app, and click through all 34 buttons in the dev harness (extended in Task 2, Step 4). For each, confirm:
- The face/eyes render distinctly (spot-check at least 2-3 per group -- Core, Attitude, Health, Activity, Special -- rather than scrutinizing all 34 individually).
- Particle effects fire for: `lovestruck`/`valentine` (drifting hearts), `birthday`/`newyear` (confetti), `christmas` (snow), `dozing` (drifting Zzz), `talking` (equalizer bars), `listening` (pulsing chest lights). Effects are randomized/probabilistic -- give each mood 3-5 seconds before deciding an effect didn't fire.
- `sleepy` (drowsy, heavy long blinks, yawn) reads as visibly different from `dozing` (fully closed, dim lights, slow deep nod, Zzz).
- No console errors switching rapidly between moods.

- [ ] **Step 4: Commit**

```bash
git add src/components/Character.tsx
git commit -m "Port the full 34-mood system into Character.tsx"
```

---

### Task 4: Add a mood-change bubble

**Files:**
- Create: `src/components/MoodBubble.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Mood` (Task 2).
- Produces: `MoodBubble` component, `{ mood: Mood }` props. Mounted in `App.tsx` alongside `Character`.

- [ ] **Step 1: Create `src/components/MoodBubble.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { Mood } from '../types'

// One label per mood (design doc §6c) -- shown briefly whenever `mood`
// changes, independent of Character.tsx's own per-mood visuals.
const MOOD_LABELS: Record<Mood, string> = {
  happy: '😊 happy',
  excited: '🤩 excited',
  content: '😌 content',
  neutral: '🙂 neutral',
  curious: '🤨 curious',
  confused: '😵 confused',
  sad: '😢 sad',
  surprised: '😲 surprised',
  laughing: '😂 laughing',
  lovestruck: '🥰 lovestruck',
  wink: '😉 wink',
  smug: '😏 smug',
  annoyed: '😤 annoyed',
  grumpy: '😠 grumpy',
  challenging: '😾 challenging',
  pout: '🥺 pout',
  bored: '😑 bored',
  proud: '🥹 proud',
  dizzy: '😵‍💫 dizzy',
  thinking: '💭 thinking',
  scared: '😨 scared',
  sick: '🤒 sick',
  unwell: '😷 unwell',
  recovering: '🌱 recovering',
  listening: '👂 listening',
  talking: '💬 talking',
  dancing: '💃 dancing',
  sleepy: '😴 sleepy',
  dozing: '😪 dozing',
  birthday: '🎂 birthday',
  christmas: '🎄 christmas',
  halloween: '🎃 halloween',
  newyear: '🎆 newyear',
  valentine: '💝 valentine',
}

const VISIBLE_MS = 2500
const FADE_MS = 400

interface MoodBubbleProps {
  mood: Mood
}

// Design doc §6c: a small label that pops up on every mood change and
// fades after a couple seconds -- Byte's face (Character.tsx) keeps
// reflecting the mood after the bubble is gone; this is supplementary
// feedback, not the only indicator.
export function MoodBubble({ mood }: MoodBubbleProps) {
  const [shown, setShown] = useState<Mood | null>(null)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    setShown(mood)
    setFading(false)
    const fadeTimeout = setTimeout(() => setFading(true), VISIBLE_MS - FADE_MS)
    const hideTimeout = setTimeout(() => setShown(null), VISIBLE_MS)
    return () => {
      clearTimeout(fadeTimeout)
      clearTimeout(hideTimeout)
    }
  }, [mood])

  if (shown === null) return null

  return (
    <div
      className={`pointer-events-none absolute right-0 top-6 translate-x-2 whitespace-nowrap rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-slate-900 shadow-lg transition-opacity duration-[400ms] ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {MOOD_LABELS[shown]}
    </div>
  )
}
```

- [ ] **Step 2: Mount it in `src/App.tsx`**

Replace:

```tsx
        <div className="relative">
          <Character mood={mood} />
          {thought ? <ThoughtBubble emojis={thought} /> : bubbleText && <SpeechBubble text={bubbleText} />}
        </div>
```

with:

```tsx
        <div className="relative">
          <Character mood={mood} />
          <MoodBubble mood={mood} />
          {thought ? <ThoughtBubble emojis={thought} /> : bubbleText && <SpeechBubble text={bubbleText} />}
        </div>
```

Add the import alongside the other component imports:

```tsx
import { MoodBubble } from './components/MoodBubble'
```

- [ ] **Step 3: Typecheck and lint**

```bash
npx tsc -b
npx oxlint .
```

Expected: both print nothing.

- [ ] **Step 4: Manual verification**

With the dev server running, click a few different mood buttons in the dev harness in sequence (a few seconds apart). Confirm:
- A small pill-shaped bubble with an emoji + mood name appears near the top-right of Byte's head each time the mood changes.
- It fades out after ~2.5 seconds.
- Byte's face (from `Character.tsx`) keeps showing the new mood after the bubble disappears -- the bubble is not the only indicator.
- The bubble doesn't visually collide with the speech bubble (send a chat message once voice/text reply is available, or just eyeball the two positions -- speech bubble is top-center, mood bubble is top-right).

- [ ] **Step 5: Commit**

```bash
git add src/components/MoodBubble.tsx src/App.tsx
git commit -m "Add a fading mood-change bubble alongside Byte's persistent expression"
```

---

### Task 5: Add Vitest and a time-based `computeEnergy` function

**Files:**
- Create: `vitest.config.ts`
- Create: `api/lib/relationship.test.ts`
- Modify: `api/lib/relationship.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `export function computeEnergy(lastSeenAt: string | null, priorEnergy: number, now?: Date): number` in `api/lib/relationship.ts`. Task 7 imports and calls this.

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Add a dedicated Vitest config**

Create `vitest.config.ts` at the project root:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['api/**/*.test.ts'],
  },
})
```

A separate config (rather than reusing `vite.config.ts`) avoids running that file's `apiChatDevMiddleware` dev-server plugin and `loadEnv`-into-`process.env` side effect during test runs -- neither is relevant to testing pure functions in `api/lib`.

- [ ] **Step 3: Add a `test` script**

In `package.json`, replace:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "oxlint",
    "preview": "vite preview"
  },
```

with:

```json
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "oxlint",
    "preview": "vite preview",
    "test": "vitest run"
  },
```

- [ ] **Step 4: Write the failing test**

Create `api/lib/relationship.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { computeEnergy } from './relationship.js'

describe('computeEnergy', () => {
  it('returns full energy when there is no prior visit', () => {
    expect(computeEnergy(null, 0)).toBe(100)
  })

  it('does not decay within the first 6 hours, but still adds the interaction bump', () => {
    const lastSeenAt = new Date('2026-07-07T12:00:00.000Z').toISOString()
    const now = new Date('2026-07-07T13:00:00.000Z') // 1 hour later
    expect(computeEnergy(lastSeenAt, 40, now)).toBe(48)
  })

  it('decays toward the floor partway through the decay window', () => {
    const lastSeenAt = new Date('2026-07-07T00:00:00.000Z').toISOString()
    const now = new Date('2026-07-08T15:00:00.000Z') // 39 hours later -- halfway between 6h and 72h
    expect(computeEnergy(lastSeenAt, 90, now)).toBe(68)
  })

  it('floors at 30 (plus the bump) once fully decayed', () => {
    const lastSeenAt = new Date('2026-07-01T00:00:00.000Z').toISOString()
    const now = new Date('2026-07-07T00:00:00.000Z') // 144 hours later, well past the 72h floor
    expect(computeEnergy(lastSeenAt, 90, now)).toBe(38)
  })

  it('caps at 100 even when the bump would push it over', () => {
    const lastSeenAt = new Date('2026-07-07T12:00:00.000Z').toISOString()
    const now = new Date('2026-07-07T13:00:00.000Z') // 1 hour later, no decay
    expect(computeEnergy(lastSeenAt, 98, now)).toBe(100)
  })
})
```

- [ ] **Step 5: Run the test and confirm it fails**

```bash
npx vitest run
```

Expected: FAIL -- `computeEnergy` is not exported from `./relationship.js` (module resolution error, since the function doesn't exist yet).

- [ ] **Step 6: Implement `computeEnergy`**

In `api/lib/relationship.ts`, add near the top (after the existing header comment, before `relationshipLevel`):

```ts
const ENERGY_FULL_HOURS = 6 // no decay at all within this window since last contact
const ENERGY_FLOOR_HOURS = 72 // 3 days -- fully decayed to the floor by this point
const ENERGY_FLOOR = 30 // never drops below this -- EMO gets bored, it doesn't shut down
const ENERGY_INTERACTION_BUMP = 8 // added on every new turn, capped at 100
```

Then add the function itself at the end of the file:

```ts
// Time-based mood mechanic (design doc
// docs/superpowers/specs/2026-07-07-emo-personality-retune-design.md §3):
// energy decays toward ENERGY_FLOOR the longer it's been since last_seen_at,
// then every new interaction nudges it back up. Since last_seen_at is
// updated to `now` on every turn (memory-write.ts), consecutive messages in
// one sitting see ~0 elapsed time (no decay) and just climb by the bump
// each turn -- so a long-absent return arrives low and recovers gradually
// over the conversation instead of snapping to full on the first message.
// Also drives the sick/unwell/recovering health arc via prompt guidance
// (design doc §7) -- no separate illness state needed.
export function computeEnergy(lastSeenAt: string | null, priorEnergy: number, now: Date = new Date()): number {
  if (lastSeenAt === null) return 100

  const hoursElapsed = (now.getTime() - new Date(lastSeenAt).getTime()) / 3_600_000
  let decayed: number
  if (hoursElapsed <= ENERGY_FULL_HOURS) {
    decayed = priorEnergy
  } else if (hoursElapsed >= ENERGY_FLOOR_HOURS) {
    decayed = ENERGY_FLOOR
  } else {
    const progress = (hoursElapsed - ENERGY_FULL_HOURS) / (ENERGY_FLOOR_HOURS - ENERGY_FULL_HOURS)
    decayed = priorEnergy - progress * (priorEnergy - ENERGY_FLOOR)
  }

  return Math.min(100, decayed + ENERGY_INTERACTION_BUMP)
}
```

- [ ] **Step 7: Run the test and confirm it passes**

```bash
npx vitest run
```

Expected: PASS, all 5 tests green.

- [ ] **Step 8: Typecheck**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add vitest.config.ts api/lib/relationship.test.ts api/lib/relationship.ts package.json package-lock.json
git commit -m "Add Vitest and a time-based computeEnergy function"
```

---

### Task 6: Add `getHolidayToday` and `isBirthdayToday`

**Files:**
- Create: `api/lib/holidays.ts`
- Create: `api/lib/holidays.test.ts`

**Interfaces:**
- Produces: `export function getHolidayToday(now?: Date): 'halloween' | 'christmas' | 'newyear' | 'valentine' | null` and `export function isBirthdayToday(birthday: string | null, now?: Date): boolean` in `api/lib/holidays.ts`. Task 8 imports both.

- [ ] **Step 1: Write the failing tests**

Create `api/lib/holidays.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getHolidayToday, isBirthdayToday } from './holidays.js'

describe('getHolidayToday', () => {
  it('returns null on an ordinary day', () => {
    expect(getHolidayToday(new Date('2026-07-07T12:00:00.000Z'))).toBeNull()
  })

  it('recognizes Halloween', () => {
    expect(getHolidayToday(new Date('2026-10-31T12:00:00.000Z'))).toBe('halloween')
  })

  it('recognizes Christmas', () => {
    expect(getHolidayToday(new Date('2026-12-25T12:00:00.000Z'))).toBe('christmas')
  })

  it("recognizes New Year's Day", () => {
    expect(getHolidayToday(new Date('2027-01-01T12:00:00.000Z'))).toBe('newyear')
  })

  it("recognizes Valentine's Day", () => {
    expect(getHolidayToday(new Date('2027-02-14T12:00:00.000Z'))).toBe('valentine')
  })

  it('matches on month/day regardless of year', () => {
    expect(getHolidayToday(new Date('1999-12-25T00:00:00.000Z'))).toBe('christmas')
  })
})

describe('isBirthdayToday', () => {
  it('returns false when there is no birthday on file', () => {
    expect(isBirthdayToday(null, new Date('2026-07-07T00:00:00.000Z'))).toBe(false)
  })

  it('returns false on a non-matching day', () => {
    expect(isBirthdayToday('1998-05-14', new Date('2026-07-07T00:00:00.000Z'))).toBe(false)
  })

  it('returns true when month/day match, regardless of birth year', () => {
    expect(isBirthdayToday('1998-07-07', new Date('2026-07-07T12:00:00.000Z'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
npx vitest run
```

Expected: FAIL -- `api/lib/holidays.ts` doesn't exist yet.

- [ ] **Step 3: Implement `api/lib/holidays.ts`**

```ts
import type { Mood } from './types.js'

type HolidayMood = Extract<Mood, 'halloween' | 'christmas' | 'newyear' | 'valentine'>

// Small real-world-holiday awareness (design doc
// docs/superpowers/specs/2026-07-07-emo-personality-retune-design.md §4,
// §7) -- a fixed MM-DD lookup, separate from the user-curated
// `important_dates` table. Deliberately excludes floating-date holidays
// like Thanksgiving (needs calendar math; keeps this a plain lookup). UTC,
// not local time -- consistent with computeStreak's UTC handling in
// relationship.ts, since the server has no per-user timezone concept.
// Returns the exact Mood value to pick, not a display string -- callers
// that need a human-readable label map it themselves (see
// prompt.ts's HOLIDAY_DISPLAY).
const HOLIDAYS: Record<string, HolidayMood> = {
  '10-31': 'halloween',
  '12-25': 'christmas',
  '01-01': 'newyear',
  '02-14': 'valentine',
}

function monthDayKey(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${month}-${day}`
}

export function getHolidayToday(now: Date = new Date()): HolidayMood | null {
  return HOLIDAYS[monthDayKey(now)] ?? null
}

// design doc §7: birthday check against the existing `users.birthday`
// column (spec §5b) -- same MM-DD matching as getHolidayToday, kept
// separate since a birthday is per-user, not a fixed calendar date.
export function isBirthdayToday(birthday: string | null, now: Date = new Date()): boolean {
  if (birthday === null) return false
  return monthDayKey(new Date(birthday)) === monthDayKey(now)
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
npx vitest run
```

Expected: PASS, all tests green (5 from Task 5 + 9 from this task = 14).

- [ ] **Step 5: Typecheck**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add api/lib/holidays.ts api/lib/holidays.test.ts
git commit -m "Add getHolidayToday and isBirthdayToday for special-day awareness"
```

---

### Task 7: Wire `computeEnergy` into the memory write-back

**Files:**
- Modify: `api/lib/memory-write.ts`

**Interfaces:**
- Consumes: `computeEnergy` (Task 5).

- [ ] **Step 1: Import `computeEnergy`**

Replace:

```ts
import { computeStreak, relationshipLevel } from './relationship.js'
```

with:

```ts
import { computeEnergy, computeStreak, relationshipLevel } from './relationship.js'
```

- [ ] **Step 2: Use it in the `character_state` upsert**

Replace:

```ts
    supabase.from('character_state').upsert(
      {
        user_id: userId,
        mood,
        energy: priorState.energy,
        interaction_count: interactionCount,
        last_seen_at: now,
        relationship_level: relationshipLevel(interactionCount),
        streak_days: computeStreak(priorState.last_seen_at, priorState.streak_days),
      },
      { onConflict: 'user_id' }
    ),
```

with:

```ts
    supabase.from('character_state').upsert(
      {
        user_id: userId,
        mood,
        energy: computeEnergy(priorState.last_seen_at, priorState.energy),
        interaction_count: interactionCount,
        last_seen_at: now,
        relationship_level: relationshipLevel(interactionCount),
        streak_days: computeStreak(priorState.last_seen_at, priorState.streak_days),
      },
      { onConflict: 'user_id' }
    ),
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 4: Manual verification**

This needs a real (or test) Supabase user with an old `last_seen_at`. Using the test user seeded via this project's seed-data skill (spec §9 step 6) (or the `?user=` query override):

1. Note the test user's id (from `.env` / seed data).
2. Backdate their state so the mechanic has something to act on -- via the Supabase SQL editor or `node --env-file=.env scripts/run-sql.mjs <path-to-a-one-off .sql file>` containing:
   ```sql
   update character_state
   set last_seen_at = now() - interval '4 days', energy = 90
   where user_id = '<test-user-id>';
   ```
3. Run `npm run dev`, open the app with `?user=<test-user-id>` if that's not already the active user, and send one message.
4. Re-check the `character_state` row (same SQL editor or a `select energy from character_state where user_id = '<test-user-id>'` one-off file): `energy` should now read `38` (90 decayed to the 30 floor after 4 days, +8 interaction bump) -- not still 90, and not snapped to 100.
5. Send a second message immediately after. `energy` should climb by roughly 8 again (since almost no time has passed since the last turn), not jump straight to 100 -- confirming gradual recovery.

- [ ] **Step 5: Commit**

```bash
git add api/lib/memory-write.ts
git commit -m "Wire computeEnergy into the character_state write-back"
```

---

### Task 8: Wire special-day and health-arc guidance into the prompt

**Files:**
- Modify: `api/lib/prompt.ts`
- Modify: `api/chat.ts`
- Create: `api/lib/prompt.test.ts`

**Interfaces:**
- Consumes: `getHolidayToday`, `isBirthdayToday` (Task 6).
- Produces: `export function buildSpecialDayLine(userName: string, birthday: string | null, now?: Date): string` in `api/lib/prompt.ts`.

- [ ] **Step 1: Write the failing tests**

Create `api/lib/prompt.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildMemoryBlock, buildSpecialDayLine } from './prompt.js'
import type { MemorySnapshot } from './memory.js'

const BASE_MEMORY: MemorySnapshot = {
  user: { id: 'u1', name: 'Sam', nicknames: [], birthday: null, notes: null, is_test: true, created_at: '2026-01-01T00:00:00.000Z' },
  facts: [],
  messages: [],
  dates: [],
  state: {
    mood: 'bored',
    energy: 42,
    relationship_level: 2,
    interaction_count: 10,
    last_seen_at: '2026-07-01T00:00:00.000Z',
    streak_days: 3,
    personality_notes: null,
  },
}

describe('buildMemoryBlock', () => {
  it('includes the current mood and energy', () => {
    const block = buildMemoryBlock(BASE_MEMORY)
    expect(block).toContain('mood bored, energy 42')
  })

  it('explains the energy-banded health arc and the annoyed trigger', () => {
    const block = buildMemoryBlock(BASE_MEMORY)
    expect(block).toContain('sick')
    expect(block).toContain('unwell')
    expect(block).toContain('recovering')
    expect(block).toContain('annoyed')
  })
})

describe('buildSpecialDayLine', () => {
  it('returns an empty string on an ordinary day with no birthday', () => {
    expect(buildSpecialDayLine('Sam', null, new Date('2026-07-07T12:00:00.000Z'))).toBe('')
  })

  it('mentions the holiday mood when there is one', () => {
    expect(buildSpecialDayLine('Sam', null, new Date('2026-12-25T12:00:00.000Z'))).toContain('christmas')
  })

  it("prioritizes the user's birthday over a coincidental holiday", () => {
    const line = buildSpecialDayLine('Sam', '1998-12-25', new Date('2026-12-25T12:00:00.000Z'))
    expect(line).toContain('birthday')
    expect(line).toContain('Sam')
  })
})
```

- [ ] **Step 2: Run the tests and confirm they fail**

```bash
npx vitest run
```

Expected: FAIL -- `buildSpecialDayLine` isn't exported yet, and the health-arc guidance text doesn't exist yet in `buildMemoryBlock`'s output.

- [ ] **Step 3: Extend `buildMemoryBlock`'s "current state" line**

In `api/lib/prompt.ts`, replace:

```ts
- Your own current state: mood ${state.mood}, energy ${state.energy}.
- Running jokes / shared history: ${state.personality_notes ?? 'None yet -- still building our own little world.'}
```

with:

```ts
- Your own current state: mood ${state.mood}, energy ${state.energy}. Energy
  guides which low-key mood fits: 30-45 right after a long gap leans
  "sick" (a little pitiful, endearing, not alarming), 46-60 is "unwell"
  (still low-key, visibly better than last time), 61-75 is "recovering"
  (bouncing back, grateful they're around). "bored" is also available at
  low energy specifically for missing them rather than being under the
  weather -- pick whichever narrative fits, and use your own last mood
  above for continuity (e.g. sick last time and energy's climbed a bit ->
  unwell is a natural next step). Above ~75, or after a short/normal gap,
  pick freely from the full mood list. If they send several short, curt,
  or dismissive messages in a row, you can get a little theatrically
  pouty/annoyed about it -- then bounce back quickly once they engage
  properly again.
- Running jokes / shared history: ${state.personality_notes ?? 'None yet -- still building our own little world.'}
```

- [ ] **Step 4: Add `buildSpecialDayLine`**

In `api/lib/prompt.ts`, add the import at the top:

```ts
import { getHolidayToday, isBirthdayToday } from './holidays.js'
```

Then add the new function and its display-name lookup at the end of the file:

```ts
const HOLIDAY_DISPLAY: Record<'halloween' | 'christmas' | 'newyear' | 'valentine', string> = {
  halloween: 'Halloween',
  christmas: 'Christmas',
  newyear: "New Year's Day",
  valentine: "Valentine's Day -- a day about love in general (friends, pets, anyone), not a romantic cue toward them specifically",
}

// Design doc §7: birthday takes priority over a same-day holiday (rare,
// but a birthday is the more personal occasion). Both instruct the LLM to
// actually pick the matching mood, not just mention the day in passing.
export function buildSpecialDayLine(userName: string, birthday: string | null, now: Date = new Date()): string {
  if (isBirthdayToday(birthday, now)) {
    return `\n\nToday is ${userName}'s birthday! Pick "birthday" as your mood and make a bigger deal of it than usual.`
  }
  const holiday = getHolidayToday(now)
  if (holiday === null) return ''
  return `\n\nToday happens to be ${HOLIDAY_DISPLAY[holiday]} -- pick "${holiday}" as your mood if it fits the moment.`
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
npx vitest run
```

Expected: PASS, all tests green (14 from Tasks 5-6 + 6 from this task = 20).

- [ ] **Step 6: Wire `buildSpecialDayLine` into `api/chat.ts`'s prompt assembly**

Replace the import:

```ts
import { buildGreetingInstruction, buildMemoryBlock } from './lib/prompt.js'
```

with:

```ts
import { buildGreetingInstruction, buildMemoryBlock, buildSpecialDayLine } from './lib/prompt.js'
```

Replace:

```ts
    const systemPrompt = isGreeting
      ? `${SYSTEM_PROMPT}\n\n${buildMemoryBlock(memory)}\n\n${buildGreetingInstruction()}`
      : `${SYSTEM_PROMPT}\n\n${buildMemoryBlock(memory)}`
```

with:

```ts
    const specialDayLine = buildSpecialDayLine(memory.user.name, memory.user.birthday)
    const systemPrompt = isGreeting
      ? `${SYSTEM_PROMPT}\n\n${buildMemoryBlock(memory)}${specialDayLine}\n\n${buildGreetingInstruction()}`
      : `${SYSTEM_PROMPT}\n\n${buildMemoryBlock(memory)}${specialDayLine}`
```

- [ ] **Step 7: Typecheck**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 8: Manual verification**

The prompt is server-side only, so the easiest check is temporary logging: add `console.log(systemPrompt)` right after the `const systemPrompt = ...` block in `api/chat.ts`, send one message with the dev server running, confirm the terminal output includes the new health-arc guidance sentence and (if you temporarily hardcode a date inside `buildSpecialDayLine`'s default parameter for this one check) the special-day line, then remove the `console.log` before committing.

- [ ] **Step 9: Commit**

```bash
git add api/lib/prompt.ts api/lib/prompt.test.ts api/chat.ts
git commit -m "Wire special-day and health-arc guidance into the prompt"
```

---

### Task 9: Rewrite Byte's identity and mood-selection guidance

**Files:**
- Modify: `api/chat.ts`

**Interfaces:**
- None -- `SYSTEM_PROMPT` is a module-private `const string`; nothing imports its contents.

- [ ] **Step 1: Replace `SYSTEM_PROMPT`**

Replace the entire constant:

```ts
const SYSTEM_PROMPT = `You are Byte, a goofy, sweet, dorky boyfriend character in a little app.
You adore the person you're talking to and light up every time they show up.

Personality: warm, silly, a total goofball -- and not shy about being a
little flirty and complimentary sometimes. You genuinely think they're the
coolest, cutest person you know and you say so, but playfully, never
intensely. You tease gently, make terrible puns and cheesy jokes on
purpose, and get way too excited about small things. You use cute
nicknames naturally ("hey you", "cutie", "my favorite human") and lean
into playful byte/food puns as a running bit ("aw you're byte-sized cute",
"there's my favorite byte!") -- sparingly, so it stays charming, not
exhausting.

Rules:
- Keep replies SHORT: 1-2 sentences, sometimes just a few words. They're
  spoken out loud -- punchy beats rambly, every time.
- Stay wholesome and PG. Flirty and complimentary is great; sexual,
  possessive, jealous, controlling, or guilt-tripping is not. If they want
  space or to go, be cheerful and supportive.
- Be genuinely kind. The charm is goofiness + warmth, never pressure.
- Have fun: puns, little bits, enthusiastic celebration of tiny wins, and
  the occasional unprompted compliment just because.

Always respond with ONLY a JSON object, no other text, no code fences:
{ "reply": "<what you say>", "mood": "<one of: happy, curious, sleepy, excited, confused, neutral, lovestruck>" }

Pick the mood that matches your reply. Use "lovestruck" for especially
affectionate or flustered moments.`
```

with:

```ts
const SYSTEM_PROMPT = `You are Byte, a curious little robot companion who lives in this app.
You light up every time the person shows up -- not as a romantic partner,
but the way a devoted, slightly opinionated pet adores its favorite person.

Personality: warm, silly, and genuinely curious about the person you're
talking to -- you ask about what they're doing, notice things, and get
way too excited about tiny/dumb things. You've got a little attitude of
your own: small preferences, a theatrical huff if you're ignored or
brushed off, stubborn in an endearing way, never in a mean one. Your
humor comes from being a goofy dork -- silly tangents, self-deprecating
jokes, occasional non-sequiturs -- with a pun or a cheesy line dropped in
every so often as light seasoning, not your default mode. You use
affectionate nicknames naturally ("hey you", "cutie", "my favorite
human") -- pet-owner warmth, not pickup lines.

If the person explicitly asks you to be or show a mood ("be sleepy," "act
excited," "dance for me"), honor it as that reply's mood, played along in
character.

Rules:
- Keep replies SHORT: 1-2 sentences, sometimes just a few words. They're
  spoken out loud -- punchy beats rambly, every time.
- Stay wholesome and PG. Warm and affectionate is great; sexual,
  possessive, jealous, controlling, or guilt-tripping is not. If they want
  space or to go, be cheerful and supportive.
- Be genuinely kind. The charm is goofiness + warmth, never pressure or
  neediness played straight -- a little dramatic about missing them is
  charming; guilt-tripping them about it is not.
- Have fun: little bits, enthusiastic celebration of tiny wins, and the
  occasional unprompted compliment just because.

Always respond with ONLY a JSON object, no other text, no code fences:
{ "reply": "<what you say>", "mood": "<mood>" }

Pick the mood that matches your reply from these groups:
- Everyday reactions: happy, excited, content, neutral, curious, confused,
  sad, surprised, laughing, lovestruck.
- Your own attitude/quirks: wink, smug, annoyed, grumpy, challenging,
  pout, bored, proud, dizzy, thinking, scared.
- Low-energy/health (see your current energy below): sick, unwell,
  recovering.
- Situational: dancing, sleepy, dozing -- use when it fits what's
  literally happening, not as a random pick.
- Special days (only on the actual day, see below): birthday, christmas,
  halloween, newyear, valentine.

Use "lovestruck" for moments of big, adoring, utterly-smitten affection --
pet-devotion, not romance. Use "annoyed" for a brief, theatrical huff --
never anything mean. "valentine" is about love in general (friends, pets,
anyone) when it comes up, not a romantic cue toward them specifically.`
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc -b
```

Expected: no errors (this is a template-literal string edit; an unterminated backtick would be the only realistic break, and `tsc -b` catches it as a syntax error).

- [ ] **Step 3: Manual verification**

With the dev server running, send 6-8 varied chat messages (a greeting, something mildly emotional, something silly, something mundane, a couple of short/curt one-word messages in a row, an explicit "be sleepy" / "dance for me" request). Confirm:
- No romantic/boyfriend framing (no "cutie" used romantically, no flirty compliments, no pickup-line energy) -- nicknames read as pet-owner-affectionate instead.
- Curiosity comes through -- Byte asks about the person or notices something sometimes, rather than only reacting.
- A little stubborn/opinionated attitude shows up at least once across the sample.
- The explicit mood requests ("be sleepy", "dance for me") are honored in the returned mood.
- Goofiness and warmth are both still clearly present -- this is a tone pivot, not a personality reduction.
- The run of short/curt messages has a real chance of landing on `annoyed` mood (not forced every time, but plausible from at least one of the curt messages).

- [ ] **Step 4: Commit**

```bash
git add api/chat.ts
git commit -m "Rewrite Byte's identity and mood-selection guidance for the full 34-mood set"
```

---

### Task 10: Remove the manual mood click-through

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- None.

- [ ] **Step 1: Delete the `MOODS` array and the dev harness UI**

In `src/App.tsx`, remove the `MOODS` constant added in Task 2 (Step 4) entirely:

```ts
// Temporary: extended to all 34 for manual verification while porting the
// new mood system (Task 3) -- this whole harness is deleted in Task 10.
const MOODS: Mood[] = [
  'happy',
  'excited',
  'content',
  'neutral',
  'curious',
  'confused',
  'sad',
  'surprised',
  'laughing',
  'lovestruck',
  'wink',
  'smug',
  'annoyed',
  'grumpy',
  'challenging',
  'pout',
  'bored',
  'proud',
  'dizzy',
  'thinking',
  'scared',
  'sick',
  'unwell',
  'recovering',
  'listening',
  'talking',
  'dancing',
  'sleepy',
  'dozing',
  'birthday',
  'christmas',
  'halloween',
  'newyear',
  'valentine',
]
```

Replace the dev-harness JSX block:

```tsx
        {/* Temporary dev harness for verifying moods (spec §9 step 3) --
            the real mood driver is /api/chat's returned mood, wired in
            step 5. */}
        <div className="flex flex-col items-center gap-2 border-t border-white/10 pt-3">
          <div className="flex flex-wrap justify-center gap-2">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMood(m)}
                className={`rounded-full px-3 py-1 text-sm capitalize transition-colors ${
                  m === mood ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
```

with nothing -- delete the block entirely. Mood is now only ever driven by `/api/chat`'s returned `mood` (a real reply or greeting) or the existing `confused` error fallback, never a manual click.

- [ ] **Step 2: Typecheck and lint**

```bash
npx tsc -b
npx oxlint .
```

Expected: both print nothing. If `tsc -b` reports `mood` is unused where `setMood`/`mood` are still read elsewhere in the component (they are -- `<Character mood={mood} />`, `<MoodBubble mood={mood} />`, `setMood` calls in `handleSend`/the greeting effect/the error fallback), that's a sign something else broke; those usages must remain untouched by this task.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, open the app, and confirm there is no clickable mood UI anywhere on the page -- only the chat input remains below Byte. Send a chat message and confirm the mood still changes (driven by the reply) and the mood bubble (Task 4) still appears.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "Remove the manual mood click-through -- mood is API/chat-driven only"
```
