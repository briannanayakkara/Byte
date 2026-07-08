import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

interface ChatInputProps {
  onSend: (text: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // A disabled <input> can't hold focus -- sending a message disables it
  // (correct, prevents double-submit) which forces a blur, and nothing
  // re-focuses it once the reply lands and it re-enables, so the user had
  // to click back into it before every message. Refocus whenever it
  // becomes usable again (also focuses it on first mount).
  useEffect(() => {
    if (!disabled) inputRef.current?.focus()
  }, [disabled])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const text = value.trim()
    if (!text || disabled) return
    onSend(text)
    setValue('')
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md gap-2">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Say something to Byte..."
        disabled={disabled}
        className="flex-1 rounded-full bg-white/10 px-4 py-2 text-sm text-white placeholder:text-white/50 outline-none focus:bg-white/20 disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={disabled}
        className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-white/90 disabled:opacity-50"
      >
        {disabled ? '...' : 'Send'}
      </button>
    </form>
  )
}
