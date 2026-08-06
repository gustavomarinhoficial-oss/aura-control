'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatBRL, getPeriodLabel, currentPeriod } from '@/lib/utils/format'
import { Plus, Target, Edit2, Trash2, Check, X } from 'lucide-react'
import { NewGoalModal } from '@/components/domain/NewGoalModal'
import type { Goal } from '@/lib/supabase/types'

interface GoalWithProgress extends Goal {
  current: number
  pct: number
}

export default function MetasPage() {
  const [goals, setGoals] = useState<GoalWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [goalsRes, dashRes] = await Promise.all([
      fetch('/api/goals').then(r => r.json()),
      fetch('/api/dashboard').then(r => r.json()),
    ])

    const cp = currentPeriod()
    const withProgress: GoalWithProgress[] = (goalsRes as Goal[]).map(g => {
      let current = 0
      if (g.period === cp) {
        current = g.type === 'mrr' ? (dashRes.mrr ?? 0) : (dashRes.activeClients ?? 0)
      }
      const pct = g.target_value > 0 ? Math.min(100, Math.round((current / Number(g.target_value)) * 100)) : 0
      return { ...g, current, pct }
    })

    setGoals(withProgress)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(g: GoalWithProgress) {
    setEditingId(g.id)
    setEditValue(String(g.target_value))
  }

  async function saveEdit(id: string) {
    const val = parseFloat(editValue)
    if (isNaN(val) || val <= 0) return
    setSaving(true)
    await fetch(`/api/goals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_value: val }),
    })
    setSaving(false)
    setEditingId(null)
    load()
  }

  async function deleteGoal(id: string) {
    if (!confirm('Apagar esta meta?')) return
    setDeletingId(id)
    await fetch(`/api/goals/${id}`, { method: 'DELETE' })
    setDeletingId(null)
    load()
  }

  const typeLabel: Record<string, string> = { mrr: 'MRR', clientes: 'Clientes ativos' }

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
            <p className="text-xs text-muted-foreground mt-1">Defina metas mensais de MRR ou número de clientes</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="text-xs text-[#7c3aed] hover:text-[#a78bfa] transition-colors"
          >
            Criar primeira meta
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map(g => {
            const isCurrent = g.period === currentPeriod()
            const isEditing = editingId === g.id
            const isDeleting = deletingId === g.id

            return (
              <div key={g.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{typeLabel[g.type]}</p>
                    <p className="text-sm font-medium mt-0.5 capitalize">{getPeriodLabel(g.period)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCurrent && (
                      <span className="text-[10px] font-medium px-2 py-0.5 bg-[#7c3aed]/10 text-[#a78bfa] rounded-full">
                        Mês atual
                      </span>
                    )}
                    {!isEditing && (
                      <>
                        <button
                          onClick={() => startEdit(g)}
                          className="text-muted-foreground hover:text-[#a78bfa] transition-colors"
                          title="Editar meta"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => deleteGoal(g.id)}
                          disabled={isDeleting}
                          className="text-muted-foreground hover:text-[#ef4444] transition-colors disabled:opacity-50"
                          title="Apagar meta"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="mb-3 space-y-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">
                        {g.type === 'mrr' ? 'Novo valor (R$)' : 'Novo número de clientes'}
                      </label>
                      <input
                        type="number"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(g.id); if (e.key === 'Escape') setEditingId(null) }}
                        autoFocus
                        className="w-full bg-[#111111] border border-[#7c3aed]/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 flex items-center justify-center gap-1.5 border border-[#2a2a2a] text-xs py-2 rounded-lg hover:bg-[#222222] transition-colors"
                      >
                        <X size={12} /> Cancelar
                      </button>
                      <button
                        onClick={() => saveEdit(g.id)}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs py-2 rounded-lg transition-colors disabled:opacity-60"
                      >
                        <Check size={12} /> Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-3">
                    <div className="flex items-end justify-between mb-2">
                      <span className="text-3xl font-bold tracking-tight text-foreground">{g.pct}%</span>
                      <span className="text-xs text-muted-foreground">
                        {g.type === 'mrr'
                          ? `${formatBRL(g.current)} / ${formatBRL(Number(g.target_value))}`
                          : `${g.current} / ${g.target_value} clientes`
                        }
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${g.pct}%`,
                          background: g.pct >= 100 ? '#22c55e' : '#7c3aed',
                        }}
                      />
                    </div>
                  </div>
                )}

                {!isEditing && (
                  <p className="text-xs text-muted-foreground">
                    {g.pct >= 100
                      ? 'Meta atingida!'
                      : isCurrent
                      ? `Faltam ${g.type === 'mrr' ? formatBRL(Number(g.target_value) - g.current) : `${Number(g.target_value) - g.current} clientes`}`
                      : 'Período encerrado'
                    }
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showNew && (
        <NewGoalModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load() }}
        />
      )}
    </div>
  )
}
