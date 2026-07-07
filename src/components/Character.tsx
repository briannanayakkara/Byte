import type { Mood } from '../types'

// 2D illustration, swapped by src per mood (spec §6) -- replaces the R3F/
// Three.js character entirely (its animations weren't reading well). Assets
// built from a Freepik stock sheet by scripts/build-character-assets.mjs.
// "sleepy"/"lovestruck" have no distinct face art in the source kit, so
// they reuse the neutral face and add a sticker-style overlay instead (the
// old 3D version's equivalent trick for lovestruck: an orbiting heart halo
// rather than swapped eye geometry).
const MOOD_IMAGES: Record<Mood, string> = {
  neutral: '/character/mood-neutral.png',
  happy: '/character/mood-happy.png',
  excited: '/character/mood-excited.png',
  curious: '/character/mood-curious.png',
  confused: '/character/mood-confused.png',
  sleepy: '/character/mood-neutral.png',
  lovestruck: '/character/mood-neutral.png',
}

interface CharacterProps {
  mood: Mood
}

export function Character({ mood }: CharacterProps) {
  return (
    <div className="relative flex h-full items-center justify-center">
      <img
        key={mood}
        src={MOOD_IMAGES[mood]}
        alt="Byte"
        className="h-auto max-h-[65vh] w-auto animate-[character-fade-in_250ms_ease-out]"
      />
      {mood === 'lovestruck' && <HeartOverlay />}
      {mood === 'sleepy' && <SleepyOverlay />}
    </div>
  )
}

function HeartOverlay() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[12%] flex justify-center gap-3 text-3xl">
      <span className="animate-bounce">💕</span>
      <span className="animate-bounce [animation-delay:150ms]">💕</span>
      <span className="animate-bounce [animation-delay:300ms]">💕</span>
    </div>
  )
}

function SleepyOverlay() {
  return (
    <div className="pointer-events-none absolute right-[28%] top-[16%] animate-pulse text-2xl">💤</div>
  )
}
