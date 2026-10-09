'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Check, X, Film, Loader2, ChevronDown, Trash2, RotateCw } from 'lucide-react'
import { formatBRL, formatDate } from '@/lib/utils/format'

interface Video { id: string; delivered_at: string; note: string | null }
interface Pkg {
  id: string
  freelancer_name: string
  total_videos: number
  amount: number
  status: 'aberto' | 'fechado'
  closed_at: string | null
  videos: Video[]
}

const inputCls = 'w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors'

// Pacotes de freelancer: conta os vídeos entregues e, quando o pacote fecha,
// lança a despesa de uma vez (sem recorrência mensal).
export function FreelancerPackages({ onExpenseLaunched }: { onExpenseLaunched: () => void }) {
  const [packages, setPackages] = useState<Pkg[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState({ freelancer_name: '', total_videos: '15', amount: '' })
  const [openId, setOpenId] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/freelancer-packages')
    const d = await res.json().catch(() => ({}))
    if (!res.ok) setError(d.error ?? 'Erro ao carregar (a migração 042 foi executada?)')
    else { setPackages(d); setError('') }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createPackage(payload: { freelancer_name: string; total_videos: number; amount: number }) {
    setBusy('new')
    const res = await fetch('/api/freelancer-packages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) setError(d.error ?? 'Erro')
    else { setCreating(false); setDraft({ freelancer_name: '', total_videos: '15', amount: '' }) }
    await load()
    setBusy(null)
  }

  async function act(id: string, body: Record<string, unknown>) {
    setBusy(id)
    const res = await fetch(`/api/freelancer-packages/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) setError(d.error ?? 'Erro')
    else setError('')
    await load()
    if (res.ok && body.action === 'launch_expense') onExpenseLaunched()
    setBusy(null)
  }

  async function remove(id: string) {
    if (!confirm('Apagar esse pacote e o registro dos vídeos? A despesa já lançada não é apagada.')) return
    setBusy(id)
    await fetch(`/api/freelancer-packages/${id}`, { method: 'DELETE' })
    await load()
    setBusy(null)
  }

  if (loading) return null

  const open = packages.filter(p => p.status === 'aberto')
  const closed = packages.filter(p => p.status === 'fechado')
  const totalDelivered = packages.reduce((s, p) => s + p.videos.length, 0)

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Film size={15} className="text-[#efefef]" />
          <div>
            <p className="text-sm font-semibold">Pacotes de freelancer</p>
            <p className="text-[11px] text-muted-foreground">
              {totalDelivered > 0 ? `${totalDelivered} vídeo${totalDelivered === 1 ? '' : 's'} entregue${totalDelivered === 1 ? '' : 's'} no total · ` : ''}
              A despesa só é lançada quando o pacote fecha.
            </p>
          </div>
        </div>
        <button onClick={() => setCreating(c => !c)} className="flex items-center gap-1.5 text-xs border border-[#2a2a2a] hover:bg-[#222222] px-3 py-1.5 rounded-lg transition-colors">
          {creating ? <X size={12} /> : <Plus size={12} />} {creating ? 'Cancelar' : 'Novo pacote'}
        </button>
      </div>

      {error && <p className="text-xs text-[#ef4444]">{error}</p>}

      {creating && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end rounded-lg border border-[#2a2a2a] p-3">
          <div className="sm:col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Freelancer</label>
            <input value={draft.freelancer_name} onChange={e => setDraft(d => ({ ...d, freelancer_name: e.target.value }))} placeholder="Ex: Editor de vídeo" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Vídeos</label>
            <input type="number" min={1} value={draft.total_videos} onChange={e => setDraft(d => ({ ...d, total_videos: e.target.value }))} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Valor (R$)</label>
            <input type="number" step="0.01" value={draft.amount} onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))} placeholder="1000" className={inputCls} />
          </div>
          <button
            onClick={() => createPackage({ freelancer_name: draft.freelancer_name, total_videos: Number(draft.total_videos), amount: Number(draft.amount) })}
            disabled={busy === 'new'}
            className="sm:col-span-4 bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111] text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {busy === 'new' ? 'Criando...' : 'Criar pacote'}
          </button>
        </div>
      )}

      {open.length === 0 && !creating && (
        <p className="text-xs text-muted-foreground">Nenhum pacote em andamento. Clique em &quot;Novo pacote&quot; para começar a contar.</p>
      )}

      {open.map(p => {
        const done = p.videos.length
        const complete = done >= p.total_videos
        const pct = Math.min(100, Math.round((done / p.total_videos) * 100))
        return (
          <div key={p.id} className="rounded-lg border border-[#2a2a2a] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{p.freelancer_name}</p>
                <p className="text-[11px] text-muted-foreground">Pacote de {p.total_videos} vídeos · {formatBRL(Number(p.amount))}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold leading-none">{done}<span className="text-muted-foreground text-sm">/{p.total_videos}</span></p>
                <p className="text-[11px] text-muted-foreground mt-1">{complete ? 'Pacote completo!' : `faltam ${p.total_videos - done}`}</p>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-[#2a2a2a] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: complete ? '#22c55e' : '#efefef' }} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => act(p.id, { action: 'add_video' })} disabled={busy === p.id}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#efefef] text-[#111111] hover:bg-[#d9d9d9] disabled:opacity-50">
                {busy === p.id ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} {complete ? 'Vídeo extra' : 'Vídeo entregue'}
              </button>
              {complete && (
                <button onClick={() => { if (confirm(`Lançar a despesa de ${formatBRL(Number(p.amount))} em Despesas?`)) act(p.id, { action: 'launch_expense' }) }} disabled={busy === p.id}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 hover:bg-[#22c55e]/20 disabled:opacity-50">
                  <Check size={12} /> Lançar despesa ({formatBRL(Number(p.amount))})
                </button>
              )}
              {!complete && done > 0 && (
                <button onClick={() => { if (confirm(`Fechar o pacote com ${done} de ${p.total_videos} vídeos e lançar a despesa de ${formatBRL(Number(p.amount))}?`)) act(p.id, { action: 'launch_expense' }) }} disabled={busy === p.id}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5">
                  Fechar antes
                </button>
              )}
              {done > 0 && (
                <button onClick={() => setOpenId(openId === p.id ? null : p.id)} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  Histórico <ChevronDown size={12} className={openId === p.id ? 'rotate-180' : ''} />
                </button>
              )}
              <button onClick={() => remove(p.id)} className="text-muted-foreground/50 hover:text-[#ef4444] p-1.5" aria-label="Apagar pacote"><Trash2 size={12} /></button>
            </div>
            {openId === p.id && (
              <div className="divide-y divide-[#2a2a2a] border-t border-[#2a2a2a]">
                {p.videos.map((v, i) => (
                  <div key={v.id} className="flex items-center justify-between py-1.5 text-xs">
                    <span>Vídeo {i + 1} <span className="text-muted-foreground">· {formatDate(v.delivered_at)}</span></span>
                    <button onClick={() => act(p.id, { action: 'remove_video', video_id: v.id })} className="text-muted-foreground/50 hover:text-[#ef4444]" aria-label="Remover"><X size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {closed.length > 0 && (
        <div>
          <button onClick={() => setShowHistory(h => !h)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            Pacotes fechados ({closed.length}) <ChevronDown size={12} className={showHistory ? 'rotate-180' : ''} />
          </button>
          {showHistory && (
            <div className="mt-2 divide-y divide-[#2a2a2a] rounded-lg border border-[#2a2a2a]">
              {closed.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                  <span>{p.freelancer_name} · {p.videos.length} vídeo{p.videos.length === 1 ? '' : 's'} · {formatBRL(Number(p.amount))}{p.closed_at ? ` · ${formatDate(p.closed_at.slice(0, 10))}` : ''}</span>
                  <button
                    onClick={() => createPackage({ freelancer_name: p.freelancer_name, total_videos: p.total_videos, amount: Number(p.amount) })}
                    disabled={busy === 'new'}
                    className="flex items-center gap-1 text-[#efefef] hover:underline shrink-0"
                  >
                    <RotateCw size={11} /> Novo igual
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
