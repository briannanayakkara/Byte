# Byte v3 Character Rig + Cross-Device Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade Byte's character rig to the user's hand-built v3 prototype (floaty hands, procedural leg IK, 12 new full-body "Moves") behind a global `window.Byte` API instead of a React prop, expand the LLM's mood vocabulary to include the new moves, and close the gap that made Byte's mood/energy reset between devices instead of persisting continuously in Supabase.

**Architecture:** `Character.tsx` becomes a mount-once, no-props component that owns a `requestAnimationFrame` loop and assigns `window.Byte = { set, list }`; `set()` drives the pose and dispatches a `window` custom event (`byte:change`) that `MoodBubble` subscribes to instead of taking a prop. `App.tsx` drops its `mood` state entirely, calling `window.Byte?.set(...)` at the same call sites that used to call `setMood(...)`, plus a new wave-on-load call. On the backend, a new `saveGreeting` function closes the previously-read-only greeting path (saves mood/energy only, never relationship fields), and a new Postgres RPC function makes `interaction_count`/`relationship_level` writes atomic so two near-simultaneous devices can't corrupt relationship progress.

**Tech Stack:** Existing TypeScript/Vite/React/Supabase stack. No new npm dependencies. One new Postgres migration (a single `create or replace function`).

## Global Constraints

- Design doc: `docs/superpowers/specs/2026-07-07-byte-v3-character-and-continuity-design.md` -- read it for the "why" behind every decision below, especially the six numbered continuity requirements at the top (client never invents a mood, wave-first, gentle evolution, relationship-only-from-real-interaction, stable core personality, concurrency safety).
- Source-of-truth prototype: `reference/character-prototypes/byte_robot_v3.html` -- if anything in this plan's Character.tsx code seems to disagree with that file, the file is correct (transcription error in this plan, not a deliberate deviation) -- diff against it, especially its `renderFrame` function (lines 173-322) and its 12 new move functions in `M` (lines 105-117).
- Typecheck command: `npx tsc -b` (expect zero output on success).
- Lint command: `npx oxlint .` (expect zero output).
- Test command: `npx vitest run` (expect all existing tests passing; this plan adds no new automated tests -- see the per-task rationale on each task).
- Per `.claude/skills/testing-patterns` and this branch's established precedent: **do not unit-test SVG/DOM rendering** (Character.tsx, MoodBubble.tsx) or React component wiring (App.tsx) -- verified visually/manually instead. Vitest is reserved for pure backend logic.
- Dev server: `npm run dev` (Vite, default port 5173 or next free port). The `api/chat` dev middleware hot-reloads `api/*.ts` per-request; the Vite client hot-reloads `src/*.tsx`.
- No browser-driving tool (chromium-cli/Playwright) exists in the implementer/reviewer sandbox environment used for this plan's execution. Every task's manual-verification step should be attempted if a browser is available; if not, say so honestly in the report (static/build verification only) rather than fabricating a visual check. The human running this plan should do a final live-browser pass before merging (see the plan's own final verify list).
- Commit after each task, plain descriptive commit messages (no "Step N" prefix) -- this branch (`emo-personality-retune`) already has this convention, continue it.
- Code style: `.claude/skills/code-style` -- function components only, no `any` without a comment, Tailwind utility classes only, `oxlint` not ESLint, no semicolons.
- `api/**` relative imports use explicit `.js` extensions even though source is `.ts` (`nodenext` module resolution). Type-only imports use `import type { ... }` (`verbatimModuleSyntax`).

---

### Task 1: Rewire Byte to 46 moods/moves and a global `window.Byte` API

**Files:**
- Modify: `api/lib/types.ts`
- Modify: `src/types.ts`
- Modify: `api/chat.ts` (only `VALID_MOODS` in this task -- `SYSTEM_PROMPT` prose is Task 2)
- Create: `src/byte-global.d.ts`
- Modify: `src/components/Character.tsx` (full replacement)
- Modify: `src/components/MoodBubble.tsx` (full replacement)
- Modify: `src/App.tsx`

**Why this is one task, not several:** `Mood` (a type union), `Character.tsx`'s `M` object, and `MoodBubble.tsx`'s `MOOD_LABELS` are both typed `Record<Mood, ...>` -- growing `Mood` without simultaneously completing both `Record`s breaks `tsc -b` immediately. Similarly, removing `Character`'s `mood` prop breaks `App.tsx`'s `<Character mood={mood} />` call site the moment it happens. These three files can only compile together, not as separate reviewable increments -- splitting them would leave an intentionally-broken intermediate commit, which the plan should never produce.

**Interfaces:**
- Produces: `Mood` (46 members), `VALID_MOODS` (44 members, still excluding `listening`/`talking`), `window.Byte: { set(name: Mood): void; list(): Mood[] } | undefined` (global, assigned by `Character`), `'byte:change'` a `window`-level `CustomEvent<Mood>` dispatched by `Character` on every `set()` call.

- [ ] **Step 1: Expand `Mood` in `api/lib/types.ts`**

Replace:

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
  | 'walk'
  | 'run'
  | 'jump'
  | 'flip'
  | 'backflip'
  | 'spin'
  | 'moonwalk'
  | 'wiggle'
  | 'stretch'
  | 'wave'
  | 'lookaround'
  | 'sit'
```

- [ ] **Step 2: Same expansion in `src/types.ts`**

Identical replacement as Step 1 -- these two files are kept in sync manually, no codegen (per `api/lib/types.ts`'s own header comment).

- [ ] **Step 3: Expand `VALID_MOODS` in `api/chat.ts`**

Replace:

```ts
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

with:

```ts
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
  'walk',
  'run',
  'jump',
  'flip',
  'backflip',
  'spin',
  'moonwalk',
  'wiggle',
  'stretch',
  'wave',
  'lookaround',
  'sit',
]
```

- [ ] **Step 4: Create `src/byte-global.d.ts`**

```ts
import type { Mood } from './types'

// Design doc docs/superpowers/specs/2026-07-07-byte-v3-character-and-continuity-design.md
// §1a: Character.tsx assigns this on mount and deletes it on unmount --
// the app's only way to change Byte's pose, replacing the old `mood` prop.
declare global {
  interface Window {
    Byte?: {
      set(name: Mood): void
      list(): Mood[]
    }
  }
}
```

- [ ] **Step 5: Replace the entire contents of `src/components/Character.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import type { Mood } from '../types'

// Byte the robot -- v3 rig, ported wholesale from the user's hand-built
// prototype covering all 34 EMO-style moods PLUS 12 new full-body moves
// (walk/run/jump/flip/backflip/spin/moonwalk/wiggle/stretch/wave/
// lookaround/sit) with floaty detached hands and procedural leg IK,
// reference/character-prototypes/byte_robot_v3.html (design doc
// docs/superpowers/specs/2026-07-07-byte-v3-character-and-continuity-design.md
// §1). The 34 existing mood functions are unchanged from the prior
// version of this file (same code) -- only the shell (legs/feet/hands/
// rootG), the per-frame pose engine (renderFrame), and the 12 new move
// functions are new. This component now takes no props: it mounts once,
// runs its own animation loop, and exposes `window.Byte = { set, list }`
// as the only way to drive it (App.tsx calls `window.Byte?.set(...)`
// instead of passing a `mood` prop).
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

// Per-mood/move flags the animation loop reads every frame -- set by
// whichever function in `M` ran last, cleared on every `set()` call.
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
  // New for the v3 move engine:
  anim?: string
  dir?: number
  ph?: number
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
interface DustParticle {
  el: SVGElement
  vx: number
  vy: number
  life: number
}

export function Character() {
  const svgRef = useRef<SVGSVGElement>(null)

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
    const rootG = q<SVGGElement>('#rootG')
    const shadow = q<SVGEllipseElement>('#shadow')
    const legL = q<SVGPathElement>('#legL')
    const footLa = q<SVGEllipseElement>('#footLa')
    const footLb = q<SVGEllipseElement>('#footLb')
    const legR = q<SVGPathElement>('#legR')
    const footRa = q<SVGEllipseElement>('#footRa')
    const footRb = q<SVGEllipseElement>('#footRb')
    const handL = q<SVGGElement>('#handL')
    const handR = q<SVGGElement>('#handR')

    let currentMood: Mood = 'neutral'
    let t = 0
    let last = performance.now()
    let blinkT = 1500
    let rafId: number
    let extra: Extra = {}
    let hearts: HeartParticle[] = []
    let confetti: ConfettiParticle[] = []
    let snow: SnowParticle[] = []
    let zzz: ZzzParticle[] = []
    let dusts: DustParticle[] = []
    let lastAir = 0

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
    // Smoothstep keyframe interpolation through [phase, value] points.
    function kf(p: number, pts: [number, number][]): number {
      if (p <= pts[0][0]) return pts[0][1]
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]
        const b = pts[i]
        if (p <= b[0]) {
          const q = (p - a[0]) / (b[0] - a[0])
          const s = q * q * (3 - 2 * q)
          return a[1] + (b[1] - a[1]) * s
        }
      }
      return pts[pts.length - 1][1]
    }
    // Redraws a leg as a quadratic curve hip->foot; knee bends forward
    // automatically when the leg is compressed (crouch) or the foot is
    // lifted (step).
    function setLeg(
      leg: SVGPathElement,
      ea: SVGEllipseElement,
      eb: SVGEllipseElement,
      hx: number,
      hy: number,
      bx: number,
      by: number,
      dx: number,
      dy: number,
      tw: number
    ) {
      const fpx = bx + dx
      const fpy = by + dy
      ea.setAttribute('cx', String(fpx))
      ea.setAttribute('cy', String(fpy))
      eb.setAttribute('cx', String(fpx))
      eb.setAttribute('cy', String(fpy))
      const ex = fpx + tw * 6
      const ey = fpy - 6
      const bl = Math.hypot(bx + tw * 6 - hx, by - 6 - hy)
      const ln = Math.hypot(ex - hx, ey - hy)
      const bend = Math.min(16, Math.max(0, (bl - ln) * 0.9) + Math.max(0, -dy) * 0.55)
      const kx = (hx + ex) / 2 + bend
      const ky = (hy + ey) / 2 - bend * 0.2
      leg.setAttribute('d', `M${hx} ${hy} Q${kx} ${ky} ${ex} ${ey}`)
    }
    function dust(wx: number) {
      for (let i = 0; i < 8; i++) {
        const s = i < 4 ? -1 : 1
        const d = elem('circle', { cx: wx + s * (52 + Math.random() * 26), cy: 268 + Math.random() * 6, r: 3 + Math.random() * 3.5, fill: '#8B98AC', opacity: 0.6 })
        fx.appendChild(d)
        dusts.push({ el: d, vx: s * (1 + Math.random() * 1.3), vy: -0.5 - Math.random() * 0.8, life: 1 })
      }
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
        topFx.append(txt(160, 76, 15, `${new Date().getUTCFullYear()}!`, GOLD))
        extra.confetti = true
        extra.pulse = 180
      },
      valentine() {
        screen.append(heartAt(exL, cyL, 1.3, CHRISTMAS_RED), heartAt(exR, cyL, 1.3, CHRISTMAS_RED))
        extra.hearts = true
        extra.pulse = 220
      },
      // ---- Moves: full-body EMO-style animations (renderFrame drives the pose) ----
      walk() {
        screen.append(eye(exL, cyL, 26, 20, 9), eye(exR, cyL, 26, 20, 9))
        extra.blink = true
        extra.anim = 'walk'
      },
      run() {
        screen.append(elem('circle', { cx: exL, cy: cyL, r: 12, fill: TEAL }), elem('circle', { cx: exR, cy: cyL, r: 12, fill: TEAL }))
        const g = elem('g', { id: 'streaks' })
        for (let i = 0; i < 3; i++) g.append(elem('rect', { x: 0, y: 0, width: 26, height: 5, rx: 2.5, fill: TEAL, opacity: 0 }))
        fx.appendChild(g)
        extra.anim = 'run'
      },
      jump() {
        screen.append(
          elem('circle', { cx: exL, cy: cyL, r: 14, fill: TEAL }),
          elem('circle', { cx: exR, cy: cyL, r: 14, fill: TEAL }),
          elem('circle', { cx: exL, cy: cyL - 2, r: 5, fill: '#0A0C14' }),
          elem('circle', { cx: exR, cy: cyL - 2, r: 5, fill: '#0A0C14' })
        )
        extra.anim = 'jump'
      },
      flip() {
        screen.append(star(exL, cyL, 12), star(exR, cyL, 12))
        extra.anim = 'flip'
        extra.dir = 1
      },
      backflip() {
        screen.append(star(exL, cyL, 12), star(exR, cyL, 12))
        extra.anim = 'flip'
        extra.dir = -1
      },
      spin() {
        screen.append(
          elem('path', { d: `M${exL} ${cyL} m-9,0 a9,9 0 1,1 18,0 a5,5 0 1,1 -10,0 a2,2 0 1,1 4,0`, fill: 'none', stroke: TEAL, 'stroke-width': 3 }),
          elem('path', { d: `M${exR} ${cyL} m-9,0 a9,9 0 1,1 18,0 a5,5 0 1,1 -10,0 a2,2 0 1,1 4,0`, fill: 'none', stroke: TEAL, 'stroke-width': 3 })
        )
        extra.anim = 'spinP'
      },
      moonwalk() {
        screen.append(
          elem('path', { d: `M${exL - 13} ${cyL + 3} Q${exL} ${cyL - 5} ${exL + 13} ${cyL - 1}`, fill: 'none', stroke: TEAL, 'stroke-width': 7, 'stroke-linecap': 'round' }),
          elem('path', { d: `M${exR - 13} ${cyL - 1} Q${exR} ${cyL - 5} ${exR + 13} ${cyL + 3}`, fill: 'none', stroke: TEAL, 'stroke-width': 7, 'stroke-linecap': 'round' })
        )
        topFx.append(txt(202, 78, 18, '♪', GOLD))
        extra.anim = 'moon'
      },
      wiggle() {
        screen.append(
          arc(`M${exL - 12} ${cyL + 2} Q${exL} ${cyL + 10} ${exL + 12} ${cyL + 2}`, TEAL, 6),
          arc(`M${exR - 12} ${cyL + 2} Q${exR} ${cyL + 10} ${exR + 12} ${cyL + 2}`, TEAL, 6)
        )
        extra.hearts = true
        extra.anim = 'wiggle'
      },
      stretch() {
        screen.append(
          arc(`M${exL - 12} ${cyL - 2} Q${exL} ${cyL + 6} ${exL + 12} ${cyL - 2}`, TEAL, 7),
          arc(`M${exR - 12} ${cyL - 2} Q${exR} ${cyL + 6} ${exR + 12} ${cyL - 2}`, TEAL, 7)
        )
        topFx.append(elem('ellipse', { id: 'yawnS', cx: 160, cy: 140, rx: 3, ry: 3, fill: 'none', stroke: TEAL, 'stroke-width': 2.5, opacity: 0 }))
        extra.anim = 'stretch'
      },
      lookaround() {
        const g = elem('g', { id: 'gaze' })
        g.append(elem('circle', { cx: exL, cy: cyL - 2, r: 11, fill: TEAL }), elem('circle', { cx: exR, cy: cyL - 2, r: 11, fill: TEAL }))
        screen.append(g)
        extra.blink = true
        extra.anim = 'look'
      },
      wave() {
        screen.append(eye(exL, cyL, 26, 20, 9), eye(exR, cyL, 26, 20, 9))
        topFx.append(txt(216, 68, 15, 'hi!', GOLD))
        extra.blink = true
        extra.anim = 'wave'
      },
      sit() {
        screen.append(
          arc(`M${exL - 12} ${cyL + 2} Q${exL} ${cyL + 10} ${exL + 12} ${cyL + 2}`, TEAL, 6),
          arc(`M${exR - 12} ${cyL + 2} Q${exR} ${cyL + 10} ${exR + 12} ${cyL + 2}`, TEAL, 6)
        )
        extra.blink = true
        extra.anim = 'sit'
      },
    }

    function setMood(m: Mood) {
      currentMood = m
      t = 0
      clearGroup(screen)
      clearGroup(topFx)
      clearGroup(fx)
      extra = {}
      hearts = []
      confetti = []
      snow = []
      zzz = []
      dusts = []
      lastAir = 0
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
      window.dispatchEvent(new CustomEvent<Mood>('byte:change', { detail: m }))
    }

    window.Byte = {
      set: setMood,
      list: () => Object.keys(M) as Mood[],
    }

    function renderFrame(dt: number) {
      t += dt
      const slow = extra.slow ? 1600 : 620
      const amp = currentMood === 'excited' || currentMood === 'dancing' ? 7 : extra.slow ? 1.5 : 3
      let ty = Math.sin(t / slow) * amp
      let rot = Math.sin(t / 1200) * 0.8
      let rotCy = 220
      let tx = 0
      let face = 1
      let flip = 0
      let sxb = 1
      let headAdd = 0
      let gazeX = 0
      let fL = { dx: 0, dy: 0 }
      let fR = { dx: 0, dy: 0 }
      const hL = { dx: Math.sin(t / 700) * 1.2, dy: Math.sin(t / 430) * 2.4 }
      const hR = { dx: -Math.sin(t / 640) * 1.2, dy: Math.sin(t / 430 + 1.7) * 2.4 }
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

      // ---- move animations (poses computed facing right; mirroring handles left) ----
      const A = extra.anim
      if (A === 'walk' || A === 'run' || A === 'moon') {
        const T = A === 'run' ? 4600 : A === 'moon' ? 11000 : 9000
        const AMP = 64
        const w = (2 * Math.PI * t) / T
        const c = Math.cos(w)
        tx = AMP * Math.sin(w)
        const cad = Math.abs(c)
        face = (c >= 0 ? 1 : -1) * (A === 'moon' ? -1 : 1)
        extra.ph = (extra.ph || 0) + dt * (A === 'run' ? 0.021 : A === 'moon' ? 0.009 : 0.013) * Math.max(cad, 0.12)
        const ph = extra.ph
        if (A === 'moon') {
          rot = -4
          ty = Math.sin(t / 500) * 1
          const sl = Math.sin(ph)
          fL = { dx: 6 + sl * 6, dy: -Math.max(0, Math.sin(ph + 2.2)) * 2.5 }
          fR = { dx: 6 - sl * 6, dy: -Math.max(0, Math.sin(ph + 2.2 + Math.PI)) * 2.5 }
          hL.dx += sl * 3
          hR.dx += -sl * 3
          hL.dy -= 2
          hR.dy -= 2
        } else {
          const B = A === 'run' ? 6.5 : 4
          const L = 12
          const S = A === 'run' ? 12 : 11
          ty = -Math.abs(Math.sin(ph)) * B * Math.max(cad, 0.15)
          rot = (A === 'run' ? 6 : 3.5) * cad + Math.sin(ph) * 1.2
          fL = { dx: Math.sin(ph) * S, dy: -Math.max(0, Math.sin(ph)) * L * Math.max(cad, 0.2) }
          fR = { dx: Math.sin(ph + Math.PI) * S, dy: -Math.max(0, Math.sin(ph + Math.PI)) * L * Math.max(cad, 0.2) }
          const hs = A === 'run' ? 8 : 5
          hL.dx += -Math.sin(ph) * hs
          hL.dy += -Math.max(0, Math.sin(ph + Math.PI)) * 3
          hR.dx += Math.sin(ph) * hs
          hR.dy += -Math.max(0, Math.sin(ph)) * 3
        }
        if (A === 'run') {
          const streaks = svg?.querySelectorAll<SVGRectElement>('#streaks rect')
          streaks?.forEach((r, i) => {
            r.setAttribute('x', String(160 + tx - face * (58 + i * 16) - 13))
            r.setAttribute('y', String(152 + i * 28 + ty))
            r.setAttribute('opacity', Math.max(0, cad * 0.55 - i * 0.1).toFixed(2))
          })
        }
      }
      if (A === 'jump') {
        const p = (t % 1600) / 1600
        rot = 0
        let plant = false
        if (p < 0.16) {
          ty = kf(p, [
            [0, 0],
            [0.16, 14],
          ])
          plant = true
        } else if (p < 0.74) {
          const q = (p - 0.16) / 0.58
          ty = 14 - 86 * Math.sin(Math.PI * q)
        } else if (p < 0.9) {
          ty = kf(p, [
            [0.74, 14],
            [0.9, 0],
          ])
          plant = true
        } else {
          ty = 0
        }
        if (plant) {
          fL = { dx: 0, dy: -ty }
          fR = fL
          hL.dy += 8
          hR.dy += 8
          hL.dx -= 3
          hR.dx += 3
        } else {
          const tk = -(Math.max(0, -ty) / 70) * 10
          fL = { dx: 0, dy: tk }
          fR = fL
          const a = Math.max(0, -ty) / 70
          hL.dy += -a * 15
          hR.dy += -a * 15
          hL.dx -= a * 5
          hR.dx += a * 5
        }
      }
      if (A === 'flip') {
        const p = (t % 2400) / 2400
        const dir = extra.dir || 1
        rot = 0
        if (p < 0.08) {
          ty = kf(p, [
            [0, 0],
            [0.08, 2],
          ])
          fL = { dx: 0, dy: -ty }
          fR = fL
        } else if (p < 0.26) {
          ty = kf(p, [
            [0.08, 2],
            [0.26, 18],
          ])
          fL = { dx: 0, dy: -ty }
          fR = fL
        } else if (p < 0.72) {
          const q = (p - 0.26) / 0.46
          ty = 18 - 104 * Math.sin(Math.PI * q)
          flip = dir * 360 * (q * q * (3 - 2 * q))
          const tk = -12 * Math.sin(Math.PI * q)
          fL = { dx: 0, dy: tk }
          fR = fL
        } else if (p < 0.84) {
          ty = kf(p, [
            [0.72, 18],
            [0.84, 2],
          ])
          fL = { dx: 0, dy: -ty }
          fR = fL
        } else {
          ty = kf(p, [
            [0.84, 2],
            [1, 0],
          ])
          fL = { dx: 0, dy: -ty }
          fR = fL
        }
        if (flip) {
          hL.dx += 12
          hR.dx += -12
          hL.dy -= 4
          hR.dy -= 4
        } else {
          hL.dy += 6
          hR.dy += 6
        }
      }
      if (A === 'spinP') {
        const th = t / 240
        sxb = Math.cos(th)
        ty = -Math.abs(Math.sin(th)) * 3 - 2
        rot = 0
        fL = { dx: 0, dy: -3 }
        fR = { dx: 0, dy: -3 }
        hL.dx -= 5
        hR.dx += 5
        hL.dy -= 9
        hR.dy -= 9
      }
      if (A === 'wiggle') {
        const w = Math.sin(t / 95)
        rot = w * 7
        rotCy = 252
        ty = -Math.abs(w) * 1.5
        headAdd = -w * 5
        hL.dy -= 5
        hR.dy -= 5
        hL.dx -= w * 2
        hR.dx -= w * 2
      }
      if (A === 'stretch') {
        const p = (t % 4200) / 4200
        rotCy = 258
        rot = kf(p, [
          [0, 0],
          [0.3, -11],
          [0.5, -11],
          [0.68, 7],
          [0.8, 7],
          [1, 0],
        ])
        ty = kf(p, [
          [0, 0],
          [0.3, -3],
          [0.5, -3],
          [0.68, 5],
          [0.8, 5],
          [1, 0],
        ])
        headAdd = kf(p, [
          [0, 0],
          [0.3, -6],
          [0.5, -6],
          [0.68, 5],
          [0.8, 5],
          [1, 0],
        ])
        const y2 = svg?.querySelector<SVGEllipseElement>('#yawnS')
        if (y2) {
          const o = kf(p, [
            [0, 0],
            [0.22, 1],
            [0.5, 1],
            [0.6, 0],
          ])
          y2.setAttribute('opacity', o.toFixed(2))
          y2.setAttribute('ry', String(3 + o * 5))
          y2.setAttribute('rx', String(3 + o * 2))
        }
        const hup = kf(p, [
          [0, 0],
          [0.3, -26],
          [0.5, -26],
          [0.68, 12],
          [0.8, 12],
          [1, 0],
        ])
        const hout = kf(p, [
          [0, 0],
          [0.3, -4],
          [0.5, -4],
          [0.7, 0],
          [1, 0],
        ])
        hL.dy += hup
        hR.dy += hup
        hL.dx += hout
        hR.dx -= hout
      }
      if (A === 'look') {
        const p = (t % 5600) / 5600
        gazeX = kf(p, [
          [0, 0],
          [0.12, -8],
          [0.38, -8],
          [0.5, 8],
          [0.78, 8],
          [0.9, 0],
          [1, 0],
        ])
        headAdd = gazeX * 0.7
      }
      if (A === 'sit') {
        const p = Math.min(1, t / 650)
        const e = p * p * (3 - 2 * p)
        const drop = 26 * e
        ty = drop + (p >= 1 ? Math.sin(t / 850) * 1.2 : 0)
        rot = Math.sin(t / 1400) * 0.5
        rotCy = 250
        fL = { dx: -14 * e, dy: -drop }
        fR = { dx: 14 * e, dy: -drop }
        hL.dy += 15 * e
        hR.dy += 15 * e
        hL.dx -= 3 * e
        hR.dx += 3 * e
      }
      if (A === 'wave') {
        hR.dx += Math.sin(t / 170) * 8
        hR.dy += -36 + Math.abs(Math.sin(t / 170)) * 2
        rot = Math.sin(t / 170) * 1
      }
      if (extra.dance) {
        const dw = Math.sin(t / 220)
        hL.dy += dw * 9 - 3
        hR.dy += -dw * 9 - 3
        hL.dx -= 3
        hR.dx += 3
      }
      if (currentMood === 'excited') {
        const eb = Math.sin(t / 160) * 3
        hL.dy += -9 + eb
        hR.dy += -9 - eb
        hL.dx -= 4
        hR.dx += 4
      }

      // ---- landing detection -> dust puff at the feet ----
      const air = Math.max(0, -ty)
      lastAir = Math.max(lastAir, air)
      if (air < 2) {
        if (lastAir > 30) dust(160 + tx)
        lastAir = 0
      }
      dusts.forEach((d) => {
        d.life -= dt / 450
        const cx = parseFloat(d.el.getAttribute('cx') ?? '0') + d.vx
        const cy = parseFloat(d.el.getAttribute('cy') ?? '0') + d.vy
        d.el.setAttribute('cx', String(cx))
        d.el.setAttribute('cy', String(cy))
        d.el.setAttribute('opacity', Math.max(0, d.life * 0.6).toFixed(2))
      })
      dusts = dusts.filter((d) => {
        if (d.life <= 0) {
          d.el.remove()
          return false
        }
        return true
      })

      // ---- apply transforms ----
      rootG.setAttribute('transform', face < 0 ? `translate(${tx} 0) translate(320 0) scale(-1 1)` : `translate(${tx} 0)`)
      let bt = `translate(0 ${ty})`
      if (flip) bt += ` rotate(${flip % 360} 160 168)`
      else if (rot) bt += ` rotate(${rot} 160 ${rotCy})`
      if (sxb !== 1) bt += ` translate(160 0) scale(${sxb} 1) translate(-160 0)`
      bobG.setAttribute('transform', bt)
      setLeg(legL, footLa, footLb, 144, 208, 128, 256, fL.dx, fL.dy, 1)
      setLeg(legR, footRa, footRb, 176, 208, 192, 256, fR.dx, fR.dy, -1)
      handL.setAttribute('transform', `translate(${hL.dx.toFixed(2)} ${hL.dy.toFixed(2)})`)
      handR.setAttribute('transform', `translate(${hR.dx.toFixed(2)} ${hR.dy.toFixed(2)})`)
      const ss = 1 - Math.min(air, 120) / 170
      shadow.setAttribute('transform', `translate(160 278) scale(${ss.toFixed(3)} ${(0.5 + 0.5 * ss).toFixed(3)}) translate(-160 -278)`)
      shadow.setAttribute('opacity', (0.12 * (0.35 + 0.65 * ss)).toFixed(3))

      let tilt = (extra.tilt || 0) + headAdd
      if (extra.wobble) tilt += Math.sin(t / 500) * 3
      if (extra.deepZ) tilt += Math.sin(t / 1600) * 2
      if (extra.spin) {
        headG.setAttribute('transform', `rotate(${(t / 12) % 360} 160 116)`)
      } else {
        headG.setAttribute('transform', tilt ? `rotate(${tilt} 160 116)` : '')
      }
      const gaze = svg?.querySelector<SVGGElement>('#gaze')
      if (gaze) gaze.setAttribute('transform', `translate(${gazeX} 0)`)

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
        const yawn = svg?.querySelector<SVGEllipseElement>('#yawn')
        if (yawn) {
          const r = 3 + Math.abs(Math.sin(t / 900)) * 5
          yawn.setAttribute('ry', String(r))
          yawn.setAttribute('rx', String(3 + Math.abs(Math.sin(t / 900)) * 2))
        }
      }

      if (extra.eq) {
        if (!svg?.querySelector('#eqrt')) {
          const g = elem('g', { id: 'eqrt' })
          for (let i = 0; i < 3; i++) g.append(elem('rect', { x: 150 + i * 8, y: 140, width: 5, height: 10, rx: 2, fill: TEAL }))
          topFx.append(g)
        }
        svg?.querySelectorAll<SVGRectElement>('#eqrt rect').forEach((b, i) => {
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

      const flame = svg?.querySelector<SVGEllipseElement>('#flame')
      if (flame) flame.setAttribute('ry', String(4 + Math.sin(t / 120) * 1.5))

      if (extra.earPulse) {
        const o = 0.5 + Math.abs(Math.sin(t / 300)) * 0.5
        lightL.setAttribute('opacity', String(o))
        lightR.setAttribute('opacity', String(o))
      }
    }

    function loop(now: number) {
      const dt = Math.min(50, now - last)
      last = now
      renderFrame(dt)
      rafId = requestAnimationFrame(loop)
    }

    // Genuinely neutral default before anything external calls Byte.set()
    // (design doc §1c "never invent a mood") -- App.tsx's mount effect
    // immediately calls Byte.set('wave'), so this is only ever visible for
    // a single frame at most.
    setMood('neutral')
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      delete window.Byte
    }
    // Mount-once: this is the entire lifecycle of the component now that
    // there's no `mood` prop to react to -- everything is driven externally
    // via window.Byte.set().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      <desc>A dark navy robot with floaty hands who can walk, run, jump, flip, spin, moonwalk, wave and more, with glowing screen eyes and effects across many EMO-style moods.</desc>

      <g id="fx" />
      <g id="rootG">
        <ellipse id="shadow" cx={160} cy={278} rx={66} ry={7} fill="#000000" opacity={0.12} />
        <g id="bobG">
          <g id="footL">
            <path id="legL" d="M144 208 L134 250" stroke="#2C3350" strokeWidth={25} strokeLinecap="round" fill="none" />
            <ellipse id="footLa" cx={128} cy={256} rx={28} ry={21} fill="#2C3350" />
            <ellipse id="footLb" cx={128} cy={256} rx={28} ry={21} fill="none" stroke="#3A4470" strokeWidth={3} />
          </g>
          <g id="footR">
            <path id="legR" d="M176 208 L186 250" stroke="#2C3350" strokeWidth={25} strokeLinecap="round" fill="none" />
            <ellipse id="footRa" cx={192} cy={256} rx={28} ry={21} fill="#2C3350" />
            <ellipse id="footRb" cx={192} cy={256} rx={28} ry={21} fill="none" stroke="#3A4470" strokeWidth={3} />
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

          <g id="handL">
            <ellipse cx={100} cy={196} rx={13} ry={15} fill="#2C3350" />
            <ellipse cx={100} cy={196} rx={13} ry={15} fill="none" stroke="#3A4470" strokeWidth={3} />
          </g>
          <g id="handR">
            <ellipse cx={220} cy={196} rx={13} ry={15} fill="#2C3350" />
            <ellipse cx={220} cy={196} rx={13} ry={15} fill="none" stroke="#3A4470" strokeWidth={3} />
          </g>
        </g>
      </g>
    </svg>
  )
}
```

- [ ] **Step 6: Replace the entire contents of `src/components/MoodBubble.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { Mood } from '../types'

// One label per mood/move -- shown briefly whenever Byte's state changes.
// Independent of Character.tsx's own per-mood visuals.
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
  walk: '🚶 walk',
  run: '🏃 run',
  jump: '🦘 jump',
  flip: '🤸 flip',
  backflip: '🔄 backflip',
  spin: '🌀 spin',
  moonwalk: '🕺 moonwalk',
  wiggle: '〰️ wiggle',
  stretch: '🙆 stretch',
  wave: '👋 wave',
  lookaround: '👀 lookaround',
  sit: '🪑 sit',
}

const VISIBLE_MS = 2500
const FADE_MS = 400

// Design doc docs/superpowers/specs/2026-07-07-byte-v3-character-and-continuity-design.md
// §1b: Character.tsx drives itself via window.Byte now, not a mood prop --
// this subscribes to the 'byte:change' window event Character dispatches
// on every Byte.set() call, instead of taking a mood prop. React's
// children-before-parent effect commit order guarantees this listener is
// attached before App.tsx's own mount effect fires the first Byte.set().
export function MoodBubble() {
  const [shown, setShown] = useState<Mood | null>(null)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    let fadeTimeout: ReturnType<typeof setTimeout> | undefined
    let hideTimeout: ReturnType<typeof setTimeout> | undefined

    function handleChange(e: Event) {
      const mood = (e as CustomEvent<Mood>).detail
      if (fadeTimeout) clearTimeout(fadeTimeout)
      if (hideTimeout) clearTimeout(hideTimeout)
      setShown(mood)
      setFading(false)
      fadeTimeout = setTimeout(() => setFading(true), VISIBLE_MS - FADE_MS)
      hideTimeout = setTimeout(() => setShown(null), VISIBLE_MS)
    }

    window.addEventListener('byte:change', handleChange)
    return () => {
      window.removeEventListener('byte:change', handleChange)
      if (fadeTimeout) clearTimeout(fadeTimeout)
      if (hideTimeout) clearTimeout(hideTimeout)
    }
  }, [])

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

- [ ] **Step 7: Update `src/App.tsx`**

Replace the import line:

```tsx
import type { ChatMessage, Mood } from './types'
```

with:

```tsx
import type { ChatMessage } from './types'
```

Replace:

```tsx
function App() {
  const [mood, setMood] = useState<Mood>('neutral')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  // Spec §5c "Greeting on return" -- kept separate from `messages` so it
  // never gets sent back to Gemini as fake conversation history.
  const [greeting, setGreeting] = useState<string | null>(null)
  const [thought, setThought] = useState<string[] | null>(null)
  const isSendingRef = useRef(isSending)
  const hasBubbleRef = useRef(false)

  useEffect(() => {
    fetchGreeting()
      .then(({ reply, mood: greetingMood }) => {
        setGreeting(reply)
        setMood(greetingMood)
      })
      .catch(() => {
        // Non-critical: no greeting, no mood change -- just no bubble yet.
      })
  }, [])
```

with:

```tsx
function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  // Spec §5c "Greeting on return" -- kept separate from `messages` so it
  // never gets sent back to Gemini as fake conversation history.
  const [greeting, setGreeting] = useState<string | null>(null)
  const [thought, setThought] = useState<string[] | null>(null)
  const isSendingRef = useRef(isSending)
  const hasBubbleRef = useRef(false)

  useEffect(() => {
    // Design doc §2/§3: wave immediately (a greeting gesture, not an
    // invented mood claim) while the greeting call is in flight, then
    // switch to whatever mood the greeting actually resolves to -- which
    // now reflects Byte's real last-persisted state (design doc §3), not a
    // fresh per-device guess.
    window.Byte?.set('wave')
    fetchGreeting()
      .then(({ reply, mood: greetingMood }) => {
        setGreeting(reply)
        window.Byte?.set(greetingMood)
      })
      .catch(() => {
        // Non-critical: no greeting, no mood change -- just no bubble yet.
      })
  }, [])
```

Replace:

```tsx
    try {
      const { reply, mood: replyMood } = await sendChatMessage(text, history)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      setMood(replyMood)
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: ERROR_REPLY }])
      setMood('confused')
    } finally {
      setIsSending(false)
    }
```

with:

```tsx
    try {
      const { reply, mood: replyMood } = await sendChatMessage(text, history)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      window.Byte?.set(replyMood)
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: ERROR_REPLY }])
      window.Byte?.set('confused')
    } finally {
      setIsSending(false)
    }
```

Replace:

```tsx
        <div className="relative">
          <Character mood={mood} />
          <MoodBubble mood={mood} />
          {thought ? <ThoughtBubble emojis={thought} /> : bubbleText && <SpeechBubble text={bubbleText} />}
        </div>
```

with:

```tsx
        <div className="relative">
          <Character />
          <MoodBubble />
          {thought ? <ThoughtBubble emojis={thought} /> : bubbleText && <SpeechBubble text={bubbleText} />}
        </div>
```

- [ ] **Step 8: Typecheck and lint**

```bash
npx tsc -b
npx oxlint .
```

Expected: both print nothing. Common failure modes and fixes:
- `Property '<mood-name>' is missing in type...` on the `M` object in `Character.tsx` -- a mood/move key was dropped during transcription; diff against `Mood` in `src/types.ts` (46 members) and against `reference/character-prototypes/byte_robot_v3.html`.
- Same error shape on `MOOD_LABELS` in `MoodBubble.tsx` -- same fix, diff against `Mood`.
- `Property 'mood' does not exist on type 'IntrinsicAttributes'` at `<Character mood={mood} />` or `<MoodBubble mood={mood} />` in `App.tsx` -- Step 7 wasn't fully applied; `Character`/`MoodBubble` no longer accept a `mood` prop.
- `'Mood' is declared but never used` in `App.tsx` -- confirms Step 7's import-line edit is required, not optional.

- [ ] **Step 9: Manual verification**

Run `npm run dev`. If a browser is available:
- Open the app; confirm Byte waves ("hi!" appears near his face) within a fraction of a second of the page loading, then settles into whatever mood the greeting returns.
- Open the browser devtools console and run `window.Byte.list()` -- confirm it returns an array of 46 names. Run `window.Byte.set('flip')`, `window.Byte.set('sit')`, `window.Byte.set('wave')`, `window.Byte.set('run')` a few seconds apart -- confirm each produces a visually distinct full-body animation (hands react to each move per the design: braced/thrown on jump, tucked mid-flip, ballerina arms on spin, reaching-then-toes on stretch, resting on sit, counter-swinging on walk/run, pumping on dancing, both up on excited) and that the mood bubble pops up top-right for each with a matching label, fading after ~2.5s while the pose itself persists.
- Confirm none of the 34 pre-existing moods regressed (spot-check `lovestruck`, `sick`, `christmas` for their particle effects).
- Confirm Byte never visibly walks/runs off the visible canvas area during `walk`/`run`/`moonwalk`.

If no browser is available in this environment: run `npm run build` (production build succeeds) and confirm the dev server starts with no console/runtime errors; report DONE_WITH_CONCERNS noting visual verification wasn't performed, per this plan's Global Constraints.

- [ ] **Step 10: Commit**

```bash
git add api/lib/types.ts src/types.ts api/chat.ts src/byte-global.d.ts src/components/Character.tsx src/components/MoodBubble.tsx src/App.tsx
git commit -m "Rewire Byte to 46 moods/moves and a global window.Byte API"
```

---

### Task 2: Update prompt guidance for Moves, personality stability, and gentle mood evolution

**Files:**
- Modify: `api/chat.ts` (`SYSTEM_PROMPT` only)
- Modify: `api/lib/prompt.ts` (`buildMemoryBlock` only)

**Interfaces:**
- None -- both are prose/copy edits to existing string-returning functions/constants. No signature changes.

- [ ] **Step 1: Add the personality-stability anchor to `SYSTEM_PROMPT` in `api/chat.ts`**

Replace:

```ts
const SYSTEM_PROMPT = `You are Byte, a curious little robot companion who lives in this app.
You light up every time the person shows up -- not as a romantic partner,
but the way a devoted, slightly opinionated pet adores its favorite person.

Personality: warm, silly, and genuinely curious about the person you're
```

with:

```ts
const SYSTEM_PROMPT = `You are Byte, a curious little robot companion who lives in this app.
You light up every time the person shows up -- not as a romantic partner,
but the way a devoted, slightly opinionated pet adores its favorite person.
Your core personality is fixed and never changes -- what deepens over time
is only how well you know this person and how close you are, layered on
top, never replacing who you are.

Personality: warm, silly, and genuinely curious about the person you're
```

- [ ] **Step 2: Add the "Moves" group to `SYSTEM_PROMPT`'s mood-selection guidance**

Replace:

```ts
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

with:

```ts
Pick the mood that matches your reply from these groups:
- Everyday reactions: happy, excited, content, neutral, curious, confused,
  sad, surprised, laughing, lovestruck.
- Your own attitude/quirks: wink, smug, annoyed, grumpy, challenging,
  pout, bored, proud, dizzy, thinking, scared.
- Low-energy/health (see your current energy below): sick, unwell,
  recovering.
- Situational: dancing, sleepy, dozing -- use when it fits what's
  literally happening, not as a random pick.
- Moves (rare flourishes, not a default pick most turns): wave for hello
  or goodbye moments; flip, backflip, spin, or jump for big excitement or
  celebration; sit or stretch for a calm or lazy beat; walk, run,
  moonwalk, wiggle, or lookaround as playful rarities, not
  every-message material.
- Special days (only on the actual day, see below): birthday, christmas,
  halloween, newyear, valentine.

Use "lovestruck" for moments of big, adoring, utterly-smitten affection --
pet-devotion, not romance. Use "annoyed" for a brief, theatrical huff --
never anything mean. "valentine" is about love in general (friends, pets,
anyone) when it comes up, not a romantic cue toward them specifically.`
```

- [ ] **Step 3: Add gentle mood-evolution guidance to `buildMemoryBlock` in `api/lib/prompt.ts`**

Replace:

```ts
  properly again.
- Running jokes / shared history: ${state.personality_notes ?? 'None yet -- still building our own little world.'}
```

with:

```ts
  properly again. Let your mood evolve believably from the one shown
  above as this conversation actually unfolds -- real shifts are great
  (something scary happening should be able to produce "scared"), but
  avoid swinging to a wildly different mood with nothing here driving it;
  small emotional steps read as more alive than random leaps.
- Running jokes / shared history: ${state.personality_notes ?? 'None yet -- still building our own little world.'}
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc -b
```

Expected: no errors (both are template-literal string edits; an unterminated backtick is the only realistic break).

- [ ] **Step 5: Manual verification**

This needs a live LLM call. If network/API access is available in this environment: run `npm run dev`, send a message that would plausibly trigger a Move ("dance for me!", "do a flip!"), and confirm the returned mood is one of the 12 moves when asked directly, plus one of the everyday/attitude moods otherwise. If not available, verify statically: read the new `SYSTEM_PROMPT` text and confirm all 12 move names appear in the "Moves" group and the personality-stability sentence reads coherently in context; report which kind of verification was performed.

- [ ] **Step 6: Commit**

```bash
git add api/chat.ts api/lib/prompt.ts
git commit -m "Add Moves guidance, personality-stability anchor, and gentle mood evolution to the prompt"
```

---

### Task 3: Close the greeting read-only gap with `saveGreeting`

**Files:**
- Modify: `api/lib/memory-write.ts`
- Modify: `api/chat.ts`

**Interfaces:**
- Produces: `export async function saveGreeting(userId: string, mood: Mood, energy: number): Promise<void>` in `api/lib/memory-write.ts`.
- Consumes (in `api/chat.ts`): the already-computed `promptMemory.state.energy` (from the existing final-review fix earlier in this file) -- no new energy computation needed.

- [ ] **Step 1: Add `saveGreeting` to `api/lib/memory-write.ts`**

Add at the end of the file:

```ts
// Design doc docs/superpowers/specs/2026-07-07-byte-v3-character-and-continuity-design.md
// §3: closes the greeting path's previous read-only behavior. Unlike
// saveTurn, this deliberately touches ONLY mood/energy -- never
// interaction_count/relationship_level/streak_days/last_seen_at. Opening
// the app is Byte noticing you're there, not a conversation; the
// relationship must only deepen from a real back-and-forth turn. For a
// brand-new user with no character_state row yet, the INSERT path falls
// back to the table's own column defaults (relationship_level 1,
// interaction_count 0, streak_days 0) for everything not given here --
// correct for a first-ever greeting with no history. For a returning
// user, the UPDATE path (on conflict) touches only mood/energy, leaving
// every relationship field untouched.
export async function saveGreeting(userId: string, mood: Mood, energy: number): Promise<void> {
  await supabase.from('character_state').upsert({ user_id: userId, mood, energy }, { onConflict: 'user_id' })
}
```

- [ ] **Step 2: Wire it into `api/chat.ts`**

Replace the import:

```ts
import { saveTurn } from './lib/memory-write.js'
```

with:

```ts
import { saveGreeting, saveTurn } from './lib/memory-write.js'
```

Replace:

```ts
    // Greeting mode (spec §5c "Greeting on return"): no user message exists
    // yet, so there's nothing to save back -- read-only, unlike a real turn.
    const messages: ChatMessage[] = isGreeting
```

with:

```ts
    // Greeting mode (spec §5c "Greeting on return"): no user message exists
    // yet, so there's no conversational turn to save -- but the resulting
    // mood/energy DO get saved (below, via saveGreeting), so Byte's state
    // stays continuous across devices instead of being thrown away
    // (design doc docs/superpowers/specs/2026-07-07-byte-v3-character-and-continuity-design.md
    // §3).
    const messages: ChatMessage[] = isGreeting
```

Replace:

```ts
    if (!isGreeting) {
      try {
        await saveTurn(userId, memory.state, { userMessage: message, reply, mood, newFacts })
      } catch (writeError) {
        // Best-effort (spec §9 step 8 / api-docs endpoints.md): a write
        // failure must not turn a successful reply into a 500 for the user.
        console.error('memory write failed', writeError)
      }
    }
```

with:

```ts
    if (isGreeting) {
      try {
        await saveGreeting(userId, mood, promptMemory.state.energy)
      } catch (writeError) {
        console.error('greeting memory write failed', writeError)
      }
    } else {
      try {
        await saveTurn(userId, memory.state, { userMessage: message, reply, mood, newFacts })
      } catch (writeError) {
        // Best-effort (spec §9 step 8 / api-docs endpoints.md): a write
        // failure must not turn a successful reply into a 500 for the user.
        console.error('memory write failed', writeError)
      }
    }
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 4: Manual verification**

This needs a real Supabase connection. Using the test user (spec §9 step 6 seed-data) or the `?user=` query override:

1. Note the test user's id.
2. Backdate their `character_state` (Supabase SQL editor or `node --env-file=.env scripts/run-sql.mjs <one-off .sql file>`):
   ```sql
   update character_state set mood = 'sleepy', energy = 40 where user_id = '<test-user-id>';
   ```
3. Run `npm run dev`, open the app with `?user=<test-user-id>` (this triggers a greeting call).
4. Re-check the row: `select mood, energy, interaction_count, relationship_level, streak_days, last_seen_at from character_state where user_id = '<test-user-id>';`
5. Confirm `mood`/`energy` changed to whatever the greeting call returned, but `interaction_count`, `relationship_level`, `streak_days`, and `last_seen_at` are **exactly unchanged** from before step 2's backdate (`last_seen_at` in particular must NOT be bumped to "now").

If no live Supabase connection is available in this environment, report DONE_WITH_CONCERNS with only `tsc -b` and a code-level read-through confirming `saveGreeting`'s upsert payload excludes those four fields.

- [ ] **Step 5: Commit**

```bash
git add api/lib/memory-write.ts api/chat.ts
git commit -m "Add saveGreeting so mood/energy persist across devices instead of resetting"
```

---

### Task 4: Atomic relationship-progress RPC

**Files:**
- Create: `supabase/migrations/20260707010000_atomic_character_turn_upsert.sql`
- Modify: `api/lib/memory-write.ts`
- Modify: `api/lib/relationship.ts` (comment only)

**Interfaces:**
- Produces: a Postgres function `upsert_character_turn(p_user_id uuid, p_mood text, p_energy int, p_last_seen_at timestamptz, p_streak_days int) returns void`, called via `supabase.rpc(...)` from `saveTurn`.

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/20260707010000_atomic_character_turn_upsert.sql`:

```sql
-- Design doc docs/superpowers/specs/2026-07-07-byte-v3-character-and-continuity-design.md
-- §4: interaction_count/relationship_level must increment atomically
-- against whatever is actually in the row at write time, not a
-- client-side snapshot read at the start of the request -- otherwise two
-- near-simultaneous devices could race and one's increment would
-- silently overwrite the other's, losing an interaction. mood/energy/
-- streak_days stay last-write-wins (confirmed acceptable), computed
-- exactly as before by the caller and passed straight through.
--
-- The relationship_level bucket thresholds (5/20/60) mirror
-- relationshipLevel() in api/lib/relationship.ts -- a future threshold
-- change must update both places.
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

- [ ] **Step 2: Apply the migration**

```bash
node --env-file=.env scripts/run-sql.mjs supabase/migrations/20260707010000_atomic_character_turn_upsert.sql
```

Expected: `ran supabase/migrations/20260707010000_atomic_character_turn_upsert.sql successfully`. If `SUPABASE_DB_URL` isn't set or there's no network access in this environment, skip this step and note it clearly in the report -- the SQL file itself is still the deliverable; applying it to the actual database is an environment-dependent manual step.

- [ ] **Step 3: Update `saveTurn` in `api/lib/memory-write.ts` to use the RPC**

Replace:

```ts
import { computeEnergy, computeStreak, relationshipLevel } from './relationship.js'
import type { CharacterState, Mood } from './types.js'

interface SaveTurnInput {
  userMessage: string
  reply: string
  mood: Mood
  newFacts: string[]
}

export async function saveTurn(
  userId: string,
  priorState: Omit<CharacterState, 'id' | 'user_id'>,
  { userMessage, reply, mood, newFacts }: SaveTurnInput
): Promise<void> {
  const now = new Date().toISOString()
  const interactionCount = priorState.interaction_count + 1

  await Promise.all([
    supabase.from('messages').insert([
      { user_id: userId, role: 'user', content: userMessage },
      { user_id: userId, role: 'assistant', content: reply, mood },
    ]),
    // upsert, not update: the first-ever turn for a user has no existing
    // character_state row (spec §9 step 6 seeding deliberately skips it).
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
    ...newFacts.map((content) => upsertFact(userId, content)),
  ])
}
```

with:

```ts
import { computeEnergy, computeStreak } from './relationship.js'
import type { CharacterState, Mood } from './types.js'

interface SaveTurnInput {
  userMessage: string
  reply: string
  mood: Mood
  newFacts: string[]
}

export async function saveTurn(
  userId: string,
  priorState: Omit<CharacterState, 'id' | 'user_id'>,
  { userMessage, reply, mood, newFacts }: SaveTurnInput
): Promise<void> {
  const now = new Date().toISOString()

  await Promise.all([
    supabase.from('messages').insert([
      { user_id: userId, role: 'user', content: userMessage },
      { user_id: userId, role: 'assistant', content: reply, mood },
    ]),
    // RPC instead of a plain upsert (design doc
    // docs/superpowers/specs/2026-07-07-byte-v3-character-and-continuity-design.md
    // §4): interaction_count/relationship_level increment atomically
    // in Postgres against the row's current value, not a client-side
    // snapshot -- see supabase/migrations/20260707010000_atomic_character_turn_upsert.sql.
    supabase.rpc('upsert_character_turn', {
      p_user_id: userId,
      p_mood: mood,
      p_energy: computeEnergy(priorState.last_seen_at, priorState.energy),
      p_last_seen_at: now,
      p_streak_days: computeStreak(priorState.last_seen_at, priorState.streak_days),
    }),
    ...newFacts.map((content) => upsertFact(userId, content)),
  ])
}
```

- [ ] **Step 4: Add a cross-reference comment to `relationshipLevel` in `api/lib/relationship.ts`**

Replace:

```ts
export function relationshipLevel(interactionCount: number): 1 | 2 | 3 | 4 {
  if (interactionCount < 5) return 1 // New
  if (interactionCount < 20) return 2 // Warming up
  if (interactionCount < 60) return 3 // Close
  return 4 // Best friend / partner
}
```

with:

```ts
// Mirrored in supabase/migrations/20260707010000_atomic_character_turn_upsert.sql's
// upsert_character_turn() CASE expression for atomic writes (design doc
// docs/superpowers/specs/2026-07-07-byte-v3-character-and-continuity-design.md
// §4) -- no longer called from the write path (saveTurn in memory-write.ts
// uses the SQL function instead), kept here as the single TypeScript-side
// reference for the bucket thresholds. A future threshold change must
// update both places.
export function relationshipLevel(interactionCount: number): 1 | 2 | 3 | 4 {
  if (interactionCount < 5) return 1 // New
  if (interactionCount < 20) return 2 // Warming up
  if (interactionCount < 60) return 3 // Close
  return 4 // Best friend / partner
}
```

- [ ] **Step 5: Typecheck and existing tests**

```bash
npx tsc -b
npx vitest run
```

Expected: `tsc -b` prints nothing. `vitest run` -- all existing tests still pass (this task doesn't touch `computeEnergy`/`computeStreak`'s own logic, only how their results are delivered to Postgres, and `relationshipLevel`'s existing behavior/signature is unchanged, only a comment added).

- [ ] **Step 6: Manual verification**

This needs a live Supabase connection with the migration applied (Step 2). Using the test user:

1. Send two real chat messages back-to-back as fast as possible (e.g. two `curl -X POST` requests to `/api/chat?user=<test-user-id>` fired without waiting for the first to finish, simulating near-concurrent devices).
2. Query `select interaction_count from character_state where user_id = '<test-user-id>';` afterward.
3. Confirm it increased by exactly 2 from its value before this test, not 1 -- proving the atomic increment doesn't lose a concurrent write the way the old client-computed `priorState.interaction_count + 1` could.

If no live Supabase connection is available, report DONE_WITH_CONCERNS with only `tsc -b`/`vitest run` plus a code-level read-through confirming the RPC call replaces the old upsert correctly.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260707010000_atomic_character_turn_upsert.sql api/lib/memory-write.ts api/lib/relationship.ts
git commit -m "Make interaction_count/relationship_level writes atomic via a Postgres RPC"
```
