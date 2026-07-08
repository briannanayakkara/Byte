import { useCallback, useRef, useState } from 'react'
import { fetchPlayFact } from '../lib/chatApi'
import type { Mood } from '../types'

interface PlayActivity {
  mood: Mood
  durationMs: number
}

// docs/superpowers/specs/2026-07-08-go-play-mode-design.md §2. Each
// duration matches (or is a clean multiple of) that mood's actual
// animation cycle length in Character.tsx, so a switch always lands on a
// natural loop boundary -- never a mid-routine cut.
const PLAY_ACTIVITIES: PlayActivity[] = [
  { mood: 'skate', durationMs: 13_000 },
  { mood: 'playball', durationMs: 10_000 },
  { mood: 'jam', durationMs: 9_000 },
  { mood: 'flip', durationMs: 2_500 },
  { mood: 'backflip', durationMs: 2_500 },
  { mood: 'spin', durationMs: 2_000 },
  { mood: 'jump', durationMs: 1_600 },
  { mood: 'wiggle', durationMs: 3_000 },
  { mood: 'moonwalk', durationMs: 6_000 },
]

// Avoids repeating the immediately-previous activity so back-to-back
// switches always feel like a new thing, not a stutter. Accepts an
// injectable random source purely for deterministic unit testing.
export function pickNextActivity(previous: Mood | null, random: () => number = Math.random): PlayActivity {
  const candidates = previous ? PLAY_ACTIVITIES.filter((a) => a.mood !== previous) : PLAY_ACTIVITIES
  return candidates[Math.floor(random() * candidates.length)]
}

interface UsePlayModeResult {
  isPlaying: boolean
  fact: string | null
  start: () => void
  stop: () => void
}

export function usePlayMode(): UsePlayModeResult {
  const [isPlaying, setIsPlaying] = useState(false)
  const [fact, setFact] = useState<string | null>(null)
  const activeRef = useRef(false)
  const previousMoodRef = useRef<Mood | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const stop = useCallback(() => {
    activeRef.current = false
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsPlaying(false)
    setFact(null)
  }, [])

  const start = useCallback(() => {
    if (activeRef.current) return
    activeRef.current = true
    previousMoodRef.current = null
    setIsPlaying(true)

    function playNext() {
      if (!activeRef.current) return
      const activity = pickNextActivity(previousMoodRef.current)
      previousMoodRef.current = activity.mood
      window.Byte?.set(activity.mood)
      fetchPlayFact()
        .then(({ reply }) => {
          if (activeRef.current) setFact(reply)
        })
        .catch(() => {
          // Non-critical: no fact this round, keep playing regardless.
        })
      timeoutRef.current = setTimeout(playNext, activity.durationMs)
    }
    playNext()
  }, [])

  return { isPlaying, fact, start, stop }
}
