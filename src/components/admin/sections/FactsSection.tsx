import { useState } from 'react'
import type { AdminFact } from '../../../types/admin'
import { FACT_CATEGORIES } from '../../../types/admin'
import { adminMutate } from '../../../lib/adminApi'
import { AdminCard } from '../AdminCard'
import { SaveStatusLabel } from '../SaveStatusLabel'
import { useSaveStatus } from '../useSaveStatus'

interface FactsSectionProps {
  userId: string
  facts: AdminFact[]
  onSaved: () => void
}

export function FactsSection({ userId, facts, onSaved }: FactsSectionProps) {
  const { status, run } = useSaveStatus()
  const [newContent, setNewContent] = useState('')
  const [newCategory, setNewCategory] = useState<(typeof FACT_CATEGORIES)[number]>('other')

  function saveFact(id: string, content: string, category: string) {
    run(async () => {
      await adminMutate({ resource: 'fact', action: 'update', id, fields: { content, category } })
      onSaved()
    })
  }

  function deleteFact(id: string) {
    run(async () => {
      await adminMutate({ resource: 'fact', action: 'delete', id })
      onSaved()
    })
  }

  function addFact() {
    if (!newContent.trim()) return
    run(async () => {
      await adminMutate({ resource: 'fact', action: 'create', userId, content: newContent.trim(), category: newCategory })
      setNewContent('')
      onSaved()
    })
  }

  return (
    <AdminCard title="Facts">
      <div className="flex flex-col gap-2">
        {facts.map((fact) => (
          <FactRow key={fact.id} fact={fact} onSave={saveFact} onDelete={deleteFact} />
        ))}
        {facts.length === 0 && <p className="text-xs text-white/40">No facts yet.</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="New fact..."
          className="flex-1 rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:bg-white/20"
        />
        <select
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value as (typeof FACT_CATEGORIES)[number])}
          className="rounded-lg bg-white/10 px-2 py-2 text-sm text-white outline-none"
        >
          {FACT_CATEGORIES.map((c) => (
            <option key={c} value={c} className="text-slate-900">
              {c}
            </option>
          ))}
        </select>
        <button onClick={addFact} className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-900 hover:bg-white/90">
          Add
        </button>
      </div>
      <div className="mt-2 flex justify-end">
        <SaveStatusLabel status={status} />
      </div>
    </AdminCard>
  )
}

interface FactRowProps {
  fact: AdminFact
  onSave: (id: string, content: string, category: string) => void
  onDelete: (id: string) => void
}

function FactRow({ fact, onSave, onDelete }: FactRowProps) {
  const [content, setContent] = useState(fact.content)
  const [category, setCategory] = useState(fact.category)
  const dirty = content !== fact.content || category !== fact.category

  return (
    <div className="flex items-center gap-2">
      <input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm text-white outline-none focus:bg-white/20"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as AdminFact['category'])}
        className="rounded-lg bg-white/10 px-2 py-1.5 text-xs text-white outline-none"
      >
        {FACT_CATEGORIES.map((c) => (
          <option key={c} value={c} className="text-slate-900">
            {c}
          </option>
        ))}
      </select>
      {dirty && (
        <button onClick={() => onSave(fact.id, content, category)} className="text-xs text-emerald-400 hover:text-emerald-300">
          Save
        </button>
      )}
      <button onClick={() => onDelete(fact.id)} className="text-xs text-red-400 hover:text-red-300">
        Delete
      </button>
    </div>
  )
}
