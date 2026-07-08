// src/components/admin/useSaveStatus.ts
// Shared saving/saved/error state machine so each of the six admin sections
// (Tasks 8-10) doesn't reimplement the same three lines of useState.
import { useCallback, useState } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function useSaveStatus() {
  const [status, setStatus] = useState<SaveStatus>('idle')

  const run = useCallback((action: () => Promise<void>) => {
    setStatus('saving')
    action()
      .then(() => {
        setStatus('saved')
        setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 2000)
      })
      .catch(() => setStatus('error'))
  }, [])

  return { status, run }
}
