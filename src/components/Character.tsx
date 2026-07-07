import { useEffect, useRef } from 'react'
import type { Mood } from '../types'

// Byte the robot -- a hand-authored SVG (originally prototyped as a
// standalone HTML file, reference/character-prototypes/byte_robot.html,
// kept for reference), replacing the earlier monkey character for more
// distinct per-mood expressions (star eyes, heart eyes, mismatched
// confused eyes + head tilt, closed sleepy lids). Fully vector, no image
// assets. The prototype's own idle "floating emoji" beat is intentionally
// not ported -- App.tsx's ThoughtBubble already covers "Byte thinking
// about something" with a proper thought-cloud, so porting both would be
// two competing idle-emoji systems.
//
// Same pattern as the monkey it replaces: a mount-once effect wires an
// imperative rAF loop (bob, blink, mood-specific pulses/wobbles) via refs
// into the SVG; a second effect applies mood prop changes into that loop
// without re-running setup.

interface EyeShape {
  w: number
  h: number
  rx: number
}

const EYE_SHAPES: Record<'happy' | 'neutral', EyeShape> = {
  happy: { w: 26, h: 20, rx: 9 },
  neutral: { w: 26, h: 14, rx: 6 },
}

interface CharacterProps {
  mood: Mood
}

export function Character({ mood }: CharacterProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const applyMoodRef = useRef<(mood: Mood) => void>(null)

  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const q = <T extends Element>(sel: string) => svg.querySelector<T>(sel)!

    const bob = q<SVGGElement>('#bobG')
    const headG = q<SVGGElement>('#headG')
    const eyeL = q<SVGRectElement>('#eyeL')
    const eyeR = q<SVGRectElement>('#eyeR')
    const eyesNormal = q<SVGGElement>('#eyesNormal')
    const eyesHeart = q<SVGGElement>('#eyesHeart')
    const eyesStar = q<SVGGElement>('#eyesStar')
    const starL = q<SVGPathElement>('#starL')
    const starR = q<SVGPathElement>('#starR')
    const eyesConfused = q<SVGGElement>('#eyesConfused')
    const lidL = q<SVGPathElement>('#lidL')
    const lidR = q<SVGPathElement>('#lidR')
    const sleepZ = q<SVGGElement>('#sleepZ')
    const questionMark = q<SVGGElement>('#questionMark')
    const lightL = q<SVGCircleElement>('#lightL')
    const lightR = q<SVGCircleElement>('#lightR')
    const footL = q<SVGGElement>('#footL')
    const footR = q<SVGGElement>('#footR')

    function starPath(cx: number, cy: number, r: number) {
      const pts: string[] = []
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5
        const rr = i % 2 === 0 ? r : r * 0.42
        pts.push(`${cx + Math.cos(ang) * rr} ${cy + Math.sin(ang) * rr}`)
      }
      return `M${pts.join(' L')} Z`
    }
    starL.setAttribute('d', starPath(135, 120, 13))
    starR.setAttribute('d', starPath(185, 120, 13))
    footL.setAttribute('transform', 'rotate(-2 128 266)')
    footR.setAttribute('transform', 'rotate(2 192 266)')

    let currentMood: Mood = mood
    let t = 0
    let last = performance.now()

    function hideAllEyes() {
      eyesNormal.style.opacity = '0'
      eyesHeart.style.opacity = '0'
      eyesStar.style.opacity = '0'
      eyesConfused.style.opacity = '0'
      lidL.style.opacity = '0'
      lidR.style.opacity = '0'
      questionMark.style.opacity = '0'
    }

    function applyMood(m: Mood) {
      currentMood = m
      hideAllEyes()
      sleepZ.style.opacity = '0'
      lightL.setAttribute('fill', '#3FE0D0')
      lightR.setAttribute('fill', '#3FE0D0')

      if (m === 'happy' || m === 'neutral') {
        eyesNormal.style.opacity = '1'
        const es = EYE_SHAPES[m]
        for (const e of [eyeL, eyeR]) {
          e.setAttribute('width', String(es.w))
          e.setAttribute('height', String(es.h))
          e.setAttribute('rx', String(es.rx))
          e.setAttribute('y', String(118 - es.h / 2))
        }
        eyeL.setAttribute('x', String(135 - es.w / 2))
        eyeR.setAttribute('x', String(185 - es.w / 2))
      } else if (m === 'excited') {
        eyesStar.style.opacity = '1'
      } else if (m === 'curious') {
        eyesNormal.style.opacity = '1'
        for (const e of [eyeL, eyeR]) {
          e.setAttribute('width', '20')
          e.setAttribute('height', '20')
          e.setAttribute('rx', '10')
          e.setAttribute('y', '108')
        }
        eyeL.setAttribute('x', '125')
        eyeR.setAttribute('x', '175')
        questionMark.style.opacity = '1'
      } else if (m === 'confused') {
        eyesConfused.style.opacity = '1'
        questionMark.style.opacity = '1'
      } else if (m === 'sleepy') {
        lidL.style.opacity = '1'
        lidR.style.opacity = '1'
        sleepZ.style.opacity = '1'
        lightL.setAttribute('fill', '#3A3F52')
        lightR.setAttribute('fill', '#3A3F52')
      } else if (m === 'lovestruck') {
        eyesHeart.style.opacity = '1'
        lightR.setAttribute('fill', '#F2749A')
      }
    }
    applyMoodRef.current = applyMood

    let nextBlink = 1500
    let rafId: number

    function loop(now: number) {
      const dt = now - last
      last = now
      t += dt

      const bounceAmp = currentMood === 'excited' ? 6 : currentMood === 'sleepy' ? 1.5 : 2.5
      const bounceSpd = currentMood === 'excited' ? 350 : currentMood === 'sleepy' ? 1500 : 700
      bob.style.transformOrigin = '160px 292px'
      bob.setAttribute('transform', `translate(0 ${Math.sin(t / bounceSpd) * bounceAmp}) rotate(${Math.sin(t / 1300) * 0.7} 160 230)`)
      headG.setAttribute(
        'transform',
        currentMood === 'curious'
          ? 'rotate(-5 160 118)'
          : currentMood === 'confused'
            ? `rotate(${8 + Math.sin(t / 500) * 3} 160 118)`
            : currentMood === 'sleepy'
              ? 'rotate(5 160 118)'
              : ''
      )

      if (currentMood === 'lovestruck') {
        const p = 1 + Math.sin(t / 220) * 0.12
        eyesHeart.style.transformOrigin = '160px 118px'
        eyesHeart.setAttribute('transform', `scale(${p})`)
      }
      if (currentMood === 'excited') {
        const p = 1 + Math.sin(t / 160) * 0.15
        eyesStar.style.transformOrigin = '160px 120px'
        eyesStar.setAttribute('transform', `scale(${p})`)
      }
      if (currentMood === 'confused') {
        questionMark.setAttribute('transform', `translate(0 ${Math.sin(t / 300) * 3})`)
      }

      if (currentMood === 'happy' || currentMood === 'neutral') {
        nextBlink -= dt
        if (nextBlink <= 0) {
          eyeL.setAttribute('height', '2')
          eyeR.setAttribute('height', '2')
          setTimeout(() => {
            if (currentMood === 'happy' || currentMood === 'neutral') {
              const es = EYE_SHAPES[currentMood]
              eyeL.setAttribute('height', String(es.h))
              eyeR.setAttribute('height', String(es.h))
            }
          }, 110)
          nextBlink = 1800 + Math.random() * 2500
        }
      }

      rafId = requestAnimationFrame(loop)
    }

    applyMood(mood)
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
      height={320}
      viewBox="0 0 320 320"
      role="img"
      className="block"
      style={{ width: 'min(85vw, 480px)', height: 'auto', maxHeight: '78vh' }}
    >
      <title>Byte</title>
      <desc>A dark navy robot whose eyes and pose change with its mood.</desc>

      <g id="bobG">
        <ellipse cx={160} cy={290} rx={70} ry={8} fill="#000000" opacity={0.12} />

        <g id="footL">
          <path d="M144 214 L134 258" stroke="#2C3350" strokeWidth={26} strokeLinecap="round" fill="none" />
          <ellipse cx={128} cy={266} rx={30} ry={23} fill="#2C3350" />
          <ellipse cx={128} cy={266} rx={30} ry={23} fill="none" stroke="#3A4470" strokeWidth={3} />
          <ellipse cx={120} cy={260} rx={8} ry={5} fill="#3FE0D0" opacity={0.35} />
        </g>
        <g id="footR">
          <path d="M176 214 L186 258" stroke="#2C3350" strokeWidth={26} strokeLinecap="round" fill="none" />
          <ellipse cx={192} cy={266} rx={30} ry={23} fill="#2C3350" />
          <ellipse cx={192} cy={266} rx={30} ry={23} fill="none" stroke="#3A4470" strokeWidth={3} />
          <ellipse cx={184} cy={260} rx={8} ry={5} fill="#3FE0D0" opacity={0.35} />
        </g>

        <rect id="body" x={118} y={150} width={84} height={72} rx={24} fill="#23273A" />
        <rect id="belly" x={140} y={168} width={40} height={28} rx={8} fill="#171A28" />
        <circle id="lightL" cx={152} cy={182} r={4} fill="#3FE0D0" />
        <circle id="lightR" cx={168} cy={182} r={4} fill="#3FE0D0" />

        <g id="headG">
          <rect x={86} y={66} width={148} height={112} rx={34} fill="#1B1E2C" />
          <rect x={86} y={66} width={148} height={112} rx={34} fill="none" stroke="#3A4470" strokeWidth={5} />
          <circle cx={80} cy={120} r={18} fill="#2C3350" />
          <circle cx={80} cy={120} r={18} fill="none" stroke="#3A4470" strokeWidth={3} />
          <circle cx={240} cy={120} r={18} fill="#2C3350" />
          <circle cx={240} cy={120} r={18} fill="none" stroke="#3A4470" strokeWidth={3} />
          <rect x={104} y={90} width={112} height={64} rx={16} fill="#0A0C14" />

          <g id="eyesNormal">
            <rect id="eyeL" x={122} y={112} width={26} height={20} rx={9} fill="#3FE0D0" />
            <rect id="eyeR" x={172} y={112} width={26} height={20} rx={9} fill="#3FE0D0" />
          </g>
          <g id="eyesStar" style={{ opacity: 0 }} fill="#F2C94C">
            <path id="starL" />
            <path id="starR" />
          </g>
          <g id="eyesHeart" style={{ opacity: 0 }} fill="#F2749A">
            <path d="M135 130 L121 116 A8 8 0 0 1 135 106 A8 8 0 0 1 149 116 Z" />
            <path d="M185 130 L171 116 A8 8 0 0 1 185 106 A8 8 0 0 1 199 116 Z" />
          </g>
          <g id="eyesConfused" style={{ opacity: 0 }}>
            <circle cx={135} cy={116} r={14} fill="#3FE0D0" />
            <circle cx={132} cy={112} r={4} fill="#0A0C14" />
            <path d="M172 122 Q185 130 198 122" stroke="#3FE0D0" strokeWidth={7} strokeLinecap="round" fill="none" />
          </g>
          <path id="lidL" d="M118 122 Q135 108 152 122" fill="none" stroke="#3FE0D0" strokeWidth={6} strokeLinecap="round" style={{ opacity: 0 }} />
          <path id="lidR" d="M168 122 Q185 108 202 122" fill="none" stroke="#3FE0D0" strokeWidth={6} strokeLinecap="round" style={{ opacity: 0 }} />

          <g id="sleepZ" style={{ opacity: 0 }} fill="#3FE0D0">
            <text x={222} y={88} fontSize={17} fontFamily="sans-serif" fontWeight="bold">
              z
            </text>
            <text x={236} y={70} fontSize={12} fontFamily="sans-serif" fontWeight="bold">
              z
            </text>
          </g>
          <g id="questionMark" style={{ opacity: 0 }} fill="#3FE0D0">
            <text x={196} y={80} fontSize={24} fontFamily="sans-serif" fontWeight="bold">
              ?
            </text>
          </g>
        </g>
      </g>
    </svg>
  )
}
