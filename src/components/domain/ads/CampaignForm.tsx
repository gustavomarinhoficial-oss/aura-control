'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { OBJECTIVES, CAMPAIGN_STATUS, BUDGET_TYPES, campaignName, type AdCampaign } from '@/lib/ads/constants'

export const inputCls = 'w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors placeholder:text-muted-foreground/50'

// Criar ou editar uma campanha de tráfego
export function CampaignForm({ clients, initial, defaultClientId, onClose, onSaved }: {
  clients: { id: string; name: string }[]
  initial?: AdCampaign
  defaultClientId?: string
  onClose: () => void
  onSaved: (c: AdCampaign) => void
}) {
  const [form, setForm] = useState({
    client_id: initial?.client_id ?? defaultClientId ?? '',
    name: initial?.name ?? '',
    objective: initial?.objective ?? 'mensagens',
    budget_type: initial?.budget_type ?? 'total',
    budget_amount: initial?.budget_amount != null ? String(initial.budget_amount) : '',
    start_date: initial?.start_date ?? '',
    end_date: initial?.end_date ?? '',
    schedule: initial?.schedule ?? '',
    audience: initial?.audience ?? '',
    status: initial?.status ?? 'rascunho',
    notes: initial?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))
  const preview = form.name.trim() ? campaignName(form.name, form.start_date || null) : ''

  async function save() {
    setError('')
    if (!form.client_id) return setError('Escolha o cliente')
    if (!form.name.trim()) return setError('Informe o nome da campanha')
    setSaving(true)
    const { client_id, ...rest } = form
    const res = await fetch(initial ? `/api/ads/campaigns/${initial.id}` : '/api/ads/campaigns', {
      method: initial ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(initial ? {} : { client_id }), ...rest, budget_amount: rest.budget_amount === '' ? null : Number(rest.budget_amount) }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    setSaving(false)
    if (!res?.ok) return setError(data.error ?? 'Erro ao salvar')
    onSaved(data)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{initial ? 'Editar campanha' : 'Nova campanha de tráfego'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
        </div>

        {!initial && (
          <Field label="Cliente">
            <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={inputCls}>
              <option value="">Escolha o cliente…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Nome da campanha">
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex.: Almoço executivo" className={inputCls} />
          {preview && preview !== form.name.trim() && <p className="text-[11px] text-muted-foreground mt-1">Vai ficar: <span className="text-foreground">{preview}</span></p>}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Objetivo">
            <select value={form.objective} onChange={e => set('objective', e.target.value as typeof form.objective)} className={inputCls}>
              {Object.entries(OBJECTIVES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={e => set('status', e.target.value as typeof form.status)} className={inputCls}>
              {Object.entries(CAMPAIGN_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Verba">
            <select value={form.budget_type} onChange={e => set('budget_type', e.target.value as typeof form.budget_type)} className={inputCls}>
              {Object.entries(BUDGET_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label={form.budget_type === 'diaria' ? 'Valor por dia' : 'Valor total'}>
            <MoneyInput value={form.budget_amount} onValueChange={v => set('budget_amount', v)} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Início"><input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={inputCls} /></Field>
          <Field label="Fim"><input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className={inputCls} /></Field>
        </div>
        <Field label="Dias e horários de veiculação">
          <input value={form.schedule} onChange={e => set('schedule', e.target.value)} placeholder="Ex.: terça a domingo, 11h às 15h" className={inputCls} />
        </Field>
        <Field label="Público">
          <textarea value={form.audience} onChange={e => set('audience', e.target.value)} rows={2} placeholder="Ex.: raio de 5 km do restaurante, 25 a 55 anos, interesse em gastronomia" className={inputCls} />
        </Field>
        <Field label="Observação interna (o cliente não vê)">
          <input value={form.notes} onChange={e => set('notes', e.target.value)} className={inputCls} />
        </Field>
        {form.status === 'rascunho' && <p className="text-[11px] text-muted-foreground">Em rascunho o cliente ainda não vê a campanha. Mude para &quot;Aguardando aprovação&quot; quando os criativos estiverem prontos.</p>}

        {error && <p className="text-xs text-[#ef4444]">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="text-sm px-4 py-2 text-muted-foreground hover:text-foreground">Cancelar</button>
          <button onClick={save} disabled={saving} className="text-sm font-medium px-4 py-2 rounded-lg bg-[#efefef] text-[#111] disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 size={13} className="animate-spin" />}Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  )
}
