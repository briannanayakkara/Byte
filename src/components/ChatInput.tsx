import { useState } from 'react'
import type { FormEvent } from 'react'

interface ChatInputProps {
  onSend: (text: string) => void
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [value, setValue] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = value.trim()
    if (!text) return
    onSend(text)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Say something to Byte..."
        className="flex-1 rounded-full bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/50 outline-none focus:bg-white/20"
      />
      <button
        type="submit"
        className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-white/90"
      >
        Send
      </button>
    </form>
  )
}
