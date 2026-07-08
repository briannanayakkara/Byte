// src/components/admin/sections/CharacterStateSection.tsx
import { useState } from 'react'
import type { AdminCharacterState } from '../../../types/admin'
import { adminMutate } from '../../../lib/adminApi'
import { AdminCard } from '../AdminCard'
import { SaveStatusLabel } from '../SaveStatusLabel'
import { useSaveStatus } from '../useSaveStatus'

interface CharacterStateSectionProps {
  userId: string
  state: AdminCharacterState | null
  onSaved: () => void
}

export function CharacterStateSection({ userId, state, onSaved }: CharacterStateSectionProps) {
  const [mood, setMood] = useState(state?.mood ?? 'neutral')
  const [energy, setEnergy] = useState(state?.energy ?? 100)
  const [relationshipLevel, setRelationshipLevel] = useState(state?.relationship_level ?? 1)
  const [interactionCount, setInteractionCount] = useState(state?.interaction_count ?? 0)
  const [streakDays, setStreakDays] = useState(state?.streak_days ?? 0)
  const [personalityNotes, setPersonalityNotes] = useState(state?.personality_notes ?? '')
  const { status, run } = useSaveStatus()

  function handleSave() {
    run(async () => {
      await adminMutate({
        resource: 'characterState',
        userId,
        fields: {
          mood,
          energy: Number(energy),
          relationship_level: Number(relationshipLevel),
          interaction_count: Number(interactionCount),
          streak_days: Number(streakDays),
          personality_notes: personalityNotes || null,
        },
      })
      onSaved()
    })
  }

  const inputClass = 'rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:bg-white/20'
  const labelClass = 'flex flex-col gap-1 text-xs text-white/50'

  return (
    <AdminCard title="Character state">
      <div className="grid grid-cols-3 gap-3">
        <label className={labelClass}>
          Mood
          <input value={mood} onChange={(e) => setMood(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Energy (0-100)
          <input type="number" min={0} max={100} value={energy} onChange={(e) => setEnergy(Number(e.target.value))} className={inputClass} />
        </label>
        <label className={labelClass}>
          Relationship level (1-4)
          <input
            type="number"
            min={1}
            max={4}
            value={relationshipLevel}
            onChange={(e) => setRelationshipLevel(Number(e.target.value))}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Interaction count
          <input type="number" min={0} value={interactionCount} onChange={(e) => setInteractionCount(Number(e.target.value))} className={inputClass} />
        </label>
        <label className={labelClass}>
          Streak days
          <input type="number" min={0} value={streakDays} onChange={(e) => setStreakDays(Number(e.target.value))} className={inputClass} />
        </label>
        <label className={`${labelClass} col-span-3`}>
          Personality notes (tell Byte about the user)
          <textarea value={personalityNotes} onChange={(e) => setPersonalityNotes(e.target.value)} rows={3} className={inputClass} />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        <SaveStatusLabel status={status} />
        <button onClick={handleSave} className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-900 hover:bg-white/90">
          Save
        </button>
      </div>
    </AdminCard>
  )
}
