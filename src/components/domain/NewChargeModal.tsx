'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Client, Charge } from '@/lib/supabase/types'

interface Props {
  onClose: () => void
  onCreated: () => void
  defaultMonth?: string
  initial?: Charge
}

export function NewChargeModal({ onClose, onCreated, defaultMonth, initial }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [form, setForm] = useState(initial ? {
    client_id: initial.client_id,
    description: initial.description,
    amount: String(initial.amount),
    due_date: initial.due_date,
  } : {
    client_id: '',
    description: '',
    amount: '',
    due_date: defaultMonth ? `${defaultMonth}-01` : new Date().toISOString().split('T')[0],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initial) return
    fetch('/api/clients').then(r => r.json()).then(d => setClients(d.filter((c: Client) => c.status === 'ativo')))
  }, [initial])

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_id || !form.description || !form.amount) { setError('Preencha todos os campos'); return }
    setSaving(true)
    const res = await fetch(initial ? `/api/charges/${initial.id}` : '/api/charges', {
      method: initial ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(initial
        ? { description: form.description, amount: parseFloat(form.amount), due_date: form.due_date }
        : { ...form, amount: parseFloat(form.amount) }),
    })
    if (!res.ok) { setError(`Erro ao ${initial ? 'salvar' : 'criar'} cobrança`); setSaving(false); return }
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-semibold">{initial ? 'Editar cobrança' : 'Nova cobrança'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {initial ? (
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Cliente</label>
              <p className="text-sm text-foreground bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5">{initial.clients?.name ?? '—'}</p>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Cliente *</label>
              <select
                value={form.client_id}
                onChange={e => set('client_id', e.target.value)}
                className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                <option value="">Selecionar cliente...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <Field label="Descrição *" value={form.description} onChange={v => set('description', v)} placeholder="Ex: Gestão de tráfego — Agosto" />
          <Field label="Valor (R$) *" value={form.amount} onChange={v => set('amount', v)} type="number" placeholder="0,00" />
          <Field label="Vencimento *" value={form.due_date} onChange={v => set('due_date', v)} type="date" />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-[#2a2a2a] text-sm font-medium py-2.5 rounded-lg hover:bg-[#222222] transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Salvando...' : initial ? 'Salvar' : 'Criar cobrança'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
      />
    </div>
  )
}
