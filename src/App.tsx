import { useEffect, useState } from 'react'
import { Character } from './components/Character'
import { ChatInput } from './components/ChatInput'
import { SpeechBubble } from './components/SpeechBubble'
import { fetchGreeting, sendChatMessage } from './lib/chatApi'
import type { ChatMessage, Mood } from './types'

const MOODS: Mood[] = ['neutral', 'happy', 'curious', 'sleepy', 'excited', 'confused', 'lovestruck']
// Spec §8 error handling: in-character fallback line + confused mood if
// /api/chat fails.
const ERROR_REPLY = "aw beans, my brain short-circuited — you're just too cute. say that again?"

function App() {
  const [mood, setMood] = useState<Mood>('neutral')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  // Spec §5c "Greeting on return" -- kept separate from `messages` so it
  // never gets sent back to Gemini as fake conversation history.
  const [greeting, setGreeting] = useState<string | null>(null)

  useEffect(() => {
    fetchGreeting()
      .then(({ reply, mood: greetingMood }) => {
        setGreeting(reply)
        setMood(greetingMood)
      })
      .catch(() => {
        // Non-critical: no greeting, no mood change -- just no bubble yet.
      })
  }, [])

  async function handleSend(text: string) {
    const history = messages
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setIsSending(true)
    try {
      const { reply, mood: replyMood } = await sendChatMessage(text, history)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      setMood(replyMood)
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: ERROR_REPLY }])
      setMood('confused')
    } finally {
      setIsSending(false)
    }
  }

  const bubbleText = messages.at(-1)?.content ?? greeting

  return (
    <div className="relative h-svh w-svw bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <Character mood={mood} />

      {bubbleText && <SpeechBubble text={bubbleText} />}

      <div className="absolute inset-x-0 bottom-4 flex flex-col items-center gap-3 px-4">
        <ChatInput onSend={handleSend} disabled={isSending} />

        {/* Temporary dev harness for verifying moods (spec §9 step 3) --
            the real mood driver is /api/chat's returned mood, wired in
            step 5. */}
        <div className="flex flex-col items-center gap-2 border-t border-white/10 pt-3">
          <div className="flex flex-wrap justify-center gap-2">
            {MOODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMood(m)}
                className={`rounded-full px-3 py-1 text-sm capitalize transition-colors ${
                  m === mood ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
