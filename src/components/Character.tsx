import { useEffect, useRef } from 'react'
import type { Mood } from '../types'

// Byte the robot -- v4 rig, ported wholesale from the user's hand-built
// prototype covering all 46 EMO-style moods/moves with floaty detached
// hands, procedural leg IK, and a personality body-language pass giving
// every mood (not just moves) real full-body acting -- see
// reference/character-prototypes/byte_robot_v4.html (v3 prototype/design
// doc: reference/character-prototypes/byte_robot_v3.html,
// docs/superpowers/specs/2026-07-07-byte-v3-character-and-continuity-design.md
// §1). The `M` mood dictionary is unchanged from v3 (same code, same 46
// entries) -- only `renderFrame`'s per-mood personality block (the `P ===`
// chain) and `headDy` are new. This component takes no props: it mounts
// once, runs its own animation loop, and exposes `window.Byte = { set, list }`
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
  // New for the v4 personality pass: latches so the valentine kiss-blow
  // only spawns one heart per cycle instead of one per frame.
  valentineKiss?: boolean
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
        const ac = txt(160, 84, 16, 'achoo!')
        ac.setAttribute('id', 'achooT')
        ac.setAttribute('opacity', '0')
        topFx.append(ac)
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
      skate() {
        screen.append(eye(exL, cyL, 26, 20, 9), eye(exR, cyL, 26, 20, 9))
        extra.blink = true
        extra.anim = 'walk'
      },
      playball() {
        screen.append(
          elem('circle', { cx: exL, cy: cyL, r: 12, fill: TEAL }),
          elem('circle', { cx: exR, cy: cyL, r: 12, fill: TEAL })
        )
        extra.anim = 'run'
      },
      jam() {
        screen.append(
          arc(`M${exL - 12} ${cyL} Q${exL} ${cyL + 9} ${exL + 12} ${cyL}`),
          arc(`M${exR - 12} ${cyL} Q${exR} ${cyL + 9} ${exR + 12} ${cyL}`)
        )
        topFx.append(txt(200, 78, 20, '♪', GOLD))
        extra.dance = true
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
      let headDy = 0
      let gazeX = 0
      let fL = { dx: 0, dy: 0 }
      let fR = { dx: 0, dy: 0 }
      let hL = { dx: Math.sin(t / 700) * 1.2, dy: Math.sin(t / 430) * 2.4 }
      let hR = { dx: -Math.sin(t / 640) * 1.2, dy: Math.sin(t / 430 + 1.7) * 2.4 }
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
      // ---- personality body language: every expression mood acts in character ----
      const P = currentMood
      if (P === 'challenging') {
        // signature bit: squares up like a tiny boxer, stance wide, throws jabs
        ty = 4 - Math.abs(Math.sin(t / 130)) * 3
        rot = 2
        rotCy = 252
        headDy = 1
        fL = { dx: -7, dy: 0 }
        fR = { dx: 7, dy: 0 }
        hL = { dx: 16, dy: -26 + Math.sin(t / 130) * 1.5 }
        hR = { dx: -16, dy: -26 + Math.sin(t / 130 + 1.5) * 1.5 }
        const c = (t % 2600) / 2600
        const j = kf(c, [
          [0.5, 0],
          [0.58, 1],
          [0.66, 0],
        ])
        if (Math.floor(t / 2600) % 2 === 0) {
          hL.dx += j * 26
          hL.dy += j * 4
        } else {
          hR.dx -= j * 26
          hR.dy += j * 4
        }
      } else if (P === 'bored') {
        // signature bit: dramatic slump + heavy sigh, hands hang lifeless
        const p = (t % 5200) / 5200
        ty =
          6 +
          kf(p, [
            [0, 0],
            [0.5, 0],
            [0.58, -4],
            [0.7, 3],
            [0.82, 0],
            [1, 0],
          ])
        rot = 0.5
        headDy =
          3 +
          kf(p, [
            [0.5, 0],
            [0.58, -2],
            [0.7, 2],
            [0.82, 0],
          ])
        hL = { dx: 0, dy: 12 }
        hR = { dx: 0, dy: 12 }
        fL = { dx: 0, dy: 0 }
        fR = { dx: 0, dy: -Math.max(0, Math.sin(t / 430)) * 2.2 }
      } else if (P === 'pout') {
        // hands on hips + huffy little foot stomp
        const p = (t % 3400) / 3400
        const st = kf(p, [
          [0.55, 0],
          [0.6, 1],
          [0.66, 0],
        ])
        rot = -1.5
        rotCy = 252
        headDy = -1
        hL = { dx: 9, dy: 11 }
        hR = { dx: -9, dy: 11 }
        fL = { dx: 0, dy: -st * 9 }
        fR = { dx: 0, dy: 0 }
        ty =
          2 +
          kf(p, [
            [0.64, 0],
            [0.68, 1.8],
            [0.76, 0],
          ])
      } else if (P === 'smug') {
        // chin up, lazy "just saying" flourish
        rot = -2
        rotCy = 258
        ty = -1
        headDy = -2
        hL = { dx: 3, dy: 3 }
        hR = { dx: -5 + Math.cos(t / 430) * 4, dy: -11 + Math.sin(t / 430) * 4 }
      } else if (P === 'wink') {
        // cheeky finger-gun pop
        const e = Math.min(1, t / 320)
        const s = e * e * (3 - 2 * e)
        rot = 1.5
        headAdd += 2
        hR = { dx: -10 * s, dy: -24 * s + Math.sin(t / 300) * 1.5 }
        hL = { dx: 1, dy: 4 + Math.sin(t / 700) * 1.2 }
      } else if (P === 'annoyed') {
        // hips + rapid foot tap + sharp huff
        const p = (t % 2900) / 2900
        hL = { dx: 9, dy: 10 }
        hR = { dx: -9, dy: 10 }
        fL = { dx: 0, dy: 0 }
        fR = { dx: 0, dy: -Math.abs(Math.sin(t / 165)) * 3.5 }
        ty =
          1 +
          kf(p, [
            [0.5, 0],
            [0.56, -2],
            [0.64, 1.5],
            [0.72, 0],
          ])
        headAdd += kf(p, [
          [0.5, 0],
          [0.56, -2],
          [0.64, 0],
        ])
        rot = 1
      } else if (P === 'grumpy') {
        // arms folded, hunched hmpf
        ty = 3
        headDy = 2
        rot = 0
        hL = { dx: 41, dy: -3 + Math.sin(t / 900) }
        hR = { dx: -41, dy: -3 + Math.sin(t / 900) }
        fL = { dx: 2, dy: 0 }
        fR = { dx: -2, dy: 0 }
      } else if (P === 'proud') {
        // full power pose: hands on hips, feet planted wide
        ty = -2
        rot = -2
        rotCy = 258
        headDy = -2
        hL = { dx: 10, dy: 10 }
        hR = { dx: -10, dy: 10 }
        fL = { dx: -5, dy: 0 }
        fR = { dx: 5, dy: 0 }
      } else if (P === 'dizzy') {
        // woozy stagger, arms out for balance
        rot = Math.sin(t / 310) * 3.5 + Math.sin(t / 470) * 2.5
        rotCy = 252
        ty = 1 + Math.sin(t / 350) * 2
        headAdd += Math.sin(t / 240) * 9 + Math.sin(t / 390) * 5
        fL = { dx: Math.sin(t / 720) * 4, dy: 0 }
        fR = { dx: Math.sin(t / 720 + 2.1) * 4, dy: 0 }
        hL = { dx: -9 + Math.sin(t / 300) * 5, dy: -10 }
        hR = { dx: 9 - Math.sin(t / 300) * 5, dy: -10 }
      } else if (P === 'thinking') {
        // hand taps the chin
        hR = { dx: -37, dy: -42 + Math.sin(t / 450) * 1.5 }
        hL = { dx: 6, dy: 4 }
        rot = Math.sin(t / 1600)
      } else if (P === 'scared') {
        // hands to face, cowering shiver, knock-knees
        ty = 4 + Math.sin(t / 50) * 1.6
        rot = -1
        hL = { dx: 30, dy: -45 + Math.sin(t / 60) }
        hR = { dx: -30, dy: -45 + Math.sin(t / 60 + 1) }
        fL = { dx: 6, dy: 0 }
        fR = { dx: -6, dy: 0 }
      } else if (P === 'surprised') {
        // startle hop, hands fly out then hover half-raised
        const s = Math.min(1, t / 520)
        ty = kf(s, [
          [0, 0],
          [0.25, -9],
          [0.55, 1.5],
          [0.78, 0],
          [1, 0],
        ])
        const f = kf(s, [
          [0, 0],
          [0.2, 1],
          [0.6, 0.35],
          [1, 0.35],
        ])
        hL = { dx: -8 * f - 2, dy: -26 * f - 4 }
        hR = { dx: 8 * f + 2, dy: -26 * f - 4 }
        fL = { dx: -3, dy: 0 }
        fR = { dx: 3, dy: 0 }
      } else if (P === 'excited') {
        // can't-contain-it: cheer + tippy-taps
        const eb = Math.sin(t / 160) * 3
        hL = { dx: -5, dy: -10 + eb }
        hR = { dx: 5, dy: -10 - eb }
        fL = { dx: 0, dy: -Math.max(0, Math.sin(t / 140)) * 3 }
        fR = { dx: 0, dy: -Math.max(0, Math.sin(t / 140 + Math.PI)) * 3 }
      } else if (P === 'content') {
        // blissed-out sway
        rot = Math.sin(t / 1300) * 1.5
        ty = Math.sin(t / 950) * 2
        headAdd += 2
        hL = { dx: Math.sin(t / 900) * 1.5, dy: 3 + Math.sin(t / 700) * 1.5 }
        hR = { dx: -Math.sin(t / 900) * 1.5, dy: 3 + Math.sin(t / 760) * 1.5 }
      } else if (P === 'curious') {
        // the classic pet head-tilt swap, one hand raised: "hm?"
        const p = (t % 4600) / 4600
        headAdd += kf(p, [
          [0, -6],
          [0.4, -6],
          [0.5, 6],
          [0.9, 6],
          [1, -6],
        ])
        hR = { dx: -4, dy: -13 + Math.sin(t / 500) * 1.5 }
        ty -= 1
      } else if (P === 'confused') {
        // scratches the side of his head
        hR = { dx: 8, dy: -92 + Math.sin(t / 140) * 2.5 }
        hL = { dx: 2, dy: 5 }
      } else if (P === 'sad') {
        // heavy heart: droop, toes in, long sighs
        const p = (t % 5600) / 5600
        ty =
          4 +
          Math.sin(t / 1500) * 1.2 +
          kf(p, [
            [0.5, 0],
            [0.58, -2.5],
            [0.72, 2],
            [0.85, 0],
          ])
        headDy = 3.5
        hL = { dx: 2, dy: 13 }
        hR = { dx: -2, dy: 13 }
        fL = { dx: 5, dy: 0 }
        fR = { dx: -5, dy: 0 }
      } else if (P === 'laughing') {
        // holds his belly
        hL = { dx: 31, dy: 9 + Math.abs(Math.sin(t / 120)) * 2 }
        hR = { dx: -31, dy: 9 + Math.abs(Math.sin(t / 120 + 0.6)) * 2 }
        headDy = -1 + Math.abs(Math.sin(t / 120))
      } else if (P === 'lovestruck') {
        // hands clasped at the chest, swooning
        rot = Math.sin(t / 620) * 2
        rotCy = 252
        hL = { dx: 45 + Math.sin(t / 620) * 2, dy: -5 }
        hR = { dx: -45 + Math.sin(t / 620) * 2, dy: -5 }
        headAdd += Math.sin(t / 620) * 2
      } else if (P === 'sick') {
        // droopy... ah... ah... ACHOO!
        const p = (t % 4600) / 4600
        ty =
          2.5 +
          kf(p, [
            [0.6, 0],
            [0.7, -2],
            [0.735, 5],
            [0.82, 3],
            [0.95, 0],
          ])
        headDy =
          2 +
          kf(p, [
            [0.55, 0],
            [0.6, -2],
            [0.63, 0],
            [0.66, -3],
            [0.7, -4],
            [0.735, 7],
            [0.84, 2],
            [0.95, 0],
          ])
        headAdd += kf(p, [
          [0.7, 0],
          [0.735, 6],
          [0.85, 0],
        ])
        hL = { dx: 2, dy: 9 }
        hR = {
          dx: -2,
          dy:
            9 +
            kf(p, [
              [0.66, 0],
              [0.71, -16],
              [0.82, 0],
            ]),
        }
        const at = svg?.querySelector<SVGTextElement>('#achooT')
        if (at) {
          at.setAttribute(
            'opacity',
            kf(p, [
              [0.71, 0],
              [0.735, 1],
              [0.9, 1],
              [0.98, 0],
            ]).toFixed(2)
          )
        }
      } else if (P === 'unwell') {
        // weak sway + little shiver bursts
        const p = (t % 4000) / 4000
        ty = 5 + Math.sin(t / 900) * 1.5 + (p > 0.5 && p < 0.62 ? Math.sin(t / 42) * 1.6 : 0)
        rot = Math.sin(t / 1100) * 1.5
        headDy = 3
        hL = { dx: 1, dy: 12 }
        hR = { dx: -1, dy: 12 }
        fL = { dx: 3, dy: 0 }
        fR = { dx: -3, dy: 0 }
      } else if (P === 'recovering') {
        // gentle deep breaths
        ty = 1 + Math.sin(t / 1250) * 2.5
        headDy = 1
        hL = { dx: 2, dy: 6 + Math.sin(t / 1250) * 1.5 }
        hR = { dx: -2, dy: 6 + Math.sin(t / 1250 + 0.4) * 1.5 }
      } else if (P === 'listening') {
        // hand cupped to the ear, mm-hm nods
        const p = (t % 2200) / 2200
        hR = { dx: 9, dy: -70 + Math.sin(t / 600) * 1.5 }
        hL = { dx: 0, dy: 6 }
        headDy = kf(p, [
          [0.42, 0],
          [0.5, 2.4],
          [0.58, 0],
          [0.66, 1.8],
          [0.74, 0],
        ])
        headAdd += 3
      } else if (P === 'talking') {
        // talks with his hands
        hL = { dx: 6 + Math.sin(t / 310) * 4, dy: -6 + Math.sin(t / 240) * 5 }
        hR = { dx: -6 - Math.sin(t / 370) * 4, dy: -6 + Math.sin(t / 240 + 2.2) * 5 }
        headAdd += Math.sin(t / 300) * 1.5
        headDy = Math.sin(t / 240) * 0.8
      } else if (P === 'dancing') {
        // two-step + hand pumps with the beat
        const dw = Math.sin(t / 220)
        hL = { dx: -3, dy: dw * 9 - 3 + Math.sin(t / 430) * 1.5 }
        hR = { dx: 3, dy: -dw * 9 - 3 + Math.sin(t / 430 + 1) * 1.5 }
        fL = { dx: dw * 5, dy: -Math.max(0, dw) * 4 }
        fR = { dx: -dw * 5, dy: -Math.max(0, -dw) * 4 }
      } else if (P === 'sleepy') {
        // nodding off... snaps awake! + eye rub
        const p = (t % 5200) / 5200
        headDy = kf(p, [
          [0, 0],
          [0.45, 4.5],
          [0.55, 5],
          [0.6, -0.5],
          [0.66, 0],
          [1, 0],
        ])
        ty += kf(p, [
          [0.55, 0],
          [0.6, -1.6],
          [0.68, 0],
        ])
        hR = { dx: -36 + Math.cos(t / 300) * 2, dy: -74 + Math.sin(t / 300) * 2 }
        hL = { dx: 0, dy: 9 }
      } else if (P === 'dozing') {
        // out cold (standing up)
        headDy = 5
        hL = { dx: 1, dy: 14 }
        hR = { dx: -1, dy: 14 }
        fL = { dx: -3, dy: 0 }
        fR = { dx: 3, dy: 0 }
      } else if (P === 'birthday') {
        // party bounce, arms pumping
        ty = -Math.abs(Math.sin(t / 270)) * 5
        const bw = Math.sin(t / 270)
        hL = { dx: -3, dy: -9 + bw * 7 }
        hR = { dx: 3, dy: -9 - bw * 7 }
        headAdd += Math.sin(t / 540) * 2
      } else if (P === 'christmas') {
        // catching snowflakes, palm out
        rot = Math.sin(t / 1000) * 2
        headDy = -1
        hR = { dx: -13, dy: -9 + Math.sin(t / 800) * 2 }
        hL = { dx: 2, dy: 4 + Math.sin(t / 700) * 1.5 }
      } else if (P === 'halloween') {
        // woooOOoo ghost arms, feet dangling
        hL = { dx: -6, dy: -17 + Math.sin(t / 210) * 3.5 }
        hR = { dx: 6, dy: -17 + Math.sin(t / 210 + Math.PI) * 3.5 }
        fL = { dx: 0, dy: 3 + Math.sin(t / 520) * 1.2 }
        fR = { dx: 0, dy: 3 + Math.sin(t / 520 + 1.5) * 1.2 }
      } else if (P === 'newyear') {
        // countdown hype bounce
        ty = -Math.abs(Math.sin(t / 240)) * 4
        hL = { dx: -4, dy: -12 + Math.sin(t / 240) * 4 }
        hR = { dx: 4, dy: -12 - Math.sin(t / 240) * 4 }
      } else if (P === 'valentine') {
        // hand to the cheek... then blows a kiss
        const p = (t % 3800) / 3800
        rot = Math.sin(t / 640) * 1.5
        rotCy = 252
        const r = kf(p, [
          [0.5, 0],
          [0.6, 1],
          [0.72, 1],
          [0.8, 0],
        ])
        const fl = kf(p, [
          [0.7, 0],
          [0.78, 1],
          [0.88, 0],
        ])
        hR = { dx: -30 * r + 14 * fl, dy: -44 * r + 6 * fl }
        hL = { dx: 44, dy: -5 }
        if (fl > 0.6 && !extra.valentineKiss) {
          extra.valentineKiss = true
          const hh = heartAt(198, 158, 0.9)
          fx.appendChild(hh)
          hearts.push({ el: hh, x: 198, y: 158, s: 0.9, sway: 0 })
        }
        if (p < 0.5) extra.valentineKiss = false
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
        let ht = ''
        if (headDy) ht += `translate(0 ${headDy.toFixed(2)}) `
        if (tilt) ht += `rotate(${tilt} 160 116)`
        headG.setAttribute('transform', ht)
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
