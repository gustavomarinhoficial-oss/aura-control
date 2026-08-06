'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface Props {
  onClose: () => void
  onCreated: () => void
}

export function NewClientModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', started_at: new Date().toISOString().split('T')[0], notes: '', billing_day: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (!res.ok) { setError('Erro ao criar cliente'); setSaving(false); return }
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-sm font-semibold">Novo cliente</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Field label="Nome *" value={form.name} onChange={v => set('name', v)} placeholder="Nome do cliente" />
          <Field label="Email" value={form.email} onChange={v => set('email', v)} placeholder="email@cliente.com" type="email" />
          <Field label="Telefone" value={form.phone} onChange={v => set('phone', v)} placeholder="(11) 99999-9999" />
          <Field label="Cliente desde" value={form.started_at} onChange={v => set('started_at', v)} type="date" />
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Dia de vencimento</label>
            <select
              value={form.billing_day}
              onChange={e => set('billing_day', e.target.value)}
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
            >
              <option value="">Não definido</option>
              {[1,5,10,15,20,25,28].map(d => <option key={d} value={d}>Todo dia {d}</option>)}
            </select>
            <p className="text-[10px] text-muted-foreground mt-1">Dia do mês em que as cobranças vencem para este cliente.</p>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Observações</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#7c3aed] transition-colors resize-none"
              placeholder="Observações opcionais..."
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-[#2a2a2a] text-sm font-medium py-2.5 rounded-lg hover:bg-[#222222] transition-colors">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Salvando...' : 'Criar cliente'}
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
