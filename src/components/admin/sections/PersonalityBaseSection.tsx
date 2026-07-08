// src/components/admin/sections/PersonalityBaseSection.tsx
import { useState } from 'react'
import type { AdminPersonalityBase } from '../../../types/admin'
import { adminMutate } from '../../../lib/adminApi'
import { AdminCard } from '../AdminCard'
import { SaveStatusLabel } from '../SaveStatusLabel'
import { useSaveStatus } from '../useSaveStatus'

interface PersonalityBaseSectionProps {
  personalityBase: AdminPersonalityBase
  onSaved: () => void
}

export function PersonalityBaseSection({ personalityBase, onSaved }: PersonalityBaseSectionProps) {
  const [prompt, setPrompt] = useState(personalityBase.distilled_prompt)
  const { status, run } = useSaveStatus()

  function handleSave() {
    run(async () => {
      await adminMutate({ resource: 'personalityBase', id: personalityBase.id, distilledPrompt: prompt })
      onSaved()
    })
  }

  return (
    <AdminCard title={`Base personality (v${personalityBase.version})`}>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={8}
        className="w-full rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:bg-white/20"
      />
      <div className="mt-3 flex items-center justify-end gap-3">
        <SaveStatusLabel status={status} />
        <button onClick={handleSave} className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-900 hover:bg-white/90">
          Save
        </button>
      </div>
    </AdminCard>
  )
}
