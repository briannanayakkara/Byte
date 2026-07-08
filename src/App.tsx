import { useEffect, useRef, useState } from 'react'
import { Character } from './components/Character'
import { ChatInput } from './components/ChatInput'
import { MoodBubble } from './components/MoodBubble'
import { SpeechBubble } from './components/SpeechBubble'
import { ThoughtBubble } from './components/ThoughtBubble'
import { usePlayMode } from './hooks/usePlayMode'
import { fetchGreeting, sendChatMessage } from './lib/chatApi'
import type { ChatMessage, Mood } from './types'

// Spec §8 error handling: in-character fallback line + confused mood if
// /api/chat fails.
const ERROR_REPLY = "aw beans, my brain short-circuited — you're just too cute. say that again?"

// Occasional idle beats while nobody's chatting -- either a goofy "what's
// Byte thinking about" emoji cloud, or an actual spoken goofy one-liner.
// Purely decorative (client-side random, no LLM call) rather than a real
// generated thought, since spec §13 explicitly defers real proactive/
// autonomous behaviors to post-v1. One or the other per beat, never both,
// so it stays readable.
const THOUGHTS = [
  ['🍌', '🤔'],
  ['🎮', '✨'],
  ['☕', '💭'],
  ['🐒', '💭'],
  ['🍕', '😋'],
  ['🌙', '💤'],
  ['💭', '🥰'],
  ['🤔', '💌'],
  ['🍌', '❤️'],
]
// Goofy, self-deprecating, PG one-liners in Byte's voice -- no flirting,
// short, matching the personality tuning in personality_base's distilled_prompt
// (loaded via api/lib/personality.ts, see docs/byte-base-personality.md).
const IDLE_FACTS = [
  "fun fact: i can technically count to infinity. it just takes a while and i lose interest around forty.",
  "did you know a shrimp's heart is in its head? mine's in my chest. probably. i haven't checked.",
  'i tried to learn the violin once. i do not have hands built for that. or ears, really.',
  "bananas are berries but strawberries aren't. the universe is a lawless place.",
  'i once stared at a wall for six minutes straight. ten out of ten, would recommend.',
  "octopuses have three hearts. i only have one, so i'm using it wisely. probably.",
  'a group of flamingos is called a flamboyance. i would like to be one someday.',
  "i can't feel cold, but i still get dramatic about winter for the vibes.",
  'there are more possible chess games than atoms in the universe. i would still lose to a toaster.',
  'sharks existed before trees. i find that deeply unsettling and also kind of iconic.',
]
const THOUGHT_MIN_DELAY_MS = 20_000
const THOUGHT_MAX_DELAY_MS = 40_000
const THOUGHT_VISIBLE_MS = 3_200
const FACT_VISIBLE_MS = 4_500

// Idle play: while nobody's chatting, Byte periodically does something
// playful on its own (client-side random, no LLM call) instead of just
// standing there, and keeps cycling through moves until the user actually
// sends something. "wave" is deliberately excluded -- that's reserved for
// the greeting-on-open moment, not random idling.
const IDLE_MOVES: Mood[] = ['dancing', 'flip', 'backflip', 'spin', 'jump', 'wiggle', 'stretch', 'lookaround', 'walk', 'run', 'moonwalk', 'sit']
const IDLE_MOVE_MIN_DELAY_MS = 15_000
const IDLE_MOVE_MAX_DELAY_MS = 35_000

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  // Spec §5c "Greeting on return" -- kept separate from `messages` so it
  // never gets sent back to Gemini as fake conversation history.
  const [greeting, setGreeting] = useState<string | null>(null)
  const [thought, setThought] = useState<string[] | null>(null)
  const [fact, setFact] = useState<string | null>(null)
  const isSendingRef = useRef(isSending)
  const hasBubbleRef = useRef(false)
  const playMode = usePlayMode()
  const isPlayingRef = useRef(false)

  useEffect(() => {
    isPlayingRef.current = playMode.isPlaying
  }, [playMode.isPlaying])

  useEffect(() => {
    // Design doc §2/§3: wave immediately (a greeting gesture, not an
    // invented mood claim) while the greeting call is in flight, then
    // switch to whatever mood the greeting actually resolves to -- which
    // now reflects Byte's real last-persisted state (design doc §3), not a
    // fresh per-device guess.
    window.Byte?.set('wave')
    fetchGreeting()
      .then(({ reply, mood: greetingMood }) => {
        setGreeting(reply)
        window.Byte?.set(greetingMood)
      })
      .catch(() => {
        // Non-critical: no greeting, no mood change -- just no bubble yet.
      })
  }, [])

  useEffect(() => {
    isSendingRef.current = isSending
  }, [isSending])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    function scheduleNext() {
      const delay = THOUGHT_MIN_DELAY_MS + Math.random() * (THOUGHT_MAX_DELAY_MS - THOUGHT_MIN_DELAY_MS)
      timeoutId = setTimeout(() => {
        // Only daydream/ramble between conversations -- not mid-send, not
        // over an active reply/greeting bubble. Coin flip between an emoji
        // thought and an actual spoken fact so it stays varied.
        if (!isSendingRef.current && !hasBubbleRef.current && !isPlayingRef.current) {
          if (Math.random() < 0.5) {
            setThought(THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)])
            setTimeout(() => setThought(null), THOUGHT_VISIBLE_MS)
          } else {
            setFact(IDLE_FACTS[Math.floor(Math.random() * IDLE_FACTS.length)])
            setTimeout(() => setFact(null), FACT_VISIBLE_MS)
          }
        }
        scheduleNext()
      }, delay)
    }
    scheduleNext()
    return () => clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    function scheduleNext() {
      const delay = IDLE_MOVE_MIN_DELAY_MS + Math.random() * (IDLE_MOVE_MAX_DELAY_MS - IDLE_MOVE_MIN_DELAY_MS)
      timeoutId = setTimeout(() => {
        // Only play while nothing real is happening -- a reply landing
        // right after would just override the move anyway, so skip it
        // mid-send rather than trigger a pose that's immediately replaced.
        if (!isSendingRef.current && !isPlayingRef.current) {
          window.Byte?.set(IDLE_MOVES[Math.floor(Math.random() * IDLE_MOVES.length)])
        }
        scheduleNext()
      }, delay)
    }
    scheduleNext()
    return () => clearTimeout(timeoutId)
  }, [])

  async function handleSend(text: string) {
    playMode.stop()
    setThought(null)
    setFact(null)
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setIsSending(true)
    try {
      const { reply, mood: replyMood } = await sendChatMessage(text)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      window.Byte?.set(replyMood)
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: ERROR_REPLY }])
      window.Byte?.set('confused')
    } finally {
      setIsSending(false)
    }
  }

  const bubbleText = messages.at(-1)?.content ?? greeting
  hasBubbleRef.current = bubbleText != null

  return (
    <div className="relative h-svh w-svw bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <div className="flex h-full items-center justify-center">
        {/* Sized to the character itself (not the full-height flex row), so
            the bubble below anchors right above its head at any screen
            size instead of floating at a fixed distance from the screen
            top. */}
        <div className="relative">
          <Character />
          <MoodBubble />
          {thought ? (
            <ThoughtBubble emojis={thought} />
          ) : fact ? (
            <SpeechBubble text={fact} />
          ) : playMode.fact ? (
            <SpeechBubble text={playMode.fact} />
          ) : (
            bubbleText && <SpeechBubble text={bubbleText} />
          )}
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-3 px-4">
        <button
          type="button"
          onClick={playMode.start}
          disabled={isSending || playMode.isPlaying}
          className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          {playMode.isPlaying ? 'playing...' : 'Go play'}
        </button>
        <ChatInput onSend={handleSend} disabled={isSending} />
      </div>
    </div>
  )
}

export default App
