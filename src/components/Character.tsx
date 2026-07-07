import { useEffect, useRef } from 'react'
import type { Mood } from '../types'

// Byte the monkey -- a hand-authored SVG (originally prototyped as a
// standalone HTML file, reference/character-prototypes/byte_monkey_body_shorter.html,
// kept for reference) instead of the earlier Freepik-illustration/R3F attempts.
// Fully vector, so it stays crisp at any size and needs no image assets.
// Mood swaps mouth/brow paths, arm pose, and a couple of overlays
// (heart-eyes + floating hearts for lovestruck, drooping lids + "z"s for
// sleepy) rather than blending 3D expressions or swapping raster images.
//
// The animation (bob, blink, tail wag, cursor eye-tracking, heart
// particles) is inherently imperative -- driven by a single rAF loop that
// mutates SVG attributes directly, same pattern the old R3F character used
// with Three.js objects. React only owns the initial markup and the mood
// prop; everything else after mount is refs, not re-renders.

const MOUTHS: Record<Mood, string> = {
  happy: 'M137 163 Q155 176 173 163',
  excited: 'M135 161 Q155 182 175 161 Q155 171 135 161 Z',
  curious: 'M149 167 Q155 163 161 167',
  sleepy: 'M147 166 Q155 172 163 166',
  confused: 'M139 167 Q149 161 157 169 Q165 175 171 167',
  lovestruck: 'M135 161 Q155 178 175 161',
  neutral: 'M145 165 L165 165',
}

const BROWS: Record<Mood, { l: string; r: string }> = {
  happy: { l: 'M121 97 Q135 91 147 96', r: 'M163 96 Q174 91 189 97' },
  excited: { l: 'M121 92 Q135 85 147 90', r: 'M163 90 Q174 85 189 92' },
  curious: { l: 'M121 93 Q135 86 147 91', r: 'M163 100 Q174 95 189 102' },
  sleepy: { l: 'M123 108 Q135 105 145 107', r: 'M165 107 Q174 105 187 108' },
  confused: { l: 'M121 91 Q135 86 147 95', r: 'M163 102 Q174 98 189 105' },
  lovestruck: { l: 'M121 96 Q135 89 147 95', r: 'M163 95 Q174 89 189 96' },
  neutral: { l: 'M121 99 Q135 95 147 99', r: 'M163 99 Q174 95 189 99' },
}

interface ArmPose {
  l: { p: string; hx: number; hy: number }
  r: { p: string; hx: number; hy: number }
}

const ARM_POSES = {
  rest: { l: { p: 'M116 214 Q94 226 90 250', hx: 90, hy: 253 }, r: { p: 'M194 214 Q216 226 220 250', hx: 220, hy: 253 } },
  up: { l: { p: 'M116 212 Q92 192 84 168', hx: 82, hy: 163 }, r: { p: 'M194 212 Q218 192 226 168', hx: 228, hy: 163 } },
  cheeks: { l: { p: 'M116 212 Q108 180 124 152', hx: 126, hy: 145 }, r: { p: 'M194 212 Q202 180 186 152', hx: 184, hy: 145 } },
  scratch: { l: { p: 'M116 214 Q94 226 90 250', hx: 90, hy: 253 }, r: { p: 'M194 212 Q222 172 202 90', hx: 200, hy: 84 } },
  droop: { l: { p: 'M118 216 Q100 240 96 262', hx: 96, hy: 265 }, r: { p: 'M192 216 Q210 240 214 262', hx: 214, hy: 265 } },
} satisfies Record<string, ArmPose>

const MOOD_ARM_POSE: Record<Mood, keyof typeof ARM_POSES> = {
  happy: 'rest',
  excited: 'up',
  curious: 'scratch',
  sleepy: 'droop',
  confused: 'scratch',
  lovestruck: 'cheeks',
  neutral: 'rest',
}

interface CharacterProps {
  mood: Mood
}

export function Character({ mood }: CharacterProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  // Sink for the imperative setMood() defined inside the mount effect, so
  // the mood-change effect below can call into it without re-running setup.
  const applyMoodRef = useRef<(mood: Mood) => void>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const q = <T extends Element>(sel: string) => svg.querySelector<T>(sel)!

    const bob = q<SVGGElement>('#bobG')
    const headG = q<SVGGElement>('#headG')
    const irisL = q<SVGGElement>('#irisL')
    const irisR = q<SVGGElement>('#irisR')
    const ewL = q<SVGGElement>('#ewL')
    const ewR = q<SVGGElement>('#ewR')
    const heartEyeL = q<SVGGElement>('#heartEyeL')
    const heartEyeR = q<SVGGElement>('#heartEyeR')
    const sleepyLidL = q<SVGPathElement>('#sleepyLidL')
    const sleepyLidR = q<SVGPathElement>('#sleepyLidR')
    const browL = q<SVGPathElement>('#browL')
    const browR = q<SVGPathElement>('#browR')
    const mouth = q<SVGPathElement>('#mouth')
    const cheekL = q<SVGEllipseElement>('#cheekL')
    const cheekR = q<SVGEllipseElement>('#cheekR')
    const armL = q<SVGGElement>('#armL')
    const armR = q<SVGGElement>('#armR')
    const tail = q<SVGPathElement>('#tail')
    const sleepZ = q<SVGGElement>('#sleepZ')
    const floatWrap = q<SVGGElement>('#heartsFloat')

    const baseL = { x: 135, y: 124 }
    const baseR = { x: 174, y: 124 }
    let currentMood: Mood = mood
    let mx = 155
    let my = 124
    let t = 0
    let last = performance.now()

    function setArm(g: SVGGElement, pose: ArmPose['l']) {
      g.querySelector('path')!.setAttribute('d', pose.p)
      const h = g.querySelector('circle')!
      h.setAttribute('cx', String(pose.hx))
      h.setAttribute('cy', String(pose.hy))
    }

    let hearts: { el: SVGPathElement; x: number; y: number; s: number; vy: number; sway: number }[] = []
    function heartPath(x: number, y: number, s: number) {
      return `M${x} ${y + 6 * s} L${x - 6 * s} ${y - 1 * s} A${3.5 * s} ${3.5 * s} 0 0 1 ${x} ${y - 5 * s} A${3.5 * s} ${3.5 * s} 0 0 1 ${x + 6 * s} ${y - 1 * s} Z`
    }
    function spawnHeart() {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      const x = 105 + Math.random() * 95
      const s = 0.7 + Math.random() * 0.8
      p.setAttribute('fill', Math.random() < 0.5 ? '#E24B6A' : '#ED93B1')
      floatWrap.appendChild(p)
      hearts.push({ el: p, x, y: 112, s, vy: 0.35 + Math.random() * 0.3, sway: Math.random() * 6.28 })
    }

    function blink(closed: boolean) {
      const ry = closed ? '3' : '21'
      ewL.querySelector('ellipse')!.setAttribute('ry', ry)
      ewR.querySelector('ellipse')!.setAttribute('ry', ry)
      if (currentMood !== 'lovestruck' && currentMood !== 'sleepy') {
        irisL.style.opacity = closed ? '0' : '1'
        irisR.style.opacity = closed ? '0' : '1'
      }
    }

    function applyMood(m: Mood) {
      currentMood = m
      const love = m === 'lovestruck'
      const sleep = m === 'sleepy'
      heartEyeL.style.opacity = love ? '1' : '0'
      heartEyeR.style.opacity = love ? '1' : '0'
      sleepyLidL.style.opacity = sleep ? '1' : '0'
      sleepyLidR.style.opacity = sleep ? '1' : '0'
      irisL.style.opacity = love || sleep ? '0' : '1'
      irisR.style.opacity = love || sleep ? '0' : '1'
      ewL.style.opacity = sleep ? '0' : '1'
      ewR.style.opacity = sleep ? '0' : '1'
      cheekL.setAttribute('opacity', m === 'excited' || love ? '0.9' : '0')
      cheekR.setAttribute('opacity', m === 'excited' || love ? '0.9' : '0')
      const b = BROWS[m]
      browL.setAttribute('d', b.l)
      browR.setAttribute('d', b.r)
      sleepZ.style.opacity = sleep ? '1' : '0'
      const pose = ARM_POSES[MOOD_ARM_POSE[m]]
      setArm(armL, pose.l)
      setArm(armR, pose.r)
      mouth.setAttribute('d', MOUTHS[m])
      if (!love) {
        hearts.forEach((h) => h.el.remove())
        hearts = []
      }
    }
    applyMoodRef.current = applyMood

    function handleMouseMove(e: MouseEvent) {
      const r = svg!.getBoundingClientRect()
      mx = ((e.clientX - r.left) / r.width) * 320
      my = ((e.clientY - r.top) / r.height) * 320
    }
    function handleMouseLeave() {
      mx = 155
      my = 124
    }
    svg.addEventListener('mousemove', handleMouseMove)
    svg.addEventListener('mouseleave', handleMouseLeave)

    function track(base: { x: number; y: number }, el: SVGGElement) {
      const dx = mx - base.x
      const dy = my - base.y
      const d = Math.hypot(dx, dy) || 1
      const m = Math.min(d, 6)
      el.setAttribute('transform', `translate(${(dx / d) * m} ${(dy / d) * m})`)
    }

    let nextBlink = 1500
    let heartTimer = 0
    let rafId: number

    function loop(now: number) {
      const dt = now - last
      last = now
      t += dt

      const bounceAmp = currentMood === 'excited' ? 6.5 : currentMood === 'sleepy' ? 2 : 3
      const bounceSpd = currentMood === 'excited' ? 300 : currentMood === 'sleepy' ? 1500 : 620
      bob.style.transformOrigin = '155px 288px'
      bob.setAttribute('transform', `translate(0 ${Math.sin(t / bounceSpd) * bounceAmp}) rotate(${Math.sin(t / 1100) * 1} 155 230)`)
      headG.setAttribute('transform', currentMood === 'curious' ? 'rotate(-5 155 180)' : currentMood === 'sleepy' ? 'rotate(5 155 180)' : '')

      const tSpd = currentMood === 'excited' ? 260 : 700
      const tAmp = currentMood === 'excited' ? 14 : 9
      tail.setAttribute('d', `M188 250 Q240 250 238 ${206 + Math.sin(t / tSpd) * tAmp} Q237 182 ${222 + Math.sin(t / tSpd) * 5} 186`)

      if (currentMood === 'lovestruck') {
        const p = 1 + Math.sin(t / 220) * 0.12
        heartEyeL.style.transformOrigin = '135px 122px'
        heartEyeR.style.transformOrigin = '174px 122px'
        heartEyeL.setAttribute('transform', `scale(${p})`)
        heartEyeR.setAttribute('transform', `scale(${p})`)
        heartTimer -= dt
        if (heartTimer <= 0) {
          spawnHeart()
          heartTimer = 420
        }
      } else if (currentMood !== 'sleepy') {
        track(baseL, irisL)
        track(baseR, irisR)
      }

      if (currentMood === 'confused' || currentMood === 'curious') {
        const w = Math.sin(t / 120) * 4
        const h = armR.querySelector('circle')!
        h.setAttribute('cx', String(200 + w))
      }

      if (currentMood !== 'sleepy' && currentMood !== 'lovestruck') {
        nextBlink -= dt
        if (nextBlink <= 0) {
          blink(true)
          setTimeout(() => {
            if (currentMood !== 'sleepy' && currentMood !== 'lovestruck') blink(false)
          }, 110)
          nextBlink = 1800 + Math.random() * 2500
        }
      }

      hearts.forEach((h) => {
        h.y -= h.vy * dt * 0.06
        h.sway += dt * 0.003
        const x = h.x + Math.sin(h.sway) * 8
        const op = h.y < 72 ? Math.max(0, (h.y - 40) / 32) : 1
        h.el.setAttribute('d', heartPath(x, h.y, h.s))
        h.el.setAttribute('opacity', String(op))
      })
      hearts = hearts.filter((h) => {
        if (h.y < 40) {
          h.el.remove()
          return false
        }
        return true
      })

      rafId = requestAnimationFrame(loop)
    }

    applyMood(mood)
    rafId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafId)
      svg.removeEventListener('mousemove', handleMouseMove)
      svg.removeEventListener('mouseleave', handleMouseLeave)
      hearts.forEach((h) => h.el.remove())
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
    <div className="flex h-full items-center justify-center">
      <svg ref={svgRef} width="320" height="320" viewBox="0 0 320 320" role="img" style={{ maxWidth: '76vw', maxHeight: '65vh' }}>
        <title>Byte</title>
        <desc>A compact goofy monkey whose pose and face change with its mood.</desc>

        <g id="heartsFloat" />

        <g id="bobG">
          <path id="tail" d="M188 250 Q240 250 238 206 Q237 182 222 186" fill="none" stroke="#8A5A34" strokeWidth={11} strokeLinecap="round" />

          <ellipse cx={134} cy={270} rx={14} ry={16} fill="#8A5A34" />
          <ellipse cx={134} cy={281} rx={15} ry={8} fill="#5A3A20" />
          <ellipse cx={176} cy={270} rx={14} ry={16} fill="#8A5A34" />
          <ellipse cx={176} cy={281} rx={15} ry={8} fill="#5A3A20" />

          <g id="armL">
            <path d="M116 214 Q94 226 90 250" fill="none" stroke="#8A5A34" strokeWidth={12} strokeLinecap="round" />
            <circle cx={90} cy={253} r={11} fill="#C89B72" />
          </g>
          <g id="armR">
            <path d="M194 214 Q216 226 220 250" fill="none" stroke="#8A5A34" strokeWidth={12} strokeLinecap="round" />
            <circle cx={220} cy={253} r={11} fill="#C89B72" />
          </g>

          <ellipse id="body" cx={155} cy={230} rx={46} ry={44} fill="#8A5A34" />
          <ellipse id="belly" cx={155} cy={234} rx={26} ry={27} fill="#E9CBA0" />

          <g id="headG">
            <circle cx={88} cy={112} r={28} fill="#7A4E2D" />
            <circle cx={88} cy={112} r={15.5} fill="#C89B72" />
            <circle cx={222} cy={112} r={28} fill="#7A4E2D" />
            <circle cx={222} cy={112} r={15.5} fill="#C89B72" />

            <path
              d="M155 50 C204 50 220 89 220 122 C220 163 191 188 155 188 C119 188 90 163 90 122 C90 89 106 50 155 50 Z"
              fill="#8A5A34"
            />
            <path
              d="M116 132 C116 99 136 87 155 87 C174 87 194 99 194 132 C194 167 177 180 155 180 C133 180 116 167 116 132 Z"
              fill="#E9CBA0"
            />

            <g id="ewL">
              <ellipse cx={135} cy={122} rx={17.5} ry={21} fill="#FFFFFF" stroke="#2C2C2A" strokeWidth={2.5} />
            </g>
            <g id="ewR">
              <ellipse cx={174} cy={122} rx={17.5} ry={21} fill="#FFFFFF" stroke="#2C2C2A" strokeWidth={2.5} />
            </g>
            <g id="irisL">
              <circle cx={135} cy={124} r={9.5} fill="#4A2E18" />
              <circle cx={135} cy={124} r={5.2} fill="#1a1a1a" />
              <circle cx={132} cy={121} r={2.6} fill="#FFFFFF" />
            </g>
            <g id="irisR">
              <circle cx={174} cy={124} r={9.5} fill="#4A2E18" />
              <circle cx={174} cy={124} r={5.2} fill="#1a1a1a" />
              <circle cx={171} cy={121} r={2.6} fill="#FFFFFF" />
            </g>
            <g id="heartEyeL" style={{ opacity: 0 }}>
              <path d="M135 130 L127 122 A4.8 4.8 0 0 1 135 116 A4.8 4.8 0 0 1 143 122 Z" fill="#E24B6A" />
            </g>
            <g id="heartEyeR" style={{ opacity: 0 }}>
              <path d="M174 130 L166 122 A4.8 4.8 0 0 1 174 116 A4.8 4.8 0 0 1 182 122 Z" fill="#E24B6A" />
            </g>
            <path id="sleepyLidL" d="M117 122 Q135 134 153 122" fill="none" stroke="#5A3A20" strokeWidth={3} strokeLinecap="round" style={{ opacity: 0 }} />
            <path id="sleepyLidR" d="M156 122 Q174 134 192 122" fill="none" stroke="#5A3A20" strokeWidth={3} strokeLinecap="round" style={{ opacity: 0 }} />

            <path id="browL" d="M121 98 Q135 92 147 97" fill="none" stroke="#4A2E18" strokeWidth={4.3} strokeLinecap="round" />
            <path id="browR" d="M163 97 Q174 92 189 98" fill="none" stroke="#4A2E18" strokeWidth={4.3} strokeLinecap="round" />

            <ellipse cx={147} cy={148} rx={3} ry={4} fill="#2C2C2A" />
            <ellipse cx={163} cy={148} rx={3} ry={4} fill="#2C2C2A" />
            <path id="mouth" d="M137 163 Q155 176 173 163" fill="none" stroke="#6E4326" strokeWidth={3.3} strokeLinecap="round" />
            <ellipse id="cheekL" cx={121} cy={154} rx={9.5} ry={6} fill="#D98A5A" opacity={0} />
            <ellipse id="cheekR" cx={189} cy={154} rx={9.5} ry={6} fill="#D98A5A" opacity={0} />
            <g id="sleepZ" style={{ opacity: 0 }} fill="#8B98AC">
              <text x={196} y={60} fontSize={17} fontFamily="sans-serif" fontWeight="bold">
                z
              </text>
              <text x={210} y={42} fontSize={12} fontFamily="sans-serif" fontWeight="bold">
                z
              </text>
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}
