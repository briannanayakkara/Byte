import type { Mood } from './types'

// Design doc docs/superpowers/specs/2026-07-07-byte-v3-character-and-continuity-design.md
// §1a: Character.tsx assigns this on mount and deletes it on unmount --
// the app's only way to change Byte's pose, replacing the old `mood` prop.
declare global {
  interface Window {
    Byte?: {
      set(name: Mood): void
      list(): Mood[]
    }
  }
}
