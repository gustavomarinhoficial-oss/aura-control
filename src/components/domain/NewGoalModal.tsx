'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { currentPeriod } from '@/lib/utils/format'

interface Props { onClose: () => void; onCreated: () => void }

export function NewGoalModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({ period: currentPeriod(), type: 'mrr', target_value: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.target_value) { setError('Informe o valor da meta'); return }
    setSaving(true)
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, target_value: parseFloat(form.target_value) }),
    })
    if (!res.ok) { setError('Erro ao criar meta'); setSaving(false); return }
    onCreated()
  }

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - 3 + i)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return { val, label }
  })

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-semibold">Nova meta</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Período</label>
            <select
              value={form.period}
              onChange={e => set('period', e.target.value)}
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors capitalize"
            >
              {months.map(m => <option key={m.val} value={m.val} className="capitalize">{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Tipo de meta</label>
            <div className="flex gap-2">
              {[{ v: 'mrr', l: 'MRR (receita)' }, { v: 'clientes', l: 'Nº de clientes' }].map(({ v, l }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => set('type', v)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.type === v
                      ? 'bg-[#7c3aed]/10 border-[#7c3aed]/30 text-[#a78bfa]'
                      : 'border-[#2a2a2a] text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">
              {form.type === 'mrr' ? 'Meta de receita (R$)' : 'Meta de clientes ativos'}
            </label>
            <input
              type="number"
              value={form.target_value}
              onChange={e => set('target_value', e.target.value)}
              placeholder={form.type === 'mrr' ? '10000' : '20'}
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-[#2a2a2a] text-sm font-medium py-2.5 rounded-lg hover:bg-[#222222] transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Salvando...' : 'Criar meta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
