'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, X, Trash2, TrendingUp, TrendingDown, Wallet, List, ChevronLeft, ChevronRight, Check, Pencil } from 'lucide-react'
import { formatBRL, formatDate } from '@/lib/utils/format'

interface FdmcEntry {
  id: string
  type: 'receita' | 'despesa'
  description: string
  amount: number
  entry_date: string
  paid_at: string | null
  notes: string | null
  created_at: string
}

interface CashMovement {
  id: string
  movement_date: string
  amount: number
  note: string | null
  created_at: string
}

const EMPTY_FORM = {
  type: 'receita' as 'receita' | 'despesa',
  description: '',
  amount: '',
  entry_date: new Date().toISOString().split('T')[0],
  notes: '',
}

const EMPTY_MOVEMENT_FORM = {
  direction: 'entrada' as 'entrada' | 'saida',
  amount: '',
  movement_date: new Date().toISOString().split('T')[0],
  note: '',
}

export default function FdmcFinanceiroPage() {
  const [activeTab, setActiveTab] = useState<'lancamentos' | 'caixa'>('lancamentos')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Financeiro — FDMC</h1>
          <p className="text-sm text-muted-foreground mt-1">Só visível pra você</p>
        </div>
        <div className="flex items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('lancamentos')}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'lancamentos' ? 'bg-[#efefef] text-[#111111]' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <List size={13} /> Lançamentos
          </button>
          <button
            onClick={() => setActiveTab('caixa')}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'caixa' ? 'bg-[#efefef] text-[#111111]' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Wallet size={13} /> Caixa
          </button>
        </div>
      </div>

      {activeTab === 'lancamentos' ? <LancamentosTab /> : <CaixaTab />}
    </div>
  )
}

// ── Lançamentos (receita/despesa solta) ──────────────────────────────────────
function LancamentosTab() {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [entries, setEntries] = useState<FdmcEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editingEntry, setEditingEntry] = useState<FdmcEntry | null>(null)
  const [paying, setPaying] = useState<string | null>(null)

  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const monthName = new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const defaultNewDate = monthStr === todayStr.slice(0, 7) ? todayStr : `${monthStr}-01`

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/fdmc/entries?month=${monthStr}`).then(r => r.json()).catch(() => [])
    setEntries(Array.isArray(res) ? res : [])
    setLoading(false)
  }, [monthStr])

  useEffect(() => { load() }, [load])

  async function deleteEntry(id: string) {
    if (!confirm('Apagar esse lançamento?')) return
    setEntries(es => es.filter(e => e.id !== id))
    await fetch(`/api/fdmc/entries/${id}`, { method: 'DELETE' })
  }

  async function markPaid(id: string, isPaid: boolean) {
    setPaying(id)
    await fetch(`/api/fdmc/entries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: isPaid ? 'unpay' : 'pay' }),
    })
    setPaying(null)
    load()
  }

  const receitas = entries.filter(e => e.type === 'receita')
  const despesas = entries.filter(e => e.type === 'despesa')
  const recebido = receitas.filter(e => e.paid_at).reduce((s, e) => s + Number(e.amount), 0)
  const aReceber = receitas.filter(e => !e.paid_at).reduce((s, e) => s + Number(e.amount), 0)
  const pago = despesas.filter(e => e.paid_at).reduce((s, e) => s + Number(e.amount), 0)
  const aPagar = despesas.filter(e => !e.paid_at).reduce((s, e) => s + Number(e.amount), 0)
  const saldo = recebido - pago

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
          <button onClick={prevMonth} className="p-2 hover:bg-[#222222] rounded-l-lg transition-colors"><ChevronLeft size={14} /></button>
          <span className="text-xs px-3 capitalize min-w-[130px] text-center">{monthName}</span>
          <button onClick={nextMonth} className="p-2 hover:bg-[#222222] rounded-r-lg transition-colors"><ChevronRight size={14} /></button>
        </div>
        <button
          onClick={() => setShowNew(true)}
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
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Saldo do mês</span>
              </div>
              <p className="text-2xl font-bold">{formatBRL(saldo)}</p>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} className="text-[#22c55e]" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Faturamento</span>
              </div>
              <p className="text-2xl font-bold text-[#22c55e]">{formatBRL(recebido)}</p>
              {aReceber > 0 && <p className="text-[11px] text-muted-foreground mt-1">{formatBRL(aReceber)} a receber</p>}
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown size={14} className="text-[#ef4444]" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Despesas</span>
              </div>
              <p className="text-2xl font-bold text-[#ef4444]">{formatBRL(pago)}</p>
              {aPagar > 0 && <p className="text-[11px] text-muted-foreground mt-1">{formatBRL(aPagar)} a pagar</p>}
            </div>
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2a2a2a]">
              <h2 className="text-sm font-medium">Lançamentos</h2>
            </div>
            {entries.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Nenhum lançamento nesse mês</div>
            ) : (
              <div className="divide-y divide-[#2a2a2a]">
                {entries.map(e => {
                  const positive = e.type === 'receita'
                  const isPaid = !!e.paid_at
                  const isOverdue = !isPaid && e.entry_date < todayStr
                  return (
                    <div key={e.id} className="flex items-center justify-between px-5 py-3 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {positive ? <TrendingUp size={15} className="text-[#22c55e] shrink-0" /> : <TrendingDown size={15} className="text-[#ef4444] shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{e.description}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-muted-foreground">{formatDate(e.entry_date)}</p>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isPaid ? 'text-[#22c55e] bg-[#22c55e]/10' : isOverdue ? 'text-[#ef4444] bg-[#ef4444]/10' : 'text-muted-foreground bg-[#2a2a2a]'}`}>
                              {isPaid ? (positive ? 'Recebido' : 'Pago') : isOverdue ? 'Atrasado' : (positive ? 'A receber' : 'A pagar')}
                            </span>
                            {e.notes && <p className="text-xs text-muted-foreground truncate">· {e.notes}</p>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-semibold ${positive ? 'text-[#22c55e]' : 'text-[#ef4444]'} ${isPaid ? '' : 'opacity-60'}`}>
                          {positive ? '+' : '-'}{formatBRL(Number(e.amount))}
                        </span>
                        <button onClick={() => markPaid(e.id, isPaid)} disabled={paying === e.id}
                          className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition-colors ${isPaid ? 'border border-[#2a2a2a] text-muted-foreground hover:text-foreground' : 'bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 border border-[#22c55e]/20'}`}>
                          <Check size={12} />{isPaid ? 'Desfazer' : positive ? 'Marcar recebido' : 'Marcar pago'}
                        </button>
                        <button onClick={() => setEditingEntry(e)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => deleteEntry(e.id)} className="text-muted-foreground hover:text-[#ef4444] transition-colors p-1">
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
        <EntryModal defaultDate={defaultNewDate} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load() }} />
      )}
      {editingEntry && (
        <EntryModal initial={editingEntry} onClose={() => setEditingEntry(null)} onSaved={() => { setEditingEntry(null); load() }} />
      )}
    </div>
  )
}

// ── Modal de lançamento (criação e edição) ────────────────────────────────────
function EntryModal({ initial, defaultDate, onClose, onSaved }: {
  initial?: FdmcEntry
  defaultDate?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(initial ? {
    type: initial.type,
    description: initial.description,
    amount: String(initial.amount),
    entry_date: initial.entry_date,
    notes: initial.notes ?? '',
  } : { ...EMPTY_FORM, entry_date: defaultDate ?? EMPTY_FORM.entry_date })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    if (!form.description.trim()) { setError('Informe uma descrição'); return }
    const amountNum = parseFloat(form.amount.replace(',', '.'))
    if (!amountNum || amountNum <= 0) { setError('Informe um valor maior que zero'); return }
    setSaving(true)
    const res = await fetch(initial ? `/api/fdmc/entries/${initial.id}` : '/api/fdmc/entries', {
      method: initial ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: amountNum }),
    })
    if (res.ok) {
      onSaved()
    } else {
      const err = await res.json().catch(() => ({}))
      setError(err.error ?? 'Erro ao salvar')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{initial ? 'Editar lançamento' : 'Novo lançamento'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
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
          <button onClick={onClose} className="flex-1 border border-[#2a2a2a] text-sm py-2.5 rounded-lg hover:bg-[#222222] transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111] text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Caixa (reserva guardada) ──────────────────────────────────────────────────
function CaixaTab() {
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_MOVEMENT_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/fdmc/cash-movements').then(r => r.json()).catch(() => [])
    setMovements(Array.isArray(res) ? res : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const balance = movements.reduce((sum, m) => sum + Number(m.amount), 0)

  async function addMovement() {
    setError('')
    const amountNum = parseFloat(form.amount.replace(',', '.'))
    if (!amountNum || amountNum <= 0) { setError('Informe um valor maior que zero'); return }
    setSaving(true)
    const signed = form.direction === 'saida' ? -Math.abs(amountNum) : Math.abs(amountNum)
    const res = await fetch('/api/fdmc/cash-movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movement_date: form.movement_date, amount: signed, note: form.note || null }),
    })
    if (res.ok) {
      setShowNew(false)
      setForm({ ...EMPTY_MOVEMENT_FORM })
      load()
    } else {
      const err = await res.json().catch(() => ({}))
      setError(err.error ?? 'Erro ao salvar')
    }
    setSaving(false)
  }

  async function deleteMovement(id: string) {
    if (!confirm('Apagar esse movimento? Isso muda o saldo do caixa.')) return
    setMovements(ms => ms.filter(m => m.id !== id))
    await fetch(`/api/fdmc/cash-movements/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="bg-[#1a1a1a] border border-[#efefef]/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={14} className="text-[#efefef]" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Guardado em caixa</span>
          </div>
          <p className="text-3xl font-bold">{formatBRL(balance)}</p>
        </div>
        <button
          onClick={() => { setShowNew(true); setForm({ ...EMPTY_MOVEMENT_FORM }); setError('') }}
          className="flex items-center gap-2 bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111] text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> Novo movimento
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-[#efefef] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2a2a2a]">
            <h2 className="text-sm font-medium">Movimentações</h2>
          </div>
          {movements.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Nenhum movimento lançado ainda</div>
          ) : (
            <div className="divide-y divide-[#2a2a2a]">
              {movements.map(m => {
                const positive = Number(m.amount) >= 0
                return (
                  <div key={m.id} className="flex items-center justify-between px-5 py-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {positive ? <TrendingUp size={15} className="text-[#22c55e] shrink-0" /> : <TrendingDown size={15} className="text-[#ef4444] shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">{formatDate(m.movement_date)}</p>
                        {m.note && <p className="text-sm truncate">{m.note}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-sm font-semibold ${positive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                        {positive ? '+' : ''}{formatBRL(Number(m.amount))}
                      </span>
                      <button onClick={() => deleteMovement(m.id)} className="text-muted-foreground hover:text-[#ef4444] transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowNew(false) }}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Novo movimento de caixa</h2>
              <button onClick={() => setShowNew(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Direção</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, direction: 'entrada' }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg border transition-colors ${form.direction === 'entrada' ? 'bg-[#22c55e]/15 border-[#22c55e]/40 text-[#22c55e]' : 'border-[#2a2a2a] text-muted-foreground'}`}>
                  <TrendingUp size={13} /> Entrada
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, direction: 'saida' }))}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-lg border transition-colors ${form.direction === 'saida' ? 'bg-[#ef4444]/15 border-[#ef4444]/40 text-[#ef4444]' : 'border-[#2a2a2a] text-muted-foreground'}`}>
                  <TrendingDown size={13} /> Saída
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Valor (R$)</label>
                <input autoFocus type="number" placeholder="0,00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#efefef] placeholder:text-muted-foreground" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Data</label>
                <input type="date" value={form.movement_date} onChange={e => setForm(f => ({ ...f, movement_date: e.target.value }))}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#efefef]" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Nota (opcional)</label>
              <textarea rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Contexto do movimento..."
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] resize-none placeholder:text-muted-foreground" />
            </div>

            {error && <p className="text-xs text-[#ef4444]">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setShowNew(false)} className="flex-1 border border-[#2a2a2a] text-sm py-2.5 rounded-lg hover:bg-[#222222] transition-colors">Cancelar</button>
              <button onClick={addMovement} disabled={saving} className="flex-1 bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111] text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
