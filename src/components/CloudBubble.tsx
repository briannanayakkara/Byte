import type { ReactNode } from 'react'

interface CloudBubbleProps {
  children: ReactNode
  className?: string
}

// Shared "thought/speech cloud" shape -- a big rounded bubble with two
// trailing circles stepping down toward the character's head, used by both
// SpeechBubble (replies) and ThoughtBubble (idle daydreams) so they read as
// the same kind of thing coming from Byte, not two different UI styles.
//
// The bubble sits above the character via `bottom-full` (see SpeechBubble/
// ThoughtBubble) with nothing capping how tall it can grow -- a long reply
// wrapping onto many lines could push it above the top of the viewport with
// no scroll to reveal it, so it just vanished. `max-h-[42vh]` plus scroll
// guarantees it always stays reachable no matter how long the text is.
export function CloudBubble({ children, className = '' }: CloudBubbleProps) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`max-h-[42vh] overflow-y-auto rounded-[28px] bg-white/95 px-4 py-2 shadow-lg [scrollbar-width:thin] ${className}`}
      >
        {children}
      </div>
      <div className="mt-1 h-3 w-3 rounded-full bg-white/95 shadow" />
      <div className="-mt-0.5 ml-3 h-2 w-2 rounded-full bg-white/95 shadow" />
    </div>
  )
}
