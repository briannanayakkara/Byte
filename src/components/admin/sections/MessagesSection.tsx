// src/components/admin/sections/MessagesSection.tsx
import { adminMutate } from '../../../lib/adminApi'
import type { AdminMessage } from '../../../types/admin'
import { AdminCard } from '../AdminCard'
import { SaveStatusLabel } from '../SaveStatusLabel'
import { useSaveStatus } from '../useSaveStatus'

interface MessagesSectionProps {
  messages: AdminMessage[]
  onSaved: () => void
}

export function MessagesSection({ messages, onSaved }: MessagesSectionProps) {
  const { status, run } = useSaveStatus()

  function deleteMessage(id: string) {
    run(async () => {
      await adminMutate({ resource: 'message', action: 'delete', id })
      onSaved()
    })
  }

  return (
    <AdminCard title="Message history">
      <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
        {messages.map((m) => (
          <div key={m.id} className="flex items-start justify-between gap-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs">
            <span>
              <span className="font-medium text-white/60">{m.role}:</span> {m.content}
            </span>
            <button onClick={() => deleteMessage(m.id)} className="shrink-0 text-red-400 hover:text-red-300">
              Delete
            </button>
          </div>
        ))}
        {messages.length === 0 && <p className="text-xs text-white/40">No messages yet.</p>}
      </div>
      <div className="mt-2 flex justify-end">
        <SaveStatusLabel status={status} />
      </div>
    </AdminCard>
  )
}
