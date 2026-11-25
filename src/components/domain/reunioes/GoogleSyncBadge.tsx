'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Status { configured: boolean; last_ok_at?: string | null; last_error?: string | null }

function ago(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 2) return 'agora há pouco'
  if (min < 60) return `há ${min} min`
  if (min < 60 * 24) return `há ${Math.floor(min / 60)}h`
  return `há ${Math.floor(min / 1440)} dia(s)`
}

// Situação do Google Agenda, com botão de sincronizar na hora. Some enquanto não estiver ligado.
export function GoogleSyncBadge({ onSynced }: { onSynced: () => void }) {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/meetings/google').then(r => r.json()).then(d => { if (alive) setStatus(d) }).catch(() => {})
    return () => { alive = false }
  }, [])

  async function syncNow() {
    setBusy(true)
    const res = await fetch('/api/meetings/google', { method: 'POST' }).catch(() => null)
    if (res?.ok) { setStatus(await res.json()); onSynced() }
    setBusy(false)
  }

  if (!status?.configured) return null
  const error = status.last_error
  return (
    <div className="mt-1.5 text-xs">
      <button onClick={syncNow} disabled={busy} title="Sincronizar agora" className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground disabled:opacity-60">
        <RefreshCw size={11} className={busy ? 'animate-spin' : ''} />
        Google Agenda: {busy ? 'sincronizando...' : status.last_ok_at ? `sincronizado ${ago(status.last_ok_at)}` : 'ainda não sincronizou'}
      </button>
      {error && <p className="flex items-start gap-1.5 text-[#f59e0b] mt-1"><AlertTriangle size={11} className="mt-0.5 shrink-0" />{error}</p>}
    </div>
  )
}
