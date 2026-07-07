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
        topFx.append(txt(160, 76, 15, `${new Date().getUTCFullYear()}!`, GOLD))
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
