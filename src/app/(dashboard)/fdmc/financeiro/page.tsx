'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, X, Trash2, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { formatBRL, formatDate } from '@/lib/utils/format'

interface FdmcEntry {
  id: string
  type: 'receita' | 'despesa'
  description: string
  amount: number
  entry_date: string
  notes: string | null
  created_at: string
}

const EMPTY_FORM = {
  type: 'receita' as 'receita' | 'despesa',
  description: '',
  amount: '',
  entry_date: new Date().toISOString().split('T')[0],
  notes: '',
}

export default function FdmcFinanceiroPage() {
  const [entries, setEntries] = useState<FdmcEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/fdmc/entries').then(r => r.json()).catch(() => [])
    setEntries(Array.isArray(res) ? res : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addEntry() {
    setError('')
    if (!form.description.trim()) { setError('Informe uma descrição'); return }
    const amountNum = parseFloat(form.amount.replace(',', '.'))
    if (!amountNum || amountNum <= 0) { setError('Informe um valor maior que zero'); return }
    setSaving(true)
    const res = await fetch('/api/fdmc/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: amountNum }),
    })
    if (res.ok) {
      setShowNew(false)
      setForm({ ...EMPTY_FORM })
      load()
    } else {
      const err = await res.json().catch(() => ({}))
      setError(err.error ?? 'Erro ao salvar')
    }
    setSaving(false)
  }

  async function deleteEntry(id: string) {
    if (!confirm('Apagar esse lançamento?')) return
    setEntries(es => es.filter(e => e.id !== id))
    await fetch(`/api/fdmc/entries/${id}`, { method: 'DELETE' })
  }

  const totalReceitas = entries.filter(e => e.type === 'receita').reduce((s, e) => s + Number(e.amount), 0)
  const totalDespesas = entries.filter(e => e.type === 'despesa').reduce((s, e) => s + Number(e.amount), 0)
  const saldo = totalReceitas - totalDespesas

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Financeiro — FDMC</h1>
          <p className="text-sm text-muted-foreground mt-1">Lançamentos de entrada e saída, só visível pra você</p>
        </div>
        <button
          onClick={() => { setShowNew(true); setForm({ ...EMPTY_FORM }); setError('') }}
          className="flex items-center gap-2 bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111] text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> Novo lançamento
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-[#efefef] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#1a1a1a] border border-[#efefef]/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={14} className="text-[#efefef]" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Saldo</span>
              </div>
              <p className="text-2xl font-bold">{formatBRL(saldo)}</p>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} className="text-[#22c55e]" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Total receitas</span>
              </div>
              <p className="text-2xl font-bold text-[#22c55e]">{formatBRL(totalReceitas)}</p>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown size={14} className="text-[#ef4444]" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Total despesas</span>
              </div>
              <p className="text-2xl font-bold text-[#ef4444]">{formatBRL(totalDespesas)}</p>
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2a2a2a]">
              <h2 className="text-sm font-medium">Lançamentos</h2>
            </div>
            {entries.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Nenhum lançamento ainda</div>
            ) : (
              <div className="divide-y divide-[#2a2a2a]">
                {entries.map(e => {
                  const positive = e.type === 'receita'
                  return (
                    <div key={e.id} className="flex items-center justify-between px-5 py-3 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {positive ? <TrendingUp size={15} className="text-[#22c55e] shrink-0" /> : <TrendingDown size={15} className="text-[#ef4444] shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{e.description}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">{formatDate(e.entry_date)}</p>
                            {e.notes && <p className="text-xs text-muted-foreground truncate">· {e.notes}</p>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-sm font-semibold ${positive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                          {positive ? '+' : '-'}{formatBRL(Number(e.amount))}
                        </span>
                        <button onClick={() => deleteEntry(e.id)} className="text-muted-foreground hover:text-[#ef4444] transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowNew(false) }}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Novo lançamento</h2>
              <button onClick={() => setShowNew(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Tipo</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, type: 'receita' }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg border transition-colors ${form.type === 'receita' ? 'bg-[#22c55e]/15 border-[#22c55e]/40 text-[#22c55e]' : 'border-[#2a2a2a] text-muted-foreground'}`}>
                  <TrendingUp size={13} /> Receita
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, type: 'despesa' }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg border transition-colors ${form.type === 'despesa' ? 'bg-[#ef4444]/15 border-[#ef4444]/40 text-[#ef4444]' : 'border-[#2a2a2a] text-muted-foreground'}`}>
                  <TrendingDown size={13} /> Despesa
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Descrição</label>
              <input autoFocus value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Ex: Pagamento de cliente, aluguel..."
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#efefef] placeholder:text-muted-foreground" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Valor (R$)</label>
                <input type="number" placeholder="0,00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#efefef] placeholder:text-muted-foreground" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Data</label>
                <input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#efefef]" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Nota (opcional)</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Contexto do lançamento..."
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] resize-none placeholder:text-muted-foreground" />
            </div>

            {error && <p className="text-xs text-[#ef4444]">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setShowNew(false)} className="flex-1 border border-[#2a2a2a] text-sm py-2.5 rounded-lg hover:bg-[#222222] transition-colors">Cancelar</button>
              <button onClick={addEntry} disabled={saving} className="flex-1 bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111] text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
