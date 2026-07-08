# Character v5 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port `reference/character-prototypes/byte_robot_v5.html`'s new capabilities — background toys, three scripted Play states with fumbles, autonomous bored→Play escalation, and native cursor-follow/poke interactivity — into `src/components/Character.tsx`, plus make the three new Play moods LLM-selectable.

**Architecture:** This is a **diff-and-port**, not a redesign — every behavior decision already exists in the reference file. Each task translates one cohesive piece of the vanilla-JS diff into the React component's existing imperative-DOM style (the same style `Character.tsx` already uses for v3→v4), reusing its existing helper functions (`elem`, `arc`, `txt`, `kf`, `setLeg`, `dust`) unchanged.

**Tech Stack:** React 19, TypeScript, SVG via `document.createElementNS` (no rendering library), Vitest.

## Global Constraints

- **Port from the diff against v4, not a wholesale re-translation of v5.** `Character.tsx` already carries fixes the raw prototype doesn't have (e.g. `newyear()` uses `new Date().getUTCFullYear()`; the prototype hardcodes `'2026!'`). Every step below already accounts for this — do not copy anything from `byte_robot_v5.html` that isn't explicitly called out in a step.
- **`'byte:change'` must keep firing from every mood-changing path.** The existing ported `setMood` dispatches `window.dispatchEvent(new CustomEvent<Mood>('byte:change', { detail: m }))` — this is a React-app-specific addition not in the raw prototype, and `MoodBubble.tsx` depends on it to reflect self-directed mood changes (bored-autoplay, poke). Do not bypass `setMood` for any new internal transition.
- **No app-side (`App.tsx`) changes at all.** Investigation confirmed every `setMood()` call already resets `follow.on = false` internally, so the existing idle-move timer and chat-reply mood-setting need zero changes to coexist with native interactivity.
- **`'poke'` is a real `Mood` value, not purely internal** (a correction found during planning — see Task 4) — `window.Byte.current()` can genuinely return `'poke'` while a poke reaction plays, so it must exist in the `Mood` type, the same way `'listening'`/`'talking'` already exist in `Mood` but are excluded from `list()`/`SELECTABLE_MOODS`.
- Every task must independently pass `npm run build`, `npm test`, and `npm run lint` before moving to the next — this file makes several passes over the same functions across tasks, and a broken intermediate state compounds fast in a single 1500+ line component.
- **Known, accepted deviation from the task boundaries below:** Task 1's implementer found that `Character.tsx`'s `M` object (`Record<Mood, () => void>`) requires an entry for every `Mood` value immediately once Task 1 adds `skate`/`playball`/`jam` to that type — even though Task 1 was designed to touch only type files. It correctly added minimal placeholder `skate()`/`playball()`/`jam()` entries to `Character.tsx` to keep the build green. **Task 3 Step 3 replaces these placeholders** rather than inserting fresh entries (which would be a duplicate-object-key error) — this is already reflected in that step's instructions.

---

### Task 1: Type plumbing for the three new Play moods

**Files:**
- Modify: `src/types.ts`
- Modify: `api/lib/types.ts`
- Modify: `api/lib/moods.ts`
- Modify: `src/components/MoodBubble.tsx`
- Modify: `api/lib/moods.test.ts`

**Interfaces:**
- Produces: `Mood` (both files) gains `'skate' | 'playball' | 'jam'`; `MOOD_GROUPS` gains a `'Play'` group; `SELECTABLE_MOODS` includes the three new moods (LLM-selectable, per explicit decision).

- [ ] **Step 1: `src/types.ts`** — add after `'sit'`:

```ts
  | 'sit'
  | 'skate'
  | 'playball'
  | 'jam'
```

- [ ] **Step 2: `api/lib/types.ts`** — same addition, same position (this file's `Mood` union must mirror `src/types.ts` exactly per its own header comment).

- [ ] **Step 3: `api/lib/moods.ts`** — add a `'Play'` group after `'Moves'`:

```ts
  {
    label: 'Play (fun toy routines -- a real little scene, not a quick flourish)',
    moods: ['skate', 'playball', 'jam'],
  },
```

- [ ] **Step 4: `src/components/MoodBubble.tsx`** — `MOOD_LABELS` is `Record<Mood, string>` (exhaustive — `tsc` will fail without this). Add after `sit: '🪑 sit',`:

```ts
  skate: '🛹 skate',
  playball: '⚽ playball',
  jam: '🎧 jam',
```

- [ ] **Step 5: `api/lib/moods.test.ts`** — add a new test case:

```ts
  it('includes the Play group moods', () => {
    expect(SELECTABLE_MOODS).toContain('skate')
    expect(SELECTABLE_MOODS).toContain('playball')
    expect(SELECTABLE_MOODS).toContain('jam')
  })
```

- [ ] **Step 6: Verify**

Run: `npm test` — expect PASS (existing tests + the new one).
Run: `npm run build` — expect PASS (this is the step that would fail if `MoodBubble.tsx` were missed, since `Record<Mood, string>` is exhaustive).
Run: `npm run lint` — expect PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts api/lib/types.ts api/lib/moods.ts src/components/MoodBubble.tsx api/lib/moods.test.ts
git commit -m "feat: add skate/playball/jam as LLM-selectable moods"
```

---

### Task 2: Toys — SVG markup, refs, at-rest rendering

**Files:**
- Modify: `src/components/Character.tsx`

**Interfaces:**
- Produces: SVG elements `#toys` (containing `#boomB`/`#spkL`/`#spkR`/`#bn0`/`#bn1`/`#bn2`, `#skateB`/`#wspL`/`#wspR`), and `#ballB`/`#ballSpin` — always rendered, positioned by frame-local `bdX`/`bdRot`/`ballX`/`ballY`/`spk`/`jamOn` (default "at rest" values for now; Task 3 makes Play routines override them).

- [ ] **Step 1: Add refs**

In the `useEffect`, immediately after the existing `const handR = q<SVGGElement>('#handR')` line, add:

```ts
    const skateB = q<SVGGElement>('#skateB')
    const wspL = q<SVGLineElement>('#wspL')
    const wspR = q<SVGLineElement>('#wspR')
    const ballB = q<SVGGElement>('#ballB')
    const ballSpin = q<SVGGElement>('#ballSpin')
    const spkL = q<SVGGElement>('#spkL')
    const spkR = q<SVGGElement>('#spkR')
    const bn0 = q<SVGTextElement>('#bn0')
    const bn1 = q<SVGTextElement>('#bn1')
    const bn2 = q<SVGTextElement>('#bn2')
```

- [ ] **Step 2: Add the JSX markup**

In the component's `return (...)`, the toys group goes between `<g id="fx" />` and `<g id="rootG">`:

```tsx
      <g id="fx" />
      <g id="toys">
        <g id="boomB">
          <path d="M270 249 Q284 237 298 249" fill="none" stroke="#3A4470" strokeWidth={3.5} />
          <rect x={262} y={248} width={44} height={28} rx={5} fill="#2C3350" stroke="#3A4470" strokeWidth={3} />
          <g id="spkL">
            <circle cx={273} cy={263} r={6.5} fill="#0A0C14" stroke="#3A4470" strokeWidth={2.5} />
            <circle cx={273} cy={263} r={2} fill="#3FE0D0" />
          </g>
          <g id="spkR">
            <circle cx={295} cy={263} r={6.5} fill="#0A0C14" stroke="#3A4470" strokeWidth={2.5} />
            <circle cx={295} cy={263} r={2} fill="#3FE0D0" />
          </g>
          <circle cx={284} cy={253} r={2} fill="#F2C94C" />
          <text id="bn0" x={278} y={244} fontSize={13} textAnchor="middle" fontFamily="sans-serif" fontWeight="bold" fill="#F2C94C" opacity={0}>
            ♪
          </text>
          <text id="bn1" x={291} y={240} fontSize={11} textAnchor="middle" fontFamily="sans-serif" fontWeight="bold" fill="#F2C94C" opacity={0}>
            ♫
          </text>
          <text id="bn2" x={284} y={248} fontSize={12} textAnchor="middle" fontFamily="sans-serif" fontWeight="bold" fill="#F2C94C" opacity={0}>
            ♪
          </text>
        </g>
        <g id="skateB">
          <circle cx={70} cy={269} r={5.5} fill="#0A0C14" stroke="#3A4470" strokeWidth={2.5} />
          <line id="wspL" x1={70} y1={269} x2={70} y2={264.5} stroke="#3FE0D0" strokeWidth={2} />
          <circle cx={98} cy={269} r={5.5} fill="#0A0C14" stroke="#3A4470" strokeWidth={2.5} />
          <line id="wspR" x1={98} y1={269} x2={98} y2={264.5} stroke="#3FE0D0" strokeWidth={2} />
          <rect x={60} y={255} width={48} height={8} rx={4} fill="#2C3350" stroke="#3A4470" strokeWidth={2.5} />
          <rect x={66} y={258} width={36} height={2.4} rx={1.2} fill="#3FE0D0" opacity={0.65} />
        </g>
      </g>
      <g id="rootG">
```

The existing `rootG` content is unchanged. Immediately after `rootG`'s closing `</g>` and before the closing `</svg>`, add:

```tsx
      </g>
      <g id="ballB">
        <g id="ballSpin">
          <circle cx={244} cy={263} r={12} fill="#2C3350" stroke="#3A4470" strokeWidth={3} />
          <path d="M233.5 258 Q244 268 254.5 258" fill="none" stroke="#3FE0D0" strokeWidth={3.2} />
          <circle cx={244} cy={255.5} r={2} fill="#F2C94C" />
        </g>
      </g>
    </svg>
```

(`ballB` is a sibling placed *after* `rootG`, matching the reference file's z-order — the ball renders in front of Byte when they overlap, e.g. during a header-height throw in the `playball` routine.)

- [ ] **Step 3: Add default toy-position variables in `renderFrame`**

Immediately after the existing `let hR = { dx: -Math.sin(t / 640) * 1.2, dy: Math.sin(t / 430 + 1.7) * 2.4 }` line, before `if (extra.shake) {`:

```ts
      let bdX = 84
      let bdRot = 0
      let ballX = 244
      let ballY = 263
      let spk = 1
      let jamOn = false
```

- [ ] **Step 4: Apply toy transforms every frame**

In the "apply transforms" section, immediately after `shadow.setAttribute('opacity', (0.12 * (0.35 + 0.65 * ss)).toFixed(3))` and before `let tilt = (extra.tilt || 0) + headAdd`:

```ts
      // ---- toys ----
      skateB.setAttribute('transform', `translate(${(bdX - 84).toFixed(2)} 0) rotate(${(bdRot % 360).toFixed(1)} 84 264)`)
      const wsp = ((bdX * 5) % 360).toFixed(1)
      wspL.setAttribute('transform', `rotate(${wsp} 70 269)`)
      wspR.setAttribute('transform', `rotate(${wsp} 98 269)`)
      ballB.setAttribute('transform', `translate(${(ballX - 244).toFixed(2)} ${(ballY - 263).toFixed(2)})`)
      ballSpin.setAttribute('transform', `rotate(${(((ballX - 244) * 4) % 360).toFixed(1)} 244 263)`)
      const sps = spk.toFixed(3)
      spkL.setAttribute('transform', `translate(273 263) scale(${sps}) translate(-273 -263)`)
      spkR.setAttribute('transform', `translate(295 263) scale(${sps}) translate(-295 -263)`)
      const notes = [bn0, bn1, bn2]
      notes.forEach((n, i) => {
        if (jamOn) {
          const c = (t / 1400 + i * 0.37) % 1
          n.setAttribute('opacity', (Math.sin(Math.PI * c) * 0.9).toFixed(2))
          n.setAttribute('y', (246 - 64 * c).toFixed(1))
          n.setAttribute('x', (284 + Math.sin(c * 7 + i * 2) * 7).toFixed(1))
        } else {
          n.setAttribute('opacity', '0')
        }
      })
```

- [ ] **Step 5: Verify**

Run: `npm run build` — expect PASS, no type errors.
Run: `npm test` — expect PASS.
Run: `npm run lint` — expect PASS.

- [ ] **Step 6: Manual smoke check**

Start `npm run dev`, open the app. Confirm the skateboard, ball, and boombox are visible at rest near Byte's feet (skateboard/boombox behind him, ball in front) in every mood — they should never disappear, just sit there as set-dressing (they won't move yet — that's Task 3).

- [ ] **Step 7: Commit**

```bash
git add src/components/Character.tsx
git commit -m "feat: add background toys (skateboard, ball, boombox) to the stage"
```

---

### Task 3: Play routines (skate, playball, jam) + bored-autoplay escalation

**Files:**
- Modify: `src/components/Character.tsx`

**Interfaces:**
- Produces: mood functions `skate()`, `playball()`, `jam()`; `renderFrame` blocks for `A === 'skate' | 'ballP' | 'jam'`; a `gait(w, s, l)` closure helper used by all three and by Task 5's follow logic; `bored`'s existing block gains the toy-glance + autonomous-switch escalation.
- Consumes: `bdX`/`bdRot`/`ballX`/`ballY`/`spk`/`jamOn` (Task 2), `Extra.skateDustCycle` (new field, this task).

- [ ] **Step 1: Add an `Extra` interface field**

In the `Extra` interface, add (anywhere among the other optional fields, grouped near the end to match the file's existing "New for..." comment convention):

```ts
  // New for the v5 Play routines: gates the skate wipeout's dust puff to
  // once per routine cycle instead of every frame while the condition holds.
  skateDustCycle?: number
```

- [ ] **Step 2: Add the `gait` helper**

Immediately after the toy-position variables added in Task 2 (`let jamOn = false`), before `if (extra.shake) {`:

```ts
      const gait = (w: number, s: number, l: number) => {
        fL = { dx: Math.sin(w) * s, dy: -Math.max(0, Math.sin(w)) * l }
        fR = { dx: Math.sin(w + Math.PI) * s, dy: -Math.max(0, Math.sin(w + Math.PI)) * l }
        hL.dx -= Math.sin(w) * s * 0.45
        hR.dx += Math.sin(w) * s * 0.45
      }
```

- [ ] **Step 3: Replace the placeholder mood functions with the real implementations**

**Note on why placeholders exist:** Task 1 added `skate`/`playball`/`jam` to the `Mood` union, but `Character.tsx`'s `M` object is typed `Record<Mood, () => void>` — TypeScript's exhaustiveness check immediately required `M` to have all three keys the moment `Mood` gained them, even though the plan's Task 1 was only supposed to touch type files. Task 1's implementer correctly caught this build break and added minimal placeholder `skate()`/`playball()`/`jam()` entries (right after `sit()`) to keep the build green — this was a necessary, unplanned deviation, not an error. **This step replaces those placeholders with the real implementations — find the existing `skate()`/`playball()`/`jam()` entries in the `M` object (already present, right after `sit()`) and replace their bodies entirely** with:

```ts
      skate() {
        screen.append(elem('circle', { cx: exL, cy: cyL, r: 12, fill: TEAL }), elem('circle', { cx: exR, cy: cyL, r: 12, fill: TEAL }))
        const o = txt(208, 72, 22, '!', GOLD)
        o.setAttribute('id', 'oopsT')
        o.setAttribute('opacity', '0')
        topFx.append(o)
        extra.blink = true
        extra.anim = 'skate'
      },
      playball() {
        screen.append(elem('circle', { cx: exL, cy: cyL, r: 12, fill: TEAL }), elem('circle', { cx: exR, cy: cyL, r: 12, fill: TEAL }))
        const o = txt(208, 72, 22, '!', GOLD)
        o.setAttribute('id', 'oopsT')
        o.setAttribute('opacity', '0')
        topFx.append(o)
        extra.blink = true
        extra.anim = 'ballP'
      },
      jam() {
        screen.append(arc(`M${exL - 12} ${cyL} Q${exL} ${cyL + 9} ${exL + 12} ${cyL}`), arc(`M${exR - 12} ${cyL} Q${exR} ${cyL + 9} ${exR + 12} ${cyL}`))
        const o = txt(208, 72, 22, '!', GOLD)
        o.setAttribute('id', 'oopsT')
        o.setAttribute('opacity', '0')
        topFx.append(o)
        extra.blink = true
        extra.anim = 'jam'
      },
```

- [ ] **Step 4: Add the three `renderFrame` animation blocks**

Immediately after the existing `if (A === 'wave') { ... }` block, before the `// ---- personality body language ...` comment, add all three blocks:

```ts
      if (A === 'skate') {
        // his signature toy
        const TT = 13000
        const p = (t % TT) / TT
        const cyc = Math.floor(t / TT)
        rot = 0
        const stance = (lean: number) => {
          ty = -13 + Math.sin(t / 300) * 0.8
          rot = lean
          rotCy = 250
          fL = { dx: 20, dy: -8 }
          fR = { dx: -20, dy: -8 }
          hL = { dx: -12, dy: -9 + Math.sin(t / 400) * 1.5 }
          hR = { dx: 12, dy: -9 + Math.sin(t / 400 + 1) * 1.5 }
        }
        if (p < 0.14) {
          if (cyc === 0) {
            tx = kf(p, [
              [0, 0],
              [0.11, -64],
              [0.14, -64],
            ])
            face = -1
            if (p < 0.11) {
              gait(t / 140, 10, 10)
              ty = -Math.abs(Math.sin(t / 140)) * 3
            } else {
              const q = (p - 0.11) / 0.03
              ty = kf(p, [
                [0.11, 0],
                [0.122, -20],
                [0.14, -13],
              ])
              fL = { dx: 20 * q, dy: -8 * q }
              fR = { dx: -20 * q, dy: -8 * q }
              hL = { dx: -12 * q, dy: -9 * q }
              hR = { dx: 12 * q, dy: -9 * q }
            }
          } else {
            tx = -64
            face = 1
            stance(Math.sin(t / 500) * 2)
          }
        } else if (p < 0.34) {
          tx = kf(p, [
            [0.14, -64],
            [0.34, 72],
          ])
          face = 1
          stance(4)
          if (p < 0.21) {
            const pp = (p - 0.14) / 0.07
            fR = { dx: -12 + Math.sin(pp * 12.6) * 12, dy: 13 }
          }
        } else if (p < 0.38) {
          tx = 72
          face = p < 0.36 ? 1 : -1
          stance(0)
          ty = kf(p, [
            [0.34, -13],
            [0.36, -21],
            [0.38, -13],
          ])
        } else if (p < 0.58) {
          tx = kf(p, [
            [0.38, 72],
            [0.58, -30],
          ])
          face = -1
          stance(4)
        } else if (p < 0.64) {
          tx = -30
          face = -1
          stance(0)
          rot =
            Math.sin(t / 55) *
            kf(p, [
              [0.58, 2],
              [0.64, 11],
            ])
          hL = { dx: -10 + Math.cos(t / 60) * 11, dy: -14 + Math.sin(t / 60) * 11 }
          hR = { dx: 10 + Math.cos(t / 60 + 2) * 11, dy: -14 + Math.sin(t / 60 + 2) * 11 }
        } else if (p < 0.7) {
          tx = -26
          face = -1
          ty = kf(p, [
            [0.64, -13],
            [0.66, -24],
            [0.7, 26],
          ])
          const q = Math.max(0, Math.min(1, (p - 0.66) / 0.04))
          fL = { dx: -18 * q, dy: -6 - 20 * q * q }
          fR = { dx: 18 * q, dy: -6 - 20 * q * q }
          hL = {
            dx: -6,
            dy: kf(p, [
              [0.64, -14],
              [0.7, 18],
            ]),
          }
          hR = {
            dx: 6,
            dy: kf(p, [
              [0.64, -14],
              [0.7, 18],
            ]),
          }
          if (p > 0.695 && extra.skateDustCycle !== cyc) {
            extra.skateDustCycle = cyc
            dust(160 + tx)
          }
        } else if (p < 0.8) {
          tx = -26
          face = -1
          ty = 26 + Math.sin(t / 600) * 0.8
          fL = { dx: -18, dy: -26 }
          fR = { dx: 18, dy: -26 }
          hL = { dx: -4, dy: 18 }
          hR = { dx: 4, dy: 18 }
          headAdd +=
            Math.sin(t / 170) *
            8 *
            kf(p, [
              [0.7, 1],
              [0.8, 0],
            ])
        } else if (p < 0.92) {
          face = -1
          ty = kf(p, [
            [0.8, 26],
            [0.84, 0],
            [0.92, 0],
          ])
          tx = kf(p, [
            [0.8, -26],
            [0.84, -26],
            [0.92, -76],
          ])
          if (p > 0.84) {
            gait(t / 150, 9, 9)
          } else {
            const gq = Math.min(1, (p - 0.8) / 0.04)
            fL = { dx: -18 * (1 - gq), dy: -26 * (1 - gq) }
            fR = { dx: 18 * (1 - gq), dy: -26 * (1 - gq) }
          }
        } else {
          tx = kf(p, [
            [0.92, -76],
            [0.96, -76],
            [1, -64],
          ])
          face = 1
          ty = kf(p, [
            [0.92, 0],
            [0.94, -18],
            [0.96, -13],
            [1, -13],
          ])
          const q = Math.min(1, (p - 0.92) / 0.03)
          fL = { dx: 20 * q, dy: -8 * q }
          fR = { dx: -20 * q, dy: -8 * q }
          hL = { dx: -12, dy: -9 }
          hR = { dx: 12, dy: -9 }
          rot = 0
        }
        bdX = cyc === 0 && p < 0.11 ? 84 : p < 0.64 ? 160 + tx - 12 : p < 0.7 ? kf(p, [[0.64, 118], [0.7, 72]]) : p < 0.92 ? 72 : 160 + tx - 12
        bdRot = kf(p, [
          [0, 0],
          [0.64, 0],
          [0.7, -360],
          [1, -360],
        ])
        const oo = svg?.querySelector<SVGTextElement>('#oopsT')
        if (oo)
          oo.setAttribute(
            'opacity',
            kf(p, [
              [0.6, 0],
              [0.615, 1],
              [0.7, 1],
              [0.75, 0],
            ]).toFixed(2)
          )
      }
      if (A === 'ballP') {
        // kick, chase... bonk
        const TT = 10000
        const p = (t % TT) / TT
        tx = kf(p, [
          [0, 0],
          [0.09, 64],
          [0.13, 64],
          [0.16, 58],
          [0.4, -46],
          [0.425, -56],
          [0.46, -52],
          [0.52, -52],
          [0.575, -44],
          [0.72, 20],
          [0.88, 20],
          [1, 0],
        ])
        face = p < 0.13 || (p >= 0.52 && p < 0.88) ? 1 : -1
        if (p < 0.09) {
          gait(t / 95, 12, 12)
          ty = -Math.abs(Math.sin(t / 95)) * 5
          rot = 5
        } else if (p < 0.13) {
          rot = kf(p, [
            [0.09, 0],
            [0.11, -5],
            [0.13, 2],
          ])
          fR = {
            dx: kf(p, [
              [0.09, -10],
              [0.112, 30],
              [0.13, 0],
            ]),
            dy: kf(p, [
              [0.09, 0],
              [0.112, -12],
              [0.13, 0],
            ]),
          }
          hL = { dx: -8, dy: -14 }
          hR = { dx: 8, dy: -10 }
        } else if (p < 0.4) {
          gait(t / 110, 11, 11)
          ty = -Math.abs(Math.sin(t / 110)) * 4
          rot = 4
        } else if (p < 0.46) {
          rot = kf(p, [
            [0.4, 0],
            [0.425, 17],
            [0.445, -6],
            [0.46, 0],
          ])
          rotCy = 252
          fR = {
            dx: kf(p, [
              [0.4, -10],
              [0.42, 32],
              [0.46, 0],
            ]),
            dy: kf(p, [
              [0.4, 0],
              [0.42, -12],
              [0.46, 0],
            ]),
          }
          hL = { dx: -10, dy: -16 }
          hR = { dx: 10, dy: -12 }
        } else if (p < 0.52) {
          headAdd += 6
          hR = { dx: -6, dy: -10 }
        } else if (p < 0.575) {
          rot = kf(p, [
            [0.52, 0],
            [0.545, -5],
            [0.56, 3],
            [0.575, 0],
          ])
          fR = {
            dx: kf(p, [
              [0.52, -10],
              [0.545, 30],
              [0.575, 0],
            ]),
            dy: kf(p, [
              [0.52, 0],
              [0.545, -12],
              [0.575, 0],
            ]),
          }
          hL = { dx: -8, dy: -14 }
          hR = { dx: 8, dy: -10 }
        } else if (p < 0.72) {
          gait(t / 120, 10, 10)
          ty = -Math.abs(Math.sin(t / 120)) * 3
          rot = 3
        } else if (p < 0.75) {
          ty = kf(p, [
            [0.72, 0],
            [0.735, 0],
            [0.745, 4],
            [0.75, 2],
          ])
          headDy += kf(p, [
            [0.73, 0],
            [0.745, 5],
            [0.75, 3],
          ])
        } else if (p < 0.88) {
          headAdd +=
            Math.sin(t / 180) *
            9 *
            kf(p, [
              [0.75, 1],
              [0.88, 0],
            ])
          rot =
            Math.sin(t / 300) *
            3 *
            kf(p, [
              [0.75, 1],
              [0.88, 0],
            ])
          headDy += kf(p, [
            [0.75, 3],
            [0.8, 0],
          ])
          hL = { dx: -8 + Math.sin(t / 300) * 4, dy: -10 }
          hR = { dx: 8 - Math.sin(t / 300) * 4, dy: -10 }
        } else {
          gait(t / 150, 8, 8)
          ty = -Math.abs(Math.sin(t / 150)) * 2
        }
        ballX = kf(p, [
          [0, 244],
          [0.112, 244],
          [0.13, 244],
          [0.24, 24],
          [0.3, 70],
          [0.36, 104],
          [0.42, 124],
          [0.545, 124],
          [0.575, 150],
          [0.66, 300],
          [0.7, 240],
          [0.735, 186],
          [0.755, 186],
          [0.8, 204],
          [0.95, 244],
          [1, 244],
        ])
        ballY = kf(p, [
          [0, 263],
          [0.13, 263],
          [0.185, 178],
          [0.24, 220],
          [0.28, 186],
          [0.33, 236],
          [0.375, 214],
          [0.42, 263],
          [0.545, 263],
          [0.6, 150],
          [0.66, 196],
          [0.705, 108],
          [0.735, 84],
          [0.76, 240],
          [0.79, 206],
          [0.83, 263],
          [0.95, 263],
        ])
        const oo = svg?.querySelector<SVGTextElement>('#oopsT')
        if (oo) {
          const f1 = kf(p, [
            [0.405, 0],
            [0.42, 1],
            [0.47, 1],
            [0.505, 0],
          ])
          const f2 = kf(p, [
            [0.73, 0],
            [0.745, 1],
            [0.8, 1],
            [0.84, 0],
          ])
          oo.setAttribute('opacity', Math.max(f1, f2).toFixed(2))
        }
      }
      if (A === 'jam') {
        // DJ soul: press play, groove, spin too hard
        const TT = 9000
        const p = (t % TT) / TT
        const cyc = Math.floor(t / TT)
        tx = 56
        face = 1
        jamOn = cyc > 0 || p > 0.145
        if (jamOn) spk = 1 + Math.abs(Math.sin(t / 220)) * 0.18
        if (cyc === 0 && p < 0.1) {
          tx = kf(p, [
            [0, 0],
            [0.1, 56],
          ])
          gait(t / 150, 10, 10)
          ty = -Math.abs(Math.sin(t / 150)) * 3
          rot = 3
        } else if (cyc === 0 && p < 0.17) {
          rot = kf(p, [
            [0.1, 0],
            [0.125, 9],
            [0.15, 9],
            [0.17, 0],
          ])
          rotCy = 258
          hR = {
            dx: 8,
            dy: kf(p, [
              [0.1, 0],
              [0.125, 46],
              [0.15, 42],
              [0.17, 0],
            ]),
          }
          hL = { dx: 2, dy: 3 }
        } else if (p < 0.6 || p >= 0.88) {
          const dw = Math.sin(t / 220)
          rot = dw * 5
          ty = -Math.abs(dw) * 6
          headAdd += Math.sin(t / 220) * 2
          hL = { dx: -3, dy: dw * 9 - 3 }
          hR = { dx: 3, dy: -dw * 9 - 3 }
          fL = { dx: dw * 5, dy: -Math.max(0, dw) * 4 }
          fR = { dx: -dw * 5, dy: -Math.max(0, -dw) * 4 }
        } else if (p < 0.7) {
          const q = (p - 0.6) / 0.1
          sxb = Math.cos(q * q * 12.6)
          ty = -3
          fL = { dx: 0, dy: -3 }
          fR = { dx: 0, dy: -3 }
          hL = { dx: -5, dy: -9 }
          hR = { dx: 5, dy: -9 }
        } else if (p < 0.88) {
          rot = Math.sin(t / 300) * 4
          rotCy = 252
          headAdd +=
            Math.sin(t / 230) *
            8 *
            kf(p, [
              [0.7, 1],
              [0.86, 0],
            ])
          hL = { dx: -9 + Math.sin(t / 300) * 5, dy: -10 }
          hR = { dx: 9 - Math.sin(t / 300) * 5, dy: -10 }
          fL = { dx: Math.sin(t / 600) * 3, dy: 0 }
          fR = { dx: Math.sin(t / 600 + 2) * 3, dy: 0 }
        }
        const oo = svg?.querySelector<SVGTextElement>('#oopsT')
        if (oo)
          oo.setAttribute(
            'opacity',
            kf(p, [
              [0.695, 0],
              [0.71, 1],
              [0.78, 1],
              [0.83, 0],
            ]).toFixed(2)
          )
      }
```

- [ ] **Step 5: Add the bored-autoplay escalation**

In the existing `else if (P === 'bored') {` block, immediately after `const p = (t % 5200) / 5200` and before `ty = 6 + kf(p, [`, insert:

```ts
        if (t > 8600) {
          setMood(['skate', 'playball', 'jam'][Math.floor(Math.random() * 3)] as Mood)
          return
        }
        if (t > 6600) {
          headAdd += kf((t - 6600) / 2000, [
            [0, 0],
            [0.25, -7],
            [0.45, -7],
            [0.62, 7],
            [1, 7],
          ])
        }
```

- [ ] **Step 6: Verify**

Run: `npm run build` — expect PASS.
Run: `npm test` — expect PASS.
Run: `npm run lint` — expect PASS.

- [ ] **Step 7: Manual smoke check**

In the browser console: `window.Byte.set('skate')` — confirm the full ~13s routine plays (push off, glide, hop-turn, glide back, wobble, wipe out with a dust puff, sit for a beat, fetch the board, hop back on). Same for `window.Byte.set('playball')` (~10s: kick, chase, whiff, stare, kick again, chase, bonk, dazed, walk it off) and `window.Byte.set('jam')` (~9s: walk to the boombox, press play, groove, over-spin, dizzy recovery). Then `window.Byte.set('bored')` and wait ~9 seconds without touching anything — confirm he glances at the toys around 6.6s and autonomously switches into a random Play routine around 8.6s.

- [ ] **Step 8: Commit**

```bash
git add src/components/Character.tsx
git commit -m "feat: port skate/playball/jam Play routines and bored-autoplay escalation"
```

---

### Task 4: Poke reaction

**Files:**
- Modify: `src/components/Character.tsx`
- Modify: `src/types.ts`
- Modify: `src/components/MoodBubble.tsx`
- Modify: `src/byte-global.d.ts`

**Interfaces:**
- Produces: `Mood` gains `'poke'` (real value, excluded from `list()` and from `MOOD_GROUPS`/`SELECTABLE_MOODS` — same pattern as `'listening'`/`'talking'`); `window.Byte.pos(): number`, `window.Byte.poke(variant?: number): void`.
- Consumes: `lastTx` (declared this task), `svg` (existing ref).

**Note on `'poke'` being a real `Mood` value:** `M`'s existing type is `Record<Mood, () => void>`, and `poke()` needs an entry in `M` — TypeScript's exhaustive mapped-type object literal would reject an extra `poke` key not in `Mood`. Rather than widen `M`'s type away from the codebase's existing single-source-of-truth pattern, `'poke'` is added to `Mood` itself, exactly like `'listening'`/`'talking'` already are — present in the type, deliberately absent from `list()`'s output and from `api/lib/moods.ts`'s `MOOD_GROUPS` (so the LLM can never pick it and `SELECTABLE_MOODS` never includes it). Only `src/types.ts` needs this — `api/lib/types.ts`'s `Mood` union does **not** need `'poke'`, since the backend never sets or validates it (the LLM never emits `'poke'`; it's purely a client-side click reaction).

- [ ] **Step 1: Add `'poke'` to `src/types.ts`'s `Mood` union**

Add after `'jam'` (from Task 1):

```ts
  | 'jam'
  // Set only by a click/tap reaction inside Character.tsx -- never
  // externally set, never in list()/SELECTABLE_MOODS, same treatment as
  // 'listening'/'talking' below.
  | 'poke'
```

- [ ] **Step 2: Add a label in `MoodBubble.tsx`**

`MOOD_LABELS` is exhaustive over `Mood` — add:

```ts
  poke: '👉 poke',
```

- [ ] **Step 3: Add `Extra` interface fields** (`Character.tsx`)

```ts
  // New for the v5 poke reaction: which of the three variants is playing
  // (0 tickled, 1 startled hop, 2 annoyed swat), which side he was poked
  // from, the mood to restore afterward, and a one-shot latch so the
  // startled-hop's dust puff only spawns once per poke.
  pokeVariant?: number
  pokeSide?: number
  pokeReturnTo?: Mood
  pokeDustSpawned?: boolean
```

- [ ] **Step 4: Add shared interactivity state**

Immediately after the existing `let lastAir = 0` (near the top of the effect, alongside `let currentMood`, `let t`, etc.):

```ts
    let simT = 0
    let lastTx = 0
    let interactive = true
    let pendingPokeVariant = 0
    let pokeCount = 0
    let lastPokeTime = -9e9
    const follow = { on: false, arr: 0 }
```

(`wx` and `pointer` are **not** declared here, even though the reference file declares them in the same group — verified empirically (`tsc -b --noEmit` against a scratch file) that this project's `noUnusedLocals: true` turns a declared-but-never-read local into a hard build error, `TS6133`, not just a lint warning. Neither `wx` nor `pointer` is read anywhere in this task's code — only `follow` is (via `follow.on = false` in Step 6, a property write, which itself reads the `follow` binding and satisfies `noUnusedLocals`). Task 5 declares `wx`/`pointer` where they're actually used.)

- [ ] **Step 5: Increment `simT`**

In `renderFrame`, change the first line from `t += dt` to:

```ts
      t += dt
      simT += dt
```

- [ ] **Step 6: Reset `follow.on` on every mood change**

In `setMood`, immediately after `currentMood = m` and `t = 0`:

```ts
      follow.on = false
```

(Task 5 adds the `wx` reset for Play states right after this line, once `wx` exists.)

- [ ] **Step 7: Add the `poke()` mood function**

In the `M` object, immediately after the existing `dozing()` entry and before `birthday()` (matching the reference file's placement — this keeps the diff minimal and groups it near the other "health/rare state" moods rather than the Play routines, which is where the reference file itself puts it):

```ts
      poke() {
        if (pendingPokeVariant === 1) {
          screen.append(elem('circle', { cx: exL, cy: cyL, r: 13, fill: TEAL }), elem('circle', { cx: exR, cy: cyL, r: 13, fill: TEAL }))
          const o = txt(208, 72, 22, '!', GOLD)
          o.setAttribute('id', 'oopsT')
          o.setAttribute('opacity', '0')
          topFx.append(o)
        } else if (pendingPokeVariant === 2) {
          screen.append(
            elem('path', { d: `M${exL - 13} ${cyL - 6} L${exL + 13} ${cyL - 1}`, stroke: TEAL, 'stroke-width': 6, 'stroke-linecap': 'round' }),
            eye(exL, cyL + 2, 22, 12, 5),
            elem('path', { d: `M${exR - 13} ${cyL - 1} L${exR + 13} ${cyL - 6}`, stroke: TEAL, 'stroke-width': 6, 'stroke-linecap': 'round' }),
            eye(exR, cyL + 2, 22, 12, 5)
          )
        } else {
          screen.append(arc(`M${exL - 12} ${cyL - 4} Q${exL} ${cyL + 8} ${exL + 12} ${cyL - 4}`), arc(`M${exR - 12} ${cyL - 4} Q${exR} ${cyL + 8} ${exR + 12} ${cyL - 4}`))
          topFx.append(txt(160, 74, 16, 'hehe!', GOLD))
        }
      },
```

- [ ] **Step 8: Add the `P === 'poke'` personality block**

Immediately after the existing `else if (P === 'challenging') { ... }` block closes, before `else if (P === 'bored')`:

```ts
      } else if (P === 'poke') {
        // poked! three possible reactions
        const q = Math.min(1, t / 950)
        const v = extra.pokeVariant ?? 0
        face = extra.pokeSide ?? 1
        if (v === 0) {
          // tickled
          sxb = 1 + Math.sin(t / 45) * 0.05 * (1 - q)
          ty = -Math.abs(Math.sin(t / 90)) * 5 * (1 - q)
          rot = Math.sin(t / 70) * 3 * (1 - q)
          headAdd += Math.sin(t / 60) * 4 * (1 - q)
          hL = { dx: -9, dy: 6 }
          hR = { dx: 9, dy: 6 }
        } else if (v === 1) {
          // startled hop
          ty = kf(q, [
            [0, 0],
            [0.18, -26],
            [0.42, 0],
            [0.55, -6],
            [0.68, 0],
            [1, 0],
          ])
          headDy += kf(q, [
            [0, 0],
            [0.12, -3],
            [0.42, 2],
            [0.6, 0],
          ])
          hL = { dx: -16, dy: -30 }
          hR = { dx: 16, dy: -30 }
          fL = { dx: -4, dy: 0 }
          fR = { dx: 4, dy: 0 }
          if (q > 0.4 && !extra.pokeDustSpawned) {
            extra.pokeDustSpawned = true
            dust(160 + lastTx)
          }
          const oo = svg?.querySelector<SVGTextElement>('#oopsT')
          if (oo)
            oo.setAttribute(
              'opacity',
              kf(q, [
                [0, 0],
                [0.08, 1],
                [0.6, 1],
                [0.82, 0],
              ]).toFixed(2)
            )
        } else {
          // enough. the swat.
          rot = kf(q, [
            [0, 0],
            [0.25, -6],
            [0.5, 4],
            [1, 0],
          ])
          rotCy = 252
          hR = {
            dx: kf(q, [
              [0, 8],
              [0.3, 36],
              [0.55, -6],
              [0.85, 10],
            ]),
            dy: kf(q, [
              [0, -8],
              [0.3, -18],
              [0.55, -4],
              [1, -6],
            ]),
          }
          hL = { dx: -10, dy: 2 }
          fR = {
            dx: kf(q, [
              [0.48, 0],
              [0.6, 7],
              [0.72, 0],
            ]),
            dy: kf(q, [
              [0.48, 0],
              [0.6, -9],
              [0.72, 0],
            ]),
          }
          headAdd += kf(q, [
            [0, 0],
            [0.3, 7],
            [0.7, -3],
            [1, 0],
          ])
        }
        if (t > 980) {
          const backTo = extra.pokeReturnTo
          setMood(backTo && M[backTo] ? backTo : 'neutral')
          return
        }
      }
```

- [ ] **Step 9: Add the `poke()` trigger function, hit-testing helpers, and the click listener**

Immediately after `renderFrame`'s closing `}`, before `function loop(now: number) {`:

```ts
    function poke(px: number | null, forceVariant: number | null = null) {
      if (currentMood === 'poke' && t < 380) return
      const backTo = currentMood === 'poke' ? (extra.pokeReturnTo ?? 'neutral') : currentMood
      pokeCount = simT - lastPokeTime < 4200 ? pokeCount + 1 : 1
      lastPokeTime = simT
      const variant = forceVariant ?? (pokeCount >= 3 ? 2 : Math.floor(Math.random() * 2))
      pendingPokeVariant = variant
      const side = px != null && px < 160 + lastTx ? -1 : 1
      setMood('poke')
      extra.pokeReturnTo = backTo
      extra.pokeVariant = variant
      extra.pokeSide = side
    }

    const svgPoint = (e: PointerEvent) => {
      const r = svg.getBoundingClientRect()
      if (!r.width || !r.height) return null
      const s = Math.min(r.width / 320, r.height / 300)
      return { x: (e.clientX - r.left - (r.width - 320 * s) / 2) / s, y: (e.clientY - r.top - (r.height - 300 * s) / 2) / s }
    }
    const hitCharacter = (p: { x: number; y: number } | null) => !!p && Math.abs(p.x - (160 + lastTx)) < 62 && p.y > 54 && p.y < 284

    function handlePointerDown(e: PointerEvent) {
      if (!interactive) return
      const p = svgPoint(e)
      if (p && hitCharacter(p)) poke(p.x)
    }
    svg.addEventListener('pointerdown', handlePointerDown)
```

- [ ] **Step 10: Expand `window.Byte`**

Replace the existing:

```ts
    window.Byte = {
      set: setMood,
      list: () => Object.keys(M) as Mood[],
    }
```

with:

```ts
    window.Byte = {
      set: setMood,
      list: () => (Object.keys(M) as Mood[]).filter((m) => m !== 'poke'),
      pos: () => 160 + lastTx,
      poke: (variant?: number) => poke(null, typeof variant === 'number' ? variant : null),
    }
```

- [ ] **Step 11: Remove the listener on unmount**

In the effect's cleanup function, add the removal:

```ts
    return () => {
      cancelAnimationFrame(rafId)
      svg.removeEventListener('pointerdown', handlePointerDown)
      delete window.Byte
    }
```

- [ ] **Step 12: Update the `Window.Byte` type**

In `src/byte-global.d.ts`:

```ts
declare global {
  interface Window {
    Byte?: {
      set(name: Mood): void
      list(): Mood[]
      pos(): number
      poke(variant?: number): void
    }
  }
}
```

- [ ] **Step 13: Verify**

Run: `npm run build` — expect PASS.
Run: `npm test` — expect PASS.
Run: `npm run lint` — expect PASS.

- [ ] **Step 14: Manual smoke check**

Click directly on Byte's body in the browser — confirm a ~1s reaction plays (giggle or startled hop with a dust puff), then he returns to whatever mood he was in, and the mood bubble briefly shows "👉 poke" during the reaction. Click 3+ times within ~4 seconds — confirm the reaction becomes the annoyed swat. Click somewhere clearly off his body — confirm nothing happens. Try `window.Byte.poke(2)` in the console — confirm it forces the swat variant directly.

- [ ] **Step 15: Commit**

```bash
git add src/components/Character.tsx src/types.ts src/components/MoodBubble.tsx src/byte-global.d.ts
git commit -m "feat: port click-to-poke reaction (giggle/startled-hop/annoyed-swat)"
```

---

### Task 5: Cursor-follow (watch, chase, arrive)

**Files:**
- Modify: `src/components/Character.tsx`
- Modify: `src/byte-global.d.ts`

**Interfaces:**
- Produces: `window.Byte.interactive(enabled: boolean): void`; declares `wx: number` and `pointer: {x,y,t,in}` (deliberately not declared in Task 4 — see that task's Step 4 note on `noUnusedLocals`).
- Consumes: `follow`/`lastTx`/`interactive`/`svgPoint`/`hitCharacter`/`gait` (Tasks 3 and 4).

- [ ] **Step 1: Declare `wx` and `pointer`, and reset `wx` for Play states**

Immediately after the shared state declared in Task 4 Step 4 (right after `const follow = { on: false, arr: 0 }`):

```ts
    let wx = 0
    const pointer = { x: 160, y: 140, t: -9e9, in: false }
```

Then, in `setMood`, immediately after Task 4's `follow.on = false` line:

```ts
      if (m === 'skate' || m === 'playball' || m === 'jam') wx = 0
```

- [ ] **Step 2: Add the follow/head-track logic**

In `renderFrame`, immediately after the "landing detection -> dust puff" block (`dusts = dusts.filter(...)`) and before `// ---- apply transforms ----`, insert:

```ts
      // ---- cursor interactivity: watch, chase, arrive ----
      const byteX = 160 + lastTx
      const followOk =
        P === 'happy' ||
        P === 'excited' ||
        P === 'content' ||
        P === 'neutral' ||
        P === 'curious' ||
        P === 'confused' ||
        P === 'laughing' ||
        P === 'lovestruck' ||
        P === 'bored' ||
        P === 'proud' ||
        P === 'smug' ||
        P === 'wave' ||
        P === 'walk' ||
        P === 'run' ||
        P === 'wiggle' ||
        P === 'lookaround'
      const fresh = simT - pointer.t
      if (interactive && pointer.in && fresh < 2400 && followOk && !follow.on) {
        const d = pointer.x - byteX
        headAdd += Math.max(-6, Math.min(6, d * 0.05))
        if (Math.abs(d) > 34 && Math.abs(d) < 132 && Math.abs(pointer.y - 176) < 130) {
          follow.on = true
          follow.arr = 0
        }
      }
      if (follow.on && (!interactive || !pointer.in || fresh > 2400 || !followOk)) follow.on = false
      if (follow.on) {
        const tgt = Math.max(-76, Math.min(76, pointer.x - 160))
        const dd = tgt - wx
        if (Math.abs(dd) > (follow.arr > 0 ? 30 : 16)) {
          const run = Math.abs(dd) > 90
          const dir = dd < 0 ? -1 : 1
          wx += dir * Math.min(Math.abs(dd), ((run ? 150 : 66) * dt) / 1000)
          face = dir
          rot = run ? 5 : 3
          gait(t / (run ? 95 : 140), run ? 12 : 10, run ? 12 : 10)
          ty = -Math.abs(Math.sin(t / (run ? 95 : 140))) * (run ? 5 : 3)
          follow.arr = 0
        } else {
          follow.arr += dt
          const d2 = pointer.x - (160 + wx)
          if (Math.abs(d2) > 7) face = d2 < 0 ? -1 : 1
          headAdd += Math.max(-7, Math.min(7, d2 * 0.08))
          if (follow.arr < 720) ty = -Math.abs(Math.sin(follow.arr / 115)) * 4
          fL = { dx: 0, dy: 0 }
          fR = { dx: 0, dy: 0 }
        }
        tx = wx
      } else if (A === 'skate' || A === 'ballP' || A === 'jam') {
        wx = 0
      } else {
        tx = Math.max(-76, Math.min(76, tx + wx))
        if (!pointer.in || fresh > 3600) wx *= Math.pow(0.99965, dt)
      }
      lastTx = tx
```

- [ ] **Step 3: Add pointer-tracking listeners**

Immediately after Task 4's `svg.addEventListener('pointerdown', handlePointerDown)`, add:

```ts
    function handlePointerMove(e: PointerEvent) {
      if (!interactive) return
      const p = svgPoint(e)
      if (!p) return
      pointer.x = p.x
      pointer.y = p.y
      pointer.t = simT
      pointer.in = true
      svg.style.cursor = hitCharacter(p) ? 'pointer' : 'default'
    }
    function handlePointerLeave() {
      pointer.in = false
    }
    svg.addEventListener('pointermove', handlePointerMove)
    svg.addEventListener('pointerleave', handlePointerLeave)
```

- [ ] **Step 4: Remove the new listeners on unmount**

Extend the cleanup function from Task 4:

```ts
    return () => {
      cancelAnimationFrame(rafId)
      svg.removeEventListener('pointerdown', handlePointerDown)
      svg.removeEventListener('pointermove', handlePointerMove)
      svg.removeEventListener('pointerleave', handlePointerLeave)
      delete window.Byte
    }
```

- [ ] **Step 5: Add `window.Byte.interactive()`**

Extend the `window.Byte` object from Task 4:

```ts
    window.Byte = {
      set: setMood,
      list: () => (Object.keys(M) as Mood[]).filter((m) => m !== 'poke'),
      pos: () => 160 + lastTx,
      poke: (variant?: number) => poke(null, typeof variant === 'number' ? variant : null),
      interactive: (enabled: boolean) => {
        interactive = enabled !== false
        if (!interactive) {
          follow.on = false
          pointer.in = false
        }
      },
    }
```

- [ ] **Step 6: Update the `Window.Byte` type**

In `src/byte-global.d.ts`, add to the interface from Task 4:

```ts
      interactive(enabled: boolean): void
```

- [ ] **Step 7: Update the component's header comment**

The file's top-of-file comment currently describes the "v4 rig". Update it to mention the v5 additions, e.g. append a sentence: `Upgraded to v5 (reference/character-prototypes/byte_robot_v5.html): background toys, three scripted Play routines (skate/playball/jam) with autonomous bored-triggered play, and native cursor-follow/click-poke interactivity.`

- [ ] **Step 8: Verify**

Run: `npm run build` — expect PASS.
Run: `npm test` — expect PASS.
Run: `npm run lint` — expect PASS.

- [ ] **Step 9: Manual smoke check**

With Byte in a calm mood (e.g. `neutral`), move the cursor slowly toward him from a moderate distance — confirm his head turns to track it first, then once close enough he walks (or runs, if the gap is large) over and settles into a little hop-hop, continuing to track the cursor. Move the cursor away or hold it still for a few seconds — confirm he disengages and drifts back toward center. Confirm sending a chat message or waiting for an idle-move tick correctly interrupts an in-progress chase (per the existing `follow.on = false` reset in `setMood`, Task 4 Step 6). Confirm cursor-follow also interrupts an in-progress `skate`/`playball`/`jam` routine if the cursor comes close during one. Run `window.Byte.interactive(false)` in the console — confirm hovering/clicking no longer does anything; `window.Byte.interactive(true)` restores it.

- [ ] **Step 10: Commit**

```bash
git add src/components/Character.tsx src/byte-global.d.ts
git commit -m "feat: port native cursor-follow (watch, chase, arrive)"
```

---

## Self-review notes

- **Spec coverage:** every item from `docs/superpowers/specs/2026-07-08-interactive-cursor-follow-design.md` section 3 ("Where this touches the codebase") has a corresponding task: `Character.tsx` (Tasks 2-5), `src/byte-global.d.ts` (Tasks 4-5), `src/types.ts` (Tasks 1, 4), `api/lib/types.ts` (Task 1), `api/lib/moods.ts` (Task 1), `MoodBubble.tsx` (Tasks 1, 4).
- **Deviation from the design doc, flagged here explicitly:** the design doc said `'poke'` "is not added" to the `Mood` type since it's "never externally set or returned by `current()`/`list()`". Working through `M`'s existing `Record<Mood, () => void>` type during planning showed this doesn't hold — `poke()` needs an `M` entry, and `current()` genuinely can return `'poke'` mid-reaction. Task 4 adds it to `Mood` (frontend only), explicitly excluded from `list()` and from `MOOD_GROUPS`, mirroring the existing `'listening'`/`'talking'` precedent exactly. This is a correction to the design doc's assumption, not a new design decision — the actual behavior (hidden from the LLM, hidden from the demo's mood list) is unchanged from what was designed.
- **Placeholder scan:** no TBD/TODO; every step has complete, directly-usable code.
- **Type consistency:** `Extra`'s new fields (`skateDustCycle`, `pokeVariant`, `pokeSide`, `pokeReturnTo`, `pokeDustSpawned`) are each defined once (Tasks 3-4) and referenced by the same name in every consuming block. `gait` (Task 3) is used identically in Task 3's own blocks and in Task 5's follow logic. `window.Byte`'s shape is extended additively and consistently across Tasks 4-5 with no signature drift.
- **Per-task compile safety, verified empirically before dispatch:** the reference file declares `wx`/`pointer`/`follow` together as one group, and an earlier draft of this plan followed that grouping into Task 4. Testing against this project's actual `tsconfig.app.json` (`noUnusedLocals: true`) confirmed that would fail `tsc -b` with `TS6133` — `wx` and `pointer` are never referenced anywhere in Task 4's own code (only `follow` is, via a property write in `setMood`, which does satisfy `noUnusedLocals`). Fixed by moving `wx`/`pointer`'s declarations into Task 5, where they're actually used, so every task compiles standalone.
