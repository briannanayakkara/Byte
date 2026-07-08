import { useState } from 'react'
import type { AdminImportantDate } from '../../../types/admin'
import { adminMutate } from '../../../lib/adminApi'
import { AdminCard } from '../AdminCard'
import { SaveStatusLabel } from '../SaveStatusLabel'
import { useSaveStatus } from '../useSaveStatus'

interface ImportantDatesSectionProps {
  userId: string
  dates: AdminImportantDate[]
  onSaved: () => void
}

export function ImportantDatesSection({ userId, dates, onSaved }: ImportantDatesSectionProps) {
  const { status, run } = useSaveStatus()
  const [label, setLabel] = useState('')
  const [date, setDate] = useState('')
  const [recurring, setRecurring] = useState(false)

  function deleteDate(id: string) {
    run(async () => {
      await adminMutate({ resource: 'importantDate', action: 'delete', id })
      onSaved()
    })
  }

  function addDate() {
    if (!label.trim() || !date) return
    run(async () => {
      await adminMutate({
        resource: 'importantDate',
        action: 'create',
        userId,
        fields: { label: label.trim(), date, recurring, notes: null },
      })
      setLabel('')
      setDate('')
      setRecurring(false)
      onSaved()
    })
  }

  return (
    <AdminCard title="Important dates">
      <div className="flex flex-col gap-2">
        {dates.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
            <span>
              {d.label} — {d.date} {d.recurring ? '(recurring)' : ''}
            </span>
            <button onClick={() => deleteDate(d.id)} className="text-xs text-red-400 hover:text-red-300">
              Delete
            </button>
          </div>
        ))}
        {dates.length === 0 && <p className="text-xs text-white/40">No important dates yet.</p>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label"
          className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:bg-white/20"
        />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:bg-white/20" />
        <label className="flex items-center gap-1 text-xs text-white/50">
          <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
          Recurring
        </label>
        <button onClick={addDate} className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-900 hover:bg-white/90">
          Add
        </button>
      </div>
      <div className="mt-2 flex justify-end">
        <SaveStatusLabel status={status} />
      </div>
    </AdminCard>
  )
}
