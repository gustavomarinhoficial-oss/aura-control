'use client'

import { useCallback, useEffect, useState } from 'react'
import { Film, Plus, Undo2, Loader2 } from 'lucide-react'

interface Item { id: string; freelancer_name: string; total_videos: number; delivered: number }

// Contador de vídeos entregues pelo freelancer. Sem valores: o financeiro vê o mesmo
// pacote e lança a despesa quando ele fecha.
export function VideoPackageCounter() {
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/freelancer-packages/progress', { cache: 'no-store' }).catch(() => null)
    if (res?.ok) { setItems(await res.json()); setError('') }
    else {
      const d = res ? await res.json().catch(() => ({})) : {}
      setError(d.error ?? 'Não consegui carregar o contador de vídeos.')
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function change(id: string, delta: 1 | -1) {
    setBusy(id)
    await fetch('/api/freelancer-packages/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ package_id: id, delta }),
    }).catch(() => null)
    await load()
    setBusy(null)
  }

  if (error) return <p className="mb-4 text-xs text-[#ef4444]">Contador de vídeos: {error}</p>
  if (items.length === 0) return null

  return (
    <div className="mb-6 grid gap-3 sm:grid-cols-2">
      {items.map(p => {
        const complete = p.delivered >= p.total_videos
        const pct = Math.min(100, Math.round((p.delivered / p.total_videos) * 100))
        return (
          <div key={p.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Film size={14} className="shrink-0" />
                <p className="text-sm font-medium truncate">Vídeos: {p.freelancer_name}</p>
              </div>
              <p className="text-lg font-semibold leading-none shrink-0">{p.delivered}<span className="text-muted-foreground text-sm">/{p.total_videos}</span></p>
            </div>
            <div className="h-1.5 rounded-full bg-[#2a2a2a] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: complete ? '#22c55e' : '#efefef' }} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => change(p.id, 1)} disabled={busy === p.id}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#efefef] text-[#111111] hover:bg-[#d9d9d9] disabled:opacity-50">
                {busy === p.id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Vídeo entregue
              </button>
              {p.delivered > 0 && (
                <button onClick={() => change(p.id, -1)} disabled={busy === p.id} title="Desfazer o último" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5">
                  <Undo2 size={12} /> Desfazer
                </button>
              )}
              {complete && <span className="text-[11px] text-[#22c55e] ml-auto">Pacote completo!</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
