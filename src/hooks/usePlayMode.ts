import { useCallback, useEffect, useRef, useState } from 'react'
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

// Facts are deliberately on their own slow cadence, independent of activity
// switching -- fetching one on every activity change (as short as 1.6s for
// a flourish move) made facts fire almost continuously and made every
// activity switch look like an interruption rather than a new trick.
const FIRST_FACT_DELAY_MS = 8_000
const FACT_INTERVAL_MS = 120_000
const FACT_VISIBLE_MS = 5_000

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
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const factTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const factHideTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const stop = useCallback(() => {
    activeRef.current = false
    if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
    if (factTimeoutRef.current) clearTimeout(factTimeoutRef.current)
    if (factHideTimeoutRef.current) clearTimeout(factHideTimeoutRef.current)
    setIsPlaying(false)
    setFact(null)
  }, [])

  const start = useCallback(() => {
    if (activeRef.current) return
    activeRef.current = true
    previousMoodRef.current = null
    setIsPlaying(true)

    function playNextActivity() {
      if (!activeRef.current) return
      const activity = pickNextActivity(previousMoodRef.current)
      previousMoodRef.current = activity.mood
      window.Byte?.set(activity.mood)
      activityTimeoutRef.current = setTimeout(playNextActivity, activity.durationMs)
    }

    function fetchNextFact() {
      if (!activeRef.current) return
      fetchPlayFact()
        .then(({ reply }) => {
          if (!activeRef.current) return
          setFact(reply)
          factHideTimeoutRef.current = setTimeout(() => {
            if (activeRef.current) setFact(null)
          }, FACT_VISIBLE_MS)
        })
        .catch(() => {
          // Non-critical: no fact this round, keep playing regardless.
        })
        .finally(() => {
          if (activeRef.current) factTimeoutRef.current = setTimeout(fetchNextFact, FACT_INTERVAL_MS)
        })
    }

    playNextActivity()
    factTimeoutRef.current = setTimeout(fetchNextFact, FIRST_FACT_DELAY_MS)
  }, [])

  useEffect(() => {
    return () => {
      activeRef.current = false
      if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
      if (factTimeoutRef.current) clearTimeout(factTimeoutRef.current)
      if (factHideTimeoutRef.current) clearTimeout(factHideTimeoutRef.current)
    }
  }, [])

  return { isPlaying, fact, start, stop }
}
