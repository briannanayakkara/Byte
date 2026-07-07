interface ThoughtBubbleProps {
  emojis: string[]
}

// A classic comic "thinking cloud" -- a big rounded bubble plus two small
// trailing circles leading down toward the character's head -- shown
// during occasional idle "what's Byte thinking about" beats (App.tsx),
// distinct from SpeechBubble (which only shows actual replies/greetings).
export function ThoughtBubble({ emojis }: ThoughtBubbleProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
      <div className="flex flex-col items-end">
        <div className="rounded-[999px] bg-white/95 px-5 py-3 text-2xl shadow-lg">{emojis.join(' ')}</div>
        <div className="mr-10 mt-1 h-3 w-3 rounded-full bg-white/95 shadow" />
        <div className="mr-6 mt-1 h-2 w-2 rounded-full bg-white/95 shadow" />
      </div>
    </div>
  )
}
