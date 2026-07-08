import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchPlayFact } from '../lib/chatApi'
import type { Mood } from '../types'

interface PlayActivity {
  mood: Mood
  durationMs: number
}

// docs/superpowers/specs/2026-07-08-go-play-mode-design.md §2. The short
// flourishes (flip/backflip/spin/jump/wiggle) are held for several times
// their own animation cycle rather than one -- switching to a brand new
// activity every single cycle (as fast as 1.6s) read as nonstop and
// frantic rather than a kid having fun. `stretch`/`sit` are genuine calm
// beats mixed in, per docs/byte-base-personality.md's "sit/stretch for
// calm lazy beats" -- Byte isn't only high-energy even while playing.
const PLAY_ACTIVITIES: PlayActivity[] = [
  { mood: 'skate', durationMs: 13_000 },
  { mood: 'playball', durationMs: 10_000 },
  { mood: 'jam', durationMs: 9_000 },
  { mood: 'flip', durationMs: 5_000 },
  { mood: 'backflip', durationMs: 5_000 },
  { mood: 'spin', durationMs: 4_500 },
  { mood: 'jump', durationMs: 4_000 },
  { mood: 'wiggle', durationMs: 6_000 },
  { mood: 'moonwalk', durationMs: 9_000 },
  { mood: 'stretch', durationMs: 5_000 },
  { mood: 'sit', durationMs: 6_000 },
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
// activity switch look like an interruption rather than a new trick. Each
// fact stays on screen until the next one replaces it (no auto-hide) --
// it's the only content in the bubble while playing.
const FIRST_FACT_DELAY_MS = 8_000
const FACT_INTERVAL_MS = 120_000

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

  const stop = useCallback(() => {
    activeRef.current = false
    if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current)
    if (factTimeoutRef.current) clearTimeout(factTimeoutRef.current)
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
          if (activeRef.current) setFact(reply)
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
    }
  }, [])

  return { isPlaying, fact, start, stop }
}
