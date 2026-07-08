// src/components/admin/AdminPanel.tsx
import { useState } from 'react'
import { adminLogout, fetchAdminData } from '../../lib/adminApi'
import type { AdminData } from '../../lib/adminApi'
import { UserSection } from './sections/UserSection'
import { CharacterStateSection } from './sections/CharacterStateSection'
import { FactsSection } from './sections/FactsSection'
import { ImportantDatesSection } from './sections/ImportantDatesSection'
import { MessagesSection } from './sections/MessagesSection'
import { PersonalityBaseSection } from './sections/PersonalityBaseSection'

interface AdminPanelProps {
  initialData: AdminData
  onClose: () => void
}

export function AdminPanel({ initialData, onClose }: AdminPanelProps) {
  const [data, setData] = useState(initialData)
  const [switching, setSwitching] = useState(false)

  async function reload(userId?: string) {
    setSwitching(true)
    const result = await fetchAdminData(userId ?? data.selectedUserId ?? undefined)
    if (result) setData(result)
    setSwitching(false)
  }

  async function handleLogout() {
    await adminLogout()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/95 text-white">
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Byte admin</h1>
          <div className="flex items-center gap-3">
            <select
              value={data.selectedUserId ?? ''}
              disabled={switching}
              onChange={(e) => reload(e.target.value)}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-sm outline-none"
            >
              {data.users.map((u) => (
                <option key={u.id} value={u.id} className="text-slate-900">
                  {u.name}
                  {u.is_test ? ' (test)' : ''}
                </option>
              ))}
            </select>
            <button onClick={handleLogout} className="text-xs text-white/50 hover:text-white">
              Log out
            </button>
            <button onClick={onClose} className="text-xs text-white/50 hover:text-white">
              Close
            </button>
          </div>
        </header>

        {data.user && <UserSection key={data.user.id} user={data.user} onSaved={() => reload()} />}
        {data.selectedUserId && (
          <>
            <CharacterStateSection
              key={data.selectedUserId}
              userId={data.selectedUserId}
              state={data.characterState}
              onSaved={() => reload()}
            />
            <FactsSection userId={data.selectedUserId} facts={data.facts} onSaved={() => reload()} />
            <ImportantDatesSection userId={data.selectedUserId} dates={data.importantDates} onSaved={() => reload()} />
          </>
        )}
        <MessagesSection messages={data.messages} onSaved={() => reload()} />
        <PersonalityBaseSection personalityBase={data.personalityBase} onSaved={() => reload()} />
      </div>
    </div>
  )
}
