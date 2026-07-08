// src/components/admin/AdminCard.tsx
import type { ReactNode } from 'react'

interface AdminCardProps {
  title: string
  children: ReactNode
}

export function AdminCard({ title, children }: AdminCardProps) {
  return (
    <section className="rounded-2xl bg-white/5 p-4">
      <h2 className="mb-3 text-sm font-semibold text-white/80">{title}</h2>
      {children}
    </section>
  )
}
