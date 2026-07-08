// src/components/admin/sections/UserSection.tsx
import { useState } from 'react'
import type { AdminUser } from '../../../types/admin'
import { adminMutate } from '../../../lib/adminApi'
import { AdminCard } from '../AdminCard'
import { SaveStatusLabel } from '../SaveStatusLabel'
import { useSaveStatus } from '../useSaveStatus'

interface UserSectionProps {
  user: AdminUser
  onSaved: () => void
}

export function UserSection({ user, onSaved }: UserSectionProps) {
  const [name, setName] = useState(user.name)
  const [nicknames, setNicknames] = useState(user.nicknames.join(', '))
  const [birthday, setBirthday] = useState(user.birthday ?? '')
  const [location, setLocation] = useState(user.location ?? '')
  const [pronouns, setPronouns] = useState(user.pronouns ?? '')
  const [notes, setNotes] = useState(user.notes ?? '')
  const { status, run } = useSaveStatus()

  function handleSave() {
    run(async () => {
      await adminMutate({
        resource: 'user',
        id: user.id,
        fields: {
          name,
          nicknames: nicknames.split(',').map((n) => n.trim()).filter(Boolean),
          birthday: birthday || null,
          location: location || null,
          pronouns: pronouns || null,
          notes: notes || null,
        },
      })
      onSaved()
    })
  }

  const inputClass = 'rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:bg-white/20'
  const labelClass = 'flex flex-col gap-1 text-xs text-white/50'

  return (
    <AdminCard title="Profile">
      <div className="grid grid-cols-2 gap-3">
        <label className={labelClass}>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Nicknames (comma separated)
          <input value={nicknames} onChange={(e) => setNicknames(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Birthday
          <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Location
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Pronouns
          <input value={pronouns} onChange={(e) => setPronouns(e.target.value)} className={inputClass} />
        </label>
        <label className={`${labelClass} col-span-2`}>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputClass} />
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
