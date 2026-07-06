interface SpeechBubbleProps {
  text: string
}

export function SpeechBubble({ text }: SpeechBubbleProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-center px-4">
      <div className="relative max-w-sm rounded-2xl bg-white px-4 py-2 text-center text-sm text-slate-900 shadow-lg">
        {text}
        <div className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white" />
      </div>
    </div>
  )
}
