// src/components/admin/SaveStatusLabel.tsx
import type { SaveStatus } from './useSaveStatus'

export function SaveStatusLabel({ status }: { status: SaveStatus }) {
  if (status === 'saving') return <span className="text-xs text-white/40">Saving...</span>
  if (status === 'saved') return <span className="text-xs text-emerald-400">Saved</span>
  if (status === 'error') return <span className="text-xs text-red-400">Save failed</span>
  return null
}
