// src/components/admin/AdminLogin.tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { adminLogin } from '../../lib/adminApi'

interface AdminLoginProps {
  onSuccess: () => void
  onClose: () => void
}

export function AdminLogin({ onSuccess, onClose }: AdminLoginProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [checking, setChecking] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!password || checking) return
    setChecking(true)
    setError(false)
    const ok = await adminLogin(password)
    setChecking(false)
    if (ok) {
      onSuccess()
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3 rounded-2xl bg-slate-800 p-6 shadow-xl">
        <h2 className="text-sm font-semibold text-white/90">Admin access</h2>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="rounded-lg bg-white/10 px-3 py-2 text-sm text-white outline-none focus:bg-white/20"
        />
        {error && <p className="text-xs text-red-400">Incorrect password.</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1.5 text-xs text-white/60 hover:text-white">
            Cancel
          </button>
          <button
            type="submit"
            disabled={checking}
            className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-slate-900 hover:bg-white/90 disabled:opacity-50"
          >
            {checking ? '...' : 'Enter'}
          </button>
        </div>
      </form>
    </div>
  )
}
