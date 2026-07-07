import type { ReactNode } from 'react'

interface CloudBubbleProps {
  children: ReactNode
  className?: string
}

// Shared "thought/speech cloud" shape -- a big rounded bubble with two
// trailing circles stepping down toward the character's head, used by both
// SpeechBubble (replies) and ThoughtBubble (idle daydreams) so they read as
// the same kind of thing coming from Byte, not two different UI styles.
export function CloudBubble({ children, className = '' }: CloudBubbleProps) {
  return (
    <div className="flex flex-col items-center">
      <div className={`rounded-[999px] bg-white/95 px-4 py-2 shadow-lg ${className}`}>{children}</div>
      <div className="mt-1 h-3 w-3 rounded-full bg-white/95 shadow" />
      <div className="-mt-0.5 ml-3 h-2 w-2 rounded-full bg-white/95 shadow" />
    </div>
  )
}
