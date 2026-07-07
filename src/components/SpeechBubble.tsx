import { CloudBubble } from './CloudBubble'

interface SpeechBubbleProps {
  text: string
}

export function SpeechBubble({ text }: SpeechBubbleProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-full mb-1 flex justify-center px-4">
      <CloudBubble className="max-w-xs text-center text-sm text-slate-900">{text}</CloudBubble>
    </div>
  )
}
