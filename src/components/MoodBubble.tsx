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
  skate: '🛹 skate',
  playball: '⚽ playball',
  jam: '🎧 jam',
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
