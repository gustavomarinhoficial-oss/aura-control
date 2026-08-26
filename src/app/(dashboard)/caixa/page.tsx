'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, X, Trash2, Wallet, TrendingUp, TrendingDown, Target, Pencil, Check } from 'lucide-react'
import { formatBRL, formatDate } from '@/lib/utils/format'

interface CashMovement {
  id: string
  date: string
  type: string
  amount: number
  note: string | null
  created_at: string
}
interface Charge { id: string; amount: number; due_date: string; paid_at: string | null }
interface Expense { id: string; amount: number; due_date: string; paid_at: string | null }

const TYPE_META: Record<string, { label: string; defaultDirection: 'entrada' | 'saida' }> = {
  aporte:              { label: 'Aporte',               defaultDirection: 'entrada' },
  retirada:            { label: 'Retirada',             defaultDirection: 'saida' },
  distribuicao_socio:  { label: 'Distribuição — sócio',  defaultDirection: 'saida' },
  reinvestimento:      { label: 'Distribuição — reinvestimento', defaultDirection: 'entrada' },
  ajuste:              { label: 'Ajuste',               defaultDirection: 'entrada' },
}

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().split('T')[0]
}

const EMPTY_FORM = { type: 'aporte', direction: 'entrada' as 'entrada' | 'saida', amount: '', date: new Date().toISOString().split('T')[0], note: '' }

export default function CaixaPage() {
  const [movements, setMovements] = useState<CashMovement[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [reserveTarget, setReserveTarget] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [editingTarget, setEditingTarget] = useState(false)
  const [targetInput, setTargetInput] = useState('')

  const load = useCallback(async () => {
    const [m, c, e, s] = await Promise.all([
      fetch('/api/cash-movements').then(r => r.json()).catch(() => []),
      fetch('/api/charges').then(r => r.json()).catch(() => []),
      fetch('/api/expenses').then(r => r.json()).catch(() => []),
      fetch('/api/cash-settings').then(r => r.json()).catch(() => ({ reserve_target: 0 })),
    ])
    setMovements(Array.isArray(m) ? m : [])
    setCharges(Array.isArray(c) ? c : [])
    setExpenses(Array.isArray(e) ? e : [])
    setReserveTarget(Number(s?.reserve_target ?? 0))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const balance = movements.reduce((sum, m) => sum + Number(m.amount), 0)

  async function addMovement() {
    setFormError('')
    const amountNum = parseFloat(form.amount.replace(',', '.'))
    if (!amountNum || amountNum <= 0) { setFormError('Informe um valor maior que zero'); return }
    setSaving(true)
    const signed = form.direction === 'saida' ? -Math.abs(amountNum) : Math.abs(amountNum)
    const res = await fetch('/api/cash-movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: form.type, amount: signed, date: form.date, note: form.note || null }),
    })
    if (res.ok) {
      const created = await res.json()
      setMovements(ms => [created, ...ms])
      setForm({ ...EMPTY_FORM })
      setShowNew(false)
    } else {
      const err = await res.json().catch(() => ({}))
      setFormError(err.error ?? 'Erro ao salvar')
    }
    setSaving(false)
  }

  async function deleteMovement(id: string) {
    if (!confirm('Apagar esse movimento? Isso muda o saldo do caixa.')) return
    await fetch(`/api/cash-movements/${id}`, { method: 'DELETE' })
    setMovements(ms => ms.filter(m => m.id !== id))
  }

  async function saveTarget() {
    const val = parseFloat(targetInput.replace(',', '.'))
    if (isNaN(val) || val < 0) return
    const res = await fetch('/api/cash-settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reserve_target: val }),
    })
    if (res.ok) { setReserveTarget(val); setEditingTarget(false) }
  }

  // Projeção: saldo atual + cobranças a receber - despesas a pagar dentro da janela.
  // Cobranças/despesas geradas no sistema cobrem só ~3 meses à frente; pro fim do
  // ano, extrapola a média mensal desse período pros meses restantes.
  const today = new Date().toISOString().split('T')[0]
  function netFlowUntil(limitDate: string) {
    const inCharges = charges.filter(c => !c.paid_at && c.due_date > today && c.due_date <= limitDate).reduce((s, c) => s + Number(c.amount), 0)
    const outExpenses = expenses.filter(e => !e.paid_at && e.due_date > today && e.due_date <= limitDate).reduce((s, e) => s + Number(e.amount), 0)
    return inCharges - outExpenses
  }

  const in3Months = addMonths(today, 3)
  const proj3Months = balance + netFlowUntil(in3Months)

  const yearEnd = `${new Date().getFullYear()}-12-31`
  const monthsToYearEnd = Math.max(0, (new Date(yearEnd).getFullYear() - new Date(today).getFullYear()) * 12 + (11 - new Date(today).getMonth()))
  const netNext3 = netFlowUntil(in3Months)
  const avgMonthlyNet = netNext3 / 3
  const projYearEnd = monthsToYearEnd <= 3
    ? balance + netFlowUntil(yearEnd)
    : balance + netNext3 + avgMonthlyNet * (monthsToYearEnd - 3)

  const reservePct = reserveTarget > 0 ? Math.min((balance / reserveTarget) * 100, 100) : 0
  const reserveMet = reserveTarget > 0 && balance >= reserveTarget

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Caixa</h1>
          <p className="text-sm text-muted-foreground mt-1">Reserva financeira da empresa — lançado manualmente</p>
        </div>
        <button
          onClick={() => { setShowNew(true); setForm({ ...EMPTY_FORM }); setFormError('') }}
          className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} /> Novo movimento
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Saldo + meta */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1a1a1a] border border-[#7c3aed]/30 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Wallet size={14} className="text-[#a78bfa]" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Saldo atual do caixa</span>
              </div>
              <p className="text-3xl font-bold">{formatBRL(balance)}</p>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Target size={14} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Meta de reserva mínima</span>
                </div>
                {!editingTarget && (
                  <button onClick={() => { setEditingTarget(true); setTargetInput(String(reserveTarget)) }} className="text-muted-foreground hover:text-[#a78bfa] transition-colors">
                    <Pencil size={12} />
                  </button>
                )}
              </div>
              {editingTarget ? (
                <div className="flex gap-2">
                  <input autoFocus type="number" value={targetInput} onChange={e => setTargetInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveTarget()}
                    className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed]" />
                  <button onClick={saveTarget} className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg px-3 flex items-center justify-center"><Check size={14} /></button>
                </div>
              ) : (
                <>
                  <p className="text-3xl font-bold">{formatBRL(reserveTarget)}</p>
                  {reserveTarget > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${reservePct}%`, backgroundColor: reserveMet ? '#22c55e' : '#7c3aed' }} />
                      </div>
                      <p className={`text-[11px] ${reserveMet ? 'text-[#22c55e]' : 'text-muted-foreground'}`}>
                        {reserveMet ? '✓ meta atingida' : `${Math.round(reservePct)}% da meta`}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Projeção */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} className="text-[#60a5fa]" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Projeção — próximos 3 meses</span>
              </div>
              <p className="text-2xl font-semibold text-[#60a5fa]">{formatBRL(proj3Months)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Saldo atual + cobranças a receber − despesas a pagar já cadastradas</p>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={14} className="text-[#34d399]" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Projeção — até o fim do ano</span>
              </div>
              <p className="text-2xl font-semibold text-[#34d399]">{formatBRL(projYearEnd)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Estimativa — meses além dos já cadastrados usam a média mensal recente</p>
            </div>
          </div>

          {/* Histórico */}
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
                          <p className="text-sm font-medium truncate">{TYPE_META[m.type]?.label ?? m.type}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-muted-foreground">{formatDate(m.date)}</p>
                            {m.note && <p className="text-xs text-muted-foreground truncate">· {m.note}</p>}
                          </div>
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
        </>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setShowNew(false) }}>
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Novo movimento de caixa</h2>
              <button onClick={() => setShowNew(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Tipo</label>
              <select
                value={form.type}
                onChange={e => { const type = e.target.value; setForm(f => ({ ...f, type, direction: TYPE_META[type].defaultDirection })) }}
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed]"
              >
                {Object.entries(TYPE_META).map(([key, meta]) => <option key={key} value={key}>{meta.label}</option>)}
              </select>
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
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Data</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed]" />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1.5">Nota (opcional)</label>
              <textarea rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Contexto do movimento..."
                className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] resize-none placeholder:text-muted-foreground" />
            </div>

            {formError && <p className="text-xs text-[#ef4444]">{formError}</p>}

            <div className="flex gap-3">
              <button onClick={() => setShowNew(false)} className="flex-1 border border-[#2a2a2a] text-sm py-2.5 rounded-lg hover:bg-[#222222] transition-colors">Cancelar</button>
              <button onClick={addMovement} disabled={saving} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
