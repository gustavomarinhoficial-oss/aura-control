'use client'

import { useCallback, useEffect, useState } from 'react'
import { Landmark, Pencil, Check, X, Loader2 } from 'lucide-react'
import { formatBRL } from '@/lib/utils/format'

interface Cash { amount: number; note: string | null; updated_at: string | null }

// Caixa disponível: o que está solto na conta corrente (sem aplicar e sem uso). Valor informado na mão.
export function AvailableCashCard({ workspace }: { workspace: 'owl' | 'fdmc' }) {
  const [cash, setCash] = useState<Cash | null>(null)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/available-cash?workspace=${workspace}`)
    const d = await res.json().catch(() => ({}))
    if (res.ok) setCash({ amount: Number(d.amount ?? 0), note: d.note ?? null, updated_at: d.updated_at ?? null })
    else setError(d.error ?? 'Erro ao carregar')
  }, [workspace])

  useEffect(() => { load() }, [load])

  function startEdit() {
    setValue(cash ? String(cash.amount) : '')
    setNote(cash?.note ?? '')
    setError('')
    setEditing(true)
  }

  async function save() {
    const amount = parseFloat(value.replace(',', '.'))
    if (!Number.isFinite(amount)) { setError('Informe um valor'); return }
    setSaving(true)
    const res = await fetch('/api/available-cash', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace, amount, note }),
    })
    const d = await res.json().catch(() => ({}))
    if (res.ok) { setCash({ amount: Number(d.amount), note: d.note ?? null, updated_at: d.updated_at ?? null }); setEditing(false) }
    else setError(d.error ?? 'Erro ao salvar')
    setSaving(false)
  }

  const updated = cash?.updated_at
    ? new Date(cash.updated_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="bg-[#1a1a1a] border border-[#efefef]/30 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Landmark size={13} className="text-[#efefef]" />
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Caixa disponível</p>
        </div>
        {!editing && (
          <button onClick={startEdit} className="text-muted-foreground/60 hover:text-foreground p-1 rounded-md hover:bg-[#2a2a2a] transition-colors" aria-label="Atualizar caixa disponível" title="Atualizar valor">
            <Pencil size={12} />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <input autoFocus type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)} placeholder="0,00"
            className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef]" />
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Nota (opcional): ex. Itaú conta corrente"
            className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#efefef]" />
          {error && <p className="text-[11px] text-[#ef4444]">{error}</p>}
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-1 bg-[#efefef] text-[#111] text-xs font-medium py-1.5 rounded-lg disabled:opacity-60">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Salvar
            </button>
            <button onClick={() => setEditing(false)} className="px-3 border border-[#2a2a2a] rounded-lg text-xs text-muted-foreground hover:text-foreground"><X size={12} /></button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xl font-semibold">{cash ? formatBRL(cash.amount) : '—'}</p>
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
            solto na conta, sem aplicar{cash?.note ? ` · ${cash.note}` : ''}
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{updated ? `atualizado ${updated}` : error || 'toque no lápis para informar o valor'}</p>
        </>
      )}
    </div>
  )
}
