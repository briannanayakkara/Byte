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
