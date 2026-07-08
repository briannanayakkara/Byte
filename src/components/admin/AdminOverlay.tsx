// src/components/admin/AdminOverlay.tsx
import { useEffect, useState } from 'react'
import { AdminLogin } from './AdminLogin'
import { AdminPanel } from './AdminPanel'
import { fetchAdminData } from '../../lib/adminApi'
import type { AdminData } from '../../lib/adminApi'

interface AdminOverlayProps {
  onClose: () => void
}

// null = still checking for an existing session; 'unauthorized' = no/expired
// session, show the password form; AdminData = authorized and loaded.
type OverlayState = AdminData | 'unauthorized' | null

export function AdminOverlay({ onClose }: AdminOverlayProps) {
  const [data, setData] = useState<OverlayState>(null)

  useEffect(() => {
    let cancelled = false
    fetchAdminData().then((result) => {
      if (!cancelled) setData(result ?? 'unauthorized')
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (data === null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80">
        <p className="text-sm text-white/60">Loading admin panel...</p>
      </div>
    )
  }

  if (data === 'unauthorized') {
    return (
      <AdminLogin
        onSuccess={() => {
          setData(null)
          fetchAdminData().then((result) => setData(result ?? 'unauthorized'))
        }}
        onClose={onClose}
      />
    )
  }

  return <AdminPanel initialData={data} onClose={onClose} />
}
