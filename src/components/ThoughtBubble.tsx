import { CloudBubble } from './CloudBubble'

interface ThoughtBubbleProps {
  emojis: string[]
}

// Occasional idle "what's Byte thinking about" beats (App.tsx), distinct
// from SpeechBubble only in content (emojis vs. actual replies/greetings)
// -- both use the same CloudBubble shape now so they read as one system.
export function ThoughtBubble({ emojis }: ThoughtBubbleProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-full mb-1 flex justify-center">
      <CloudBubble className="text-2xl">{emojis.join(' ')}</CloudBubble>
    </div>
  )
}
