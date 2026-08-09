'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Target, Trash2, Check, X, TrendingUp, Zap } from 'lucide-react'
import { formatBRL, currentPeriod, getPeriodLabel } from '@/lib/utils/format'
import type { Goal } from '@/lib/supabase/types'

interface Client { id: string; name: string }

function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(deadline + 'T00:00:00')
  return Math.ceil((d.getTime() - today.getTime()) / 86400000)
}

function DeadlineBadge({ deadline }: { deadline: string | null }) {
  if (!deadline) return null
  const days = daysUntil(deadline)
  if (days === null) return null
  const overdue = days < 0
  const urgent = days >= 0 && days <= 7
  const color = overdue ? 'text-[#ef4444] bg-[#ef4444]/10' : urgent ? 'text-[#f59e0b] bg-[#f59e0b]/10' : 'text-muted-foreground bg-[#2a2a2a]'
  const label = overdue ? `${Math.abs(days)}d atrasada` : days === 0 ? 'Hoje' : `${days}d restantes`
  return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${color}`}>{label}</span>
}

interface GoalWithProgress extends Goal {
  computedCurrent: number
  pct: number
}

export default function MetasPage() {
  const [goals, setGoals] = useState<GoalWithProgress[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCurrent, setEditCurrent] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [goalsRes, dashRes, clientsRes] = await Promise.all([
      fetch('/api/goals').then(r => r.json()),
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
    ])

    const cp = currentPeriod()
    const withProgress: GoalWithProgress[] = (Array.isArray(goalsRes) ? goalsRes : []).map((g: Goal) => {
      // Metas sem título = auto-calculadas do dashboard
      const isAuto = !g.title
      let computedCurrent = Number(g.current_value ?? 0)
      if (isAuto && g.period === cp) {
        computedCurrent = g.type === 'mrr' ? (dashRes.mrr ?? 0) : (dashRes.activeClients ?? 0)
      }
      const pct = g.target_value > 0 ? Math.min(100, Math.round((computedCurrent / Number(g.target_value)) * 100)) : 0
      return { ...g, computedCurrent, pct }
    })

    setGoals(withProgress)
    setClients(Array.isArray(clientsRes) ? clientsRes : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function goalTitle(g: Goal): string {
    if (g.title) return g.title
    if (g.type === 'mrr') return 'MRR da agência'
    if (g.type === 'clientes') return 'Clientes ativos'
    return 'Meta'
  }

  function displayValue(g: GoalWithProgress): string {
    const isAuto = !g.title
    if (isAuto) {
      if (g.type === 'mrr') return `${formatBRL(g.computedCurrent)} / ${formatBRL(Number(g.target_value))}`
      return `${g.computedCurrent} / ${Number(g.target_value)} clientes`
    }
    const unit = g.unit ?? ''
    const cur = Number(g.computedCurrent)
    const tgt = Number(g.target_value)
    if (unit === 'R$') return `R$ ${cur.toLocaleString('pt-BR')} / R$ ${tgt.toLocaleString('pt-BR')}`
    return `${cur.toLocaleString('pt-BR')} / ${tgt.toLocaleString('pt-BR')}${unit ? ` ${unit}` : ''}`
  }

  function startEditCurrent(g: GoalWithProgress) {
    setEditingId(g.id)
    setEditCurrent(String(g.computedCurrent))
  }

  async function saveCurrent(id: string) {
    const val = parseFloat(editCurrent)
    if (isNaN(val) || val < 0) { setEditingId(null); return }
    setGoals(prev => prev.map(g => g.id === id ? { ...g, computedCurrent: val, current_value: val, pct: Math.min(100, Math.round((val / Number(g.target_value)) * 100)) } : g))
    setEditingId(null)
    await fetch(`/api/goals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_value: val }),
    })
  }

  async function deleteGoal(id: string) {
    if (!confirm('Apagar esta meta?')) return
    setDeletingId(id)
    await fetch(`/api/goals/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Metas</h1>
          <p className="text-sm text-muted-foreground mt-1">{goals.length} meta{goals.length !== 1 ? 's' : ''} cadastrada{goals.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Nova meta
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <Target size={32} className="text-muted-foreground" strokeWidth={1} />
          <div>
            <p className="text-sm font-medium">Nenhuma meta cadastrada</p>
            <p className="text-xs text-muted-foreground mt-1">Crie metas automáticas de MRR ou metas personalizadas</p>
          </div>
          <button onClick={() => setShowNew(true)} className="text-xs text-[#7c3aed] hover:text-[#a78bfa] transition-colors">
            Criar primeira meta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map(g => {
            const p = g.pct
            const isAuto = !g.title
            const isEditing = editingId === g.id
            const isDeleting = deletingId === g.id
            const done = p >= 100

            return (
              <div key={g.id} className="group bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold leading-snug">{goalTitle(g)}</p>
                      {isAuto && (
                        <span title="Atualizado automaticamente" className="text-[#7c3aed]">
                          <Zap size={11} fill="currentColor" />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {!isAuto && g.clients && (
                        <span className="text-[10px] text-[#a78bfa] bg-[#7c3aed]/10 px-2 py-0.5 rounded-full">
                          {g.clients.name}
                        </span>
                      )}
                      {isAuto && (
                        <span className="text-[10px] text-muted-foreground bg-[#2a2a2a] px-2 py-0.5 rounded-full capitalize">
                          {getPeriodLabel(g.period)}
                        </span>
                      )}
                      <DeadlineBadge deadline={g.deadline} />
                      {done && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-[#22c55e] bg-[#22c55e]/10">
                          Concluída!
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isAuto && (
                      <button
                        onClick={() => startEditCurrent(g)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#a78bfa] transition-all"
                        title="Atualizar progresso"
                      >
                        <TrendingUp size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => deleteGoal(g.id)}
                      disabled={isDeleting}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#ef4444] transition-all disabled:opacity-50"
                      title="Apagar meta"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Progresso */}
                <div>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-3xl font-bold tracking-tight">{p}%</span>
                    <span className="text-xs text-muted-foreground">{displayValue(g)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${p}%`, background: done ? '#22c55e' : '#7c3aed' }}
                    />
                  </div>
                </div>

                {/* Atualizar valor atual inline (só metas manuais) */}
                {isEditing && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-muted-foreground shrink-0">Valor atual:</span>
                    <input
                      type="number"
                      value={editCurrent}
                      onChange={e => setEditCurrent(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveCurrent(g.id); if (e.key === 'Escape') setEditingId(null) }}
                      autoFocus
                      className="flex-1 bg-[#111111] border border-[#7c3aed]/40 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
                    />
                    <button onClick={() => saveCurrent(g.id)} className="text-[#22c55e] hover:text-[#4ade80] transition-colors"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground hover:text-foreground transition-colors"><X size={14} /></button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showNew && (
        <NewGoalModal
          clients={clients}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load() }}
        />
      )}
    </div>
  )
}

function NewGoalModal({ clients, onClose, onCreated }: { clients: Client[]; onClose: () => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'auto' | 'custom'>('auto')
  const [autoType, setAutoType] = useState<'mrr' | 'clientes'>('mrr')
  const [form, setForm] = useState({
    title: '',
    client_id: '',
    target_value: '',
    current_value: '',
    unit: '',
    deadline: '',
  })

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - 3 + i)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return { val, label }
  })
  const [period, setPeriod] = useState(currentPeriod())

  function setF(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const target = parseFloat(form.target_value)
    if (isNaN(target) || target <= 0) { setError('Informe o valor alvo'); return }

    if (mode === 'auto') {
      setSaving(true)
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, type: autoType, target_value: target }),
      })
      if (!res.ok) { setError('Erro ao criar meta'); setSaving(false); return }
      onCreated()
      return
    }

    if (!form.title.trim()) { setError('Informe o título da meta'); return }
    setSaving(true)
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.title.trim(),
        client_id: form.client_id || null,
        target_value: target,
        current_value: parseFloat(form.current_value) || 0,
        unit: form.unit.trim() || null,
        deadline: form.deadline || null,
        type: 'custom',
      }),
    })
    if (!res.ok) { setError('Erro ao criar meta'); setSaving(false); return }
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-semibold">Nova meta</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {/* Modo */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('auto')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
                mode === 'auto' ? 'bg-[#7c3aed]/10 border-[#7c3aed]/30 text-[#a78bfa]' : 'border-[#2a2a2a] text-muted-foreground hover:text-foreground'
              }`}
            >
              <Zap size={11} fill={mode === 'auto' ? 'currentColor' : 'none'} />
              Automática
            </button>
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
                mode === 'custom' ? 'bg-[#7c3aed]/10 border-[#7c3aed]/30 text-[#a78bfa]' : 'border-[#2a2a2a] text-muted-foreground hover:text-foreground'
              }`}
            >
              Personalizada
            </button>
          </div>

          {mode === 'auto' ? (
            <>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">O que acompanhar</label>
                <div className="flex gap-2">
                  {([['mrr', 'MRR (receita)'], ['clientes', 'Clientes ativos']] as const).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setAutoType(v)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-medium border transition-colors ${autoType === v ? 'bg-[#7c3aed]/10 border-[#7c3aed]/30 text-[#a78bfa]' : 'border-[#2a2a2a] text-muted-foreground hover:text-foreground'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Período</label>
                <select value={period} onChange={e => setPeriod(e.target.value)}
                  className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors capitalize">
                  {months.map(m => <option key={m.val} value={m.val} className="capitalize">{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">
                  {autoType === 'mrr' ? 'Meta de receita (R$)' : 'Meta de clientes ativos'}
                </label>
                <input type="number" value={form.target_value} onChange={e => setF('target_value', e.target.value)}
                  placeholder={autoType === 'mrr' ? '10000' : '20'}
                  className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#7c3aed] transition-colors" />
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Zap size={10} className="text-[#7c3aed]" fill="currentColor" />
                O progresso é atualizado automaticamente com os dados reais da agência.
              </p>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Título *</label>
                <input type="text" value={form.title} onChange={e => setF('title', e.target.value)}
                  placeholder="Ex: Bater 10k seguidores" autoFocus
                  className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#7c3aed] transition-colors" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Cliente (opcional)</label>
                <select value={form.client_id} onChange={e => setF('client_id', e.target.value)}
                  className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors">
                  <option value="">Nenhum (meta interna)</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Valor alvo *</label>
                  <input type="number" value={form.target_value} onChange={e => setF('target_value', e.target.value)}
                    placeholder="10000"
                    className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#7c3aed] transition-colors" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Unidade</label>
                  <input type="text" value={form.unit} onChange={e => setF('unit', e.target.value)}
                    placeholder="seguidores"
                    className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#7c3aed] transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Valor atual</label>
                  <input type="number" value={form.current_value} onChange={e => setF('current_value', e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#7c3aed] transition-colors" />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1.5">Prazo</label>
                  <input type="date" value={form.deadline} onChange={e => setF('deadline', e.target.value)}
                    className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors" />
                </div>
              </div>
            </>
          )}

          {error && <p className="text-xs text-[#ef4444]">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-[#2a2a2a] text-sm font-medium py-2.5 rounded-lg hover:bg-[#222222] transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Criando...' : 'Criar meta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
