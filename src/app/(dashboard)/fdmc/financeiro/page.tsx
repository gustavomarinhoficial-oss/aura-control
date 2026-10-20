'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, X, Trash2, TrendingUp, TrendingDown, Wallet, ChevronLeft, ChevronRight, Check, Pencil, Copy, Tag, Clock,
  ArrowUpCircle, ArrowDownCircle, AlertCircle, PiggyBank,
} from 'lucide-react'
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, AreaChart, Area, CartesianGrid,
} from 'recharts'
import { formatBRL, formatDate } from '@/lib/utils/format'
import { CashFlowPanel } from '@/components/domain/financeiro/CashFlowPanel'
import { AvailableCashCard } from '@/components/domain/financeiro/AvailableCashCard'

// ── tipos ──────────────────────────────────────────────────────────────────
interface FdmcEntry {
  id: string
  type: 'receita' | 'despesa'
  description: string
  amount: number
  entry_date: string
  paid_at: string | null
  notes: string | null
  category: string | null
  recurrent: boolean | null
  recurrence_group: string | null
  recurrence_end_date: string | null
  created_at: string
}

interface CashMovement {
  id: string
  movement_date: string
  amount: number
  note: string | null
  created_at: string
}

interface HistoricoPoint { label: string; key: string; revenue: number; expenses: number; prolabore: number; profit: number }

// ── constantes (mesmas categorias do financeiro da OWL) ─────────────────────
const EXPENSE_CATEGORIES: Record<string, { label: string; color: string }> = {
  prolabore:    { label: 'Pró-labore',     color: '#efefef' },
  aplicacao:    { label: 'Aplicação / aporte', color: '#e879f9' },
  salario:      { label: 'Salário',        color: '#818cf8' },
  freelancer:   { label: 'Freelancer',     color: '#2dd4bf' },
  impostos:     { label: 'Impostos',       color: '#f59e0b' },
  aluguel:      { label: 'Aluguel',        color: '#60a5fa' },
  software:     { label: 'Software/Tools', color: '#34d399' },
  marketing:    { label: 'Marketing',      color: '#f472b6' },
  pessoal:      { label: 'Pessoal',        color: '#fb923c' },
  comida:       { label: 'Comida',         color: '#facc15' },
  assinaturas:  { label: 'Assinaturas',    color: '#a78bfa' },
  equipamentos: { label: 'Equipamentos',   color: '#38bdf8' },
  outro:        { label: 'Outro',          color: '#6b7280' },
}

const REVENUE_CATEGORIES: Record<string, { label: string; color: string }> = {
  vendas:    { label: 'Vendas',    color: '#22c55e' },
  servicos:  { label: 'Serviços',  color: '#60a5fa' },
  comissao:  { label: 'Comissão',  color: '#a78bfa' },
  outro:     { label: 'Outro',     color: '#6b7280' },
}

const EMPTY_MOVEMENT_FORM = {
  direction: 'entrada' as 'entrada' | 'saida',
  amount: '',
  movement_date: new Date().toISOString().split('T')[0],
  note: '',
}

const todayStr = () => new Date().toISOString().split('T')[0]
const inputCls = 'w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors'

type EntryStatus = 'pago' | 'pendente' | 'atrasado'
function statusOf(e: FdmcEntry): EntryStatus {
  if (e.paid_at) return 'pago'
  return e.entry_date < todayStr() ? 'atrasado' : 'pendente'
}
const statusStyle: Record<EntryStatus, string> = {
  pago: 'text-[#22c55e] bg-[#22c55e]/10',
  pendente: 'text-muted-foreground bg-[#2a2a2a]',
  atrasado: 'text-[#ef4444] bg-[#ef4444]/10',
}

export default function FdmcFinanceiroPage() {
  const [tab, setTab] = useState<'visao' | 'receitas' | 'despesas' | 'vencimentos' | 'caixa'>('visao')

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [entries, setEntries] = useState<FdmcEntry[]>([])
  const [historico, setHistorico] = useState<HistoricoPoint[]>([])
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState<{ type: 'receita' | 'despesa'; initial?: FdmcEntry; prefill?: FdmcEntry } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [flowVersion, setFlowVersion] = useState(0)

  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const monthName = new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  const loadHistorico = useCallback(() => {
    fetch('/api/fdmc/entries/historico').then(r => r.json()).then(d => setHistorico(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setFlowVersion(v => v + 1)
    const res = await fetch(`/api/fdmc/entries?month=${monthStr}`).then(r => r.json()).catch(() => [])
    setEntries(Array.isArray(res) ? res : [])
    setLoading(false)
    loadHistorico()
  }, [monthStr, loadHistorico])

  useEffect(() => { load() }, [load])

  // mantém os meses futuros dos lançamentos recorrentes sempre gerados
  useEffect(() => {
    fetch('/api/fdmc/entries/generate', { method: 'POST' }).then(() => load()).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function togglePaid(e: FdmcEntry) {
    setBusy(e.id)
    await fetch(`/api/fdmc/entries/${e.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: e.paid_at ? 'unpay' : 'pay' }),
    })
    setBusy(null)
    load()
  }

  async function remove(e: FdmcEntry) {
    if (e.recurrence_group) {
      const all = confirm('Este lançamento é recorrente.\n\nOK = apagar este e todos os próximos (encerra a recorrência)\nCancelar = escolher só este mês')
      if (all) {
        setBusy(e.id)
        await fetch(`/api/fdmc/entries/${e.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop_recurrence', from_date: e.entry_date }) })
        setBusy(null)
        load()
        return
      }
    }
    if (!confirm('Apagar só este lançamento?')) return
    setBusy(e.id)
    await fetch(`/api/fdmc/entries/${e.id}`, { method: 'DELETE' })
    setBusy(null)
    load()
  }

  // ── cálculos (mesma lógica do financeiro da OWL) ─────────────────────────
  const receitas = entries.filter(e => e.type === 'receita')
  const despesasAll = entries.filter(e => e.type === 'despesa')
  // Aplicação/aporte não é despesa: é dinheiro guardado, não custo da operação.
  const despesasOp = despesasAll.filter(e => e.category !== 'prolabore' && e.category !== 'aplicacao')
  const prolabores = despesasAll.filter(e => e.category === 'prolabore')
  const aplicacoes = despesasAll.filter(e => e.category === 'aplicacao')

  const receita = receitas.filter(e => e.paid_at).reduce((s, e) => s + Number(e.amount), 0)
  const aReceber = receitas.filter(e => !e.paid_at && statusOf(e) === 'pendente').reduce((s, e) => s + Number(e.amount), 0)
  const inadimplente = receitas.filter(e => statusOf(e) === 'atrasado').reduce((s, e) => s + Number(e.amount), 0)
  const inadimplenteCount = receitas.filter(e => statusOf(e) === 'atrasado').length

  const despesaTotal = despesasOp.reduce((s, e) => s + Number(e.amount), 0)
  const despesaPaga = despesasOp.filter(e => e.paid_at).reduce((s, e) => s + Number(e.amount), 0)
  const despesaPendente = despesaTotal - despesaPaga
  const proTotal = prolabores.reduce((s, e) => s + Number(e.amount), 0)
  const proPago = prolabores.filter(e => e.paid_at).reduce((s, e) => s + Number(e.amount), 0)
  const proPendente = proTotal - proPago

  const lucro = receita - despesaPaga
  const margemLucro = receita > 0 ? (lucro / receita) * 100 : 0
  const sobraAposPro = lucro - proPago
  const margemAposPro = receita > 0 ? (sobraAposPro / receita) * 100 : 0

  const hoje = todayStr()
  const limite = new Date(new Date(hoje + "T12:00:00").getTime() + 14 * 86400000).toISOString().split('T')[0]
  const vencimentos = entries.filter(e => !e.paid_at && e.entry_date >= hoje && e.entry_date <= limite)

  const byCategory = Object.entries(
    despesasOp.reduce<Record<string, number>>((acc, e) => {
      const k = e.category ?? 'outro'
      acc[k] = (acc[k] ?? 0) + Number(e.amount)
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  function renderRow(e: FdmcEntry) {
    const isReceita = e.type === 'receita'
    const status = statusOf(e)
    const cats = isReceita ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES
    const cat = cats[e.category ?? 'outro'] ?? cats.outro
    const statusLabel = status === 'pago' ? (isReceita ? 'Recebido' : 'Pago') : status === 'atrasado' ? 'Atrasado' : (isReceita ? 'A receber' : 'Pendente')
    return (
      <div key={e.id} className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{e.description}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: cat.color + '20', color: cat.color }}>{cat.label}</span>
              {e.recurrent && (
                <span className="text-xs text-muted-foreground flex items-center gap-1" title={e.recurrence_end_date ? `Encerra em ${formatDate(e.recurrence_end_date)}` : 'Recorrente'}>
                  <Tag size={10} />{e.recurrence_end_date ? `até ${formatDate(e.recurrence_end_date)}` : 'recorrente'}
                </span>
              )}
              {e.notes && <p className="text-xs text-muted-foreground truncate">{e.notes}</p>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-sm font-semibold ${isReceita ? 'text-[#22c55e]' : ''}`}>{formatBRL(Number(e.amount))}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(e.entry_date)}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusStyle[status]}`}>{statusLabel}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => togglePaid(e)} disabled={busy === e.id}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${e.paid_at ? 'border border-[#2a2a2a] text-muted-foreground hover:text-foreground' : 'bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 border border-[#22c55e]/20'}`}>
              <Check size={12} />{e.paid_at ? 'Desfazer' : isReceita ? 'Marcar recebido' : 'Marcar pago'}
            </button>
            <button onClick={() => setModal({ type: e.type, prefill: e })} title="Repetir lançamento" className="text-muted-foreground/50 hover:text-foreground p-1.5 rounded-lg hover:bg-[#2a2a2a] transition-colors"><Copy size={12} /></button>
            <button onClick={() => setModal({ type: e.type, initial: e })} className="text-muted-foreground/50 hover:text-foreground p-1.5 rounded-lg hover:bg-[#2a2a2a] transition-colors"><Pencil size={12} /></button>
            <button onClick={() => remove(e)} disabled={busy === e.id} className="text-muted-foreground/50 hover:text-[#ef4444] p-1.5 rounded-lg hover:bg-[#ef4444]/5 transition-colors"><Trash2 size={12} /></button>
          </div>
        </div>
      </div>
    )
  }

  const tabs = [['visao', 'Visão geral'], ['receitas', 'Receitas'], ['despesas', 'Despesas'], ['vencimentos', 'Vencimentos'], ['caixa', 'Caixa']] as const

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Financeiro — FDMC</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">{monthName}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tab !== 'caixa' && (
            <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
              <button onClick={prevMonth} className="p-2 hover:bg-[#222222] rounded-l-lg transition-colors"><ChevronLeft size={14} /></button>
              <span className="text-xs px-3 capitalize min-w-[130px] text-center">{monthName}</span>
              <button onClick={nextMonth} className="p-2 hover:bg-[#222222] rounded-r-lg transition-colors"><ChevronRight size={14} /></button>
            </div>
          )}
          <button onClick={() => setModal({ type: 'despesa' })}
            className="flex items-center gap-2 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={14} /> Nova despesa
          </button>
          <button onClick={() => setModal({ type: 'receita' })}
            className="flex items-center gap-2 bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111] text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={14} /> Nova receita
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AvailableCashCard workspace="fdmc" />
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3"><ArrowUpCircle size={13} className="text-[#22c55e]" /><p className="text-xs text-muted-foreground uppercase tracking-wider">Faturamento</p></div>
          <p className="text-xl font-semibold text-[#22c55e]">{formatBRL(receita)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{formatBRL(aReceber)} a receber</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3"><ArrowDownCircle size={13} className="text-[#ef4444]" /><p className="text-xs text-muted-foreground uppercase tracking-wider">Despesas</p></div>
          <p className="text-xl font-semibold text-[#ef4444]">{formatBRL(despesaTotal)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{formatBRL(despesaPendente)} pendente</p>
        </div>
        <div className={`bg-[#1a1a1a] border rounded-xl p-5 ${lucro >= 0 ? 'border-[#2a2a2a]' : 'border-[#ef4444]/20'}`}>
          <div className="flex items-center gap-2 mb-3"><Wallet size={13} className="text-[#efefef]" /><p className="text-xs text-muted-foreground uppercase tracking-wider">Lucro</p></div>
          <p className={`text-xl font-semibold ${lucro >= 0 ? 'text-[#efefef]' : 'text-[#ef4444]'}`}>{formatBRL(lucro)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">receita − despesas (antes do pró-labore)</p>
        </div>
        <div className={`bg-[#1a1a1a] border rounded-xl p-5 ${margemLucro >= 0 ? 'border-[#2a2a2a]' : 'border-[#ef4444]/20'}`}>
          <div className="flex items-center gap-2 mb-3"><TrendingUp size={13} className={margemLucro >= 0 ? 'text-[#efefef]' : 'text-[#ef4444]'} /><p className="text-xs text-muted-foreground uppercase tracking-wider">Margem de lucro</p></div>
          <p className={`text-xl font-semibold ${margemLucro >= 0 ? 'text-[#efefef]' : 'text-[#ef4444]'}`}>{margemLucro.toFixed(1)}%</p>
          <p className="text-[11px] text-muted-foreground mt-1">lucro ÷ faturamento (antes do pró-labore)</p>
        </div>
        <div className={`bg-[#1a1a1a] border rounded-xl p-5 ${margemAposPro >= 0 ? 'border-[#2a2a2a]' : 'border-[#ef4444]/20'}`}>
          <div className="flex items-center gap-2 mb-3"><TrendingUp size={13} className={margemAposPro >= 0 ? 'text-[#efefef]' : 'text-[#ef4444]'} /><p className="text-xs text-muted-foreground uppercase tracking-wider">Margem após pró-labore</p></div>
          <p className={`text-xl font-semibold ${margemAposPro >= 0 ? 'text-[#efefef]' : 'text-[#ef4444]'}`}>{margemAposPro.toFixed(1)}%</p>
          <p className="text-[11px] text-muted-foreground mt-1">o que fica na empresa: {formatBRL(sobraAposPro)}</p>
        </div>
        <div className={`bg-[#1a1a1a] border rounded-xl p-5 ${sobraAposPro >= 0 ? 'border-[#2a2a2a]' : 'border-[#ef4444]/20'}`}>
          <div className="flex items-center gap-2 mb-3"><PiggyBank size={13} className="text-[#efefef]" /><p className="text-xs text-muted-foreground uppercase tracking-wider">Pró-labore</p></div>
          <p className="text-xl font-semibold text-[#efefef]">{formatBRL(proTotal)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{formatBRL(proPendente)} pendente · sobra {formatBRL(sobraAposPro)}</p>
        </div>
        <div className={`bg-[#1a1a1a] border rounded-xl p-5 ${inadimplente > 0 ? 'border-[#ef4444]/20' : 'border-[#2a2a2a]'}`}>
          <div className="flex items-center gap-2 mb-3"><AlertCircle size={13} className={inadimplente > 0 ? 'text-[#ef4444]' : 'text-muted-foreground'} /><p className="text-xs text-muted-foreground uppercase tracking-wider">Em atraso</p></div>
          <p className={`text-xl font-semibold ${inadimplente > 0 ? 'text-[#ef4444]' : 'text-muted-foreground'}`}>{formatBRL(inadimplente)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{inadimplenteCount} receita(s) em atraso</p>
        </div>
      </div>

      <CashFlowPanel workspace="fdmc" month={monthStr} version={flowVersion} />

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1 w-fit flex-wrap">
        {tabs.map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === k ? 'bg-[#2a2a2a] text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── Visão geral ─────────────────────────────────────────────────── */}
      {tab === 'visao' && (
        <div className="space-y-5">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-5"><TrendingUp size={14} className="text-[#efefef]" /><h2 className="text-sm font-medium">Receita vs Despesas — últimos 6 meses</h2></div>
            {historico.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={historico} barSize={20} barGap={4}>
                  <defs>
                    <linearGradient id="fRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0.4} /></linearGradient>
                    <linearGradient id="fExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} /></linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#2a2a2a" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [formatBRL(Number(v)), '']} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }} formatter={v => v === 'revenue' ? 'Receita' : 'Despesas'} />
                  <Bar dataKey="revenue" fill="url(#fRev)" radius={[4, 4, 0, 0]} name="revenue" />
                  <Bar dataKey="expenses" fill="url(#fExp)" radius={[4, 4, 0, 0]} name="expenses" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {historico.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-5"><Wallet size={14} className="text-[#efefef]" /><h2 className="text-sm font-medium">Lucro — últimos 6 meses</h2></div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={historico}>
                  <defs><linearGradient id="fProfit" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#efefef" stopOpacity={0.4} /><stop offset="100%" stopColor="#efefef" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="#2a2a2a" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }} formatter={(v: unknown) => [formatBRL(Number(v)), 'Lucro']} />
                  <Area type="monotone" dataKey="profit" stroke="#efefef" fill="url(#fProfit)" strokeWidth={2} dot={{ fill: '#efefef', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {historico.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
              {historico.slice().reverse().map(h => (
                <div key={h.key} className="px-5 py-4 flex items-center gap-4">
                  <span className="text-sm text-muted-foreground capitalize w-20">{h.label}</span>
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div><p className="text-[10px] text-muted-foreground mb-0.5">Receita</p><p className="font-medium text-[#22c55e]">{formatBRL(h.revenue)}</p></div>
                    <div><p className="text-[10px] text-muted-foreground mb-0.5">Despesas</p><p className="font-medium text-[#ef4444]">{formatBRL(h.expenses)}</p></div>
                    <div><p className="text-[10px] text-muted-foreground mb-0.5">Pró-labore</p><p className="font-medium text-[#efefef]">{formatBRL(h.prolabore ?? 0)}</p></div>
                    <div><p className="text-[10px] text-muted-foreground mb-0.5">Lucro</p><p className={`font-medium ${h.profit >= 0 ? 'text-[#efefef]' : 'text-[#ef4444]'}`}>{formatBRL(h.profit)}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {byCategory.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2"><Tag size={13} className="text-muted-foreground" /><h2 className="text-sm font-medium">Despesas por categoria — {monthName}</h2></div>
              <div className="space-y-3">
                {byCategory.map(([cat, val]) => {
                  const info = EXPENSE_CATEGORIES[cat] ?? EXPENSE_CATEGORIES.outro
                  const pct = despesaTotal > 0 ? Math.round((val / despesaTotal) * 100) : 0
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{info.label}</span>
                        <div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{pct}%</span><span className="text-sm font-medium">{formatBRL(val)}</span></div>
                      </div>
                      <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: info.color }} /></div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Receitas ────────────────────────────────────────────────────── */}
      {tab === 'receitas' && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="w-5 h-5 border-2 border-[#efefef] border-t-transparent rounded-full animate-spin" /></div>
          ) : receitas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-sm text-muted-foreground">
              Nenhuma receita neste mês
              <button onClick={() => setModal({ type: 'receita' })} className="flex items-center gap-1 text-xs text-[#efefef]"><Plus size={12} /> Adicionar receita</button>
            </div>
          ) : (
            <div className="divide-y divide-[#2a2a2a]">{receitas.map(renderRow)}</div>
          )}
        </div>
      )}

      {/* ── Despesas ────────────────────────────────────────────────────── */}
      {tab === 'despesas' && (
        <div className="space-y-4">
          {despesasAll.length === 0 && !loading && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl flex flex-col items-center justify-center h-40 gap-3 text-sm text-muted-foreground">
              <ArrowDownCircle size={24} className="opacity-30" />
              Nenhuma despesa neste mês
              <button onClick={() => setModal({ type: 'despesa' })} className="flex items-center gap-1 text-xs text-[#efefef]"><Plus size={12} /> Adicionar despesa</button>
            </div>
          )}
          {[{ title: 'Despesas', list: despesasOp }, { title: 'Pró-labore', list: prolabores }, { title: 'Aplicações / aportes', list: aplicacoes }].filter(g => g.list.length > 0).map(group => (
            <div key={group.title} className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground px-1">{group.title}</p>
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
                <div className="divide-y divide-[#2a2a2a]">{group.list.map(renderRow)}</div>
              </div>
            </div>
          ))}
          {despesasAll.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Despesas do mês', value: despesaTotal, color: 'text-foreground' },
                { label: 'Despesas pagas', value: despesaPaga, color: 'text-[#22c55e]' },
                { label: 'Despesas pendentes', value: despesaPendente, color: 'text-[#f59e0b]' },
                { label: 'Pró-labore (pago)', value: proPago, color: 'text-[#efefef]' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
                  <p className="text-xs text-muted-foreground mb-2">{label}</p>
                  <p className={`text-lg font-semibold ${color}`}>{formatBRL(value)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Vencimentos ─────────────────────────────────────────────────── */}
      {tab === 'vencimentos' && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Receitas e despesas com vencimento nos próximos 14 dias</p>
          {vencimentos.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl flex items-center justify-center h-40 text-sm text-muted-foreground">
              <div className="flex flex-col items-center gap-2"><Clock size={24} className="opacity-30" />Nenhum vencimento nos próximos 14 dias</div>
            </div>
          ) : (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
              {vencimentos.map(e => (
                <div key={e.id} className="flex items-center justify-between px-5 py-3.5 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {e.type === 'receita' ? <TrendingUp size={14} className="text-[#22c55e] shrink-0" /> : <TrendingDown size={14} className="text-[#ef4444] shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{e.description}</p>
                      <p className="text-xs text-muted-foreground">{e.type === 'receita' ? 'A receber' : 'A pagar'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatBRL(Number(e.amount))}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(e.entry_date)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'caixa' && <CaixaTab />}

      {modal && (
        <EntryModal
          type={modal.type}
          initial={modal.initial}
          prefill={modal.prefill}
          defaultDate={monthStr === todayStr().slice(0, 7) ? todayStr() : `${monthStr}-01`}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}

// ── Modal de lançamento (criar, editar e repetir) ─────────────────────────────
function EntryModal({ type, initial, prefill, defaultDate, onClose, onSaved }: {
  type: 'receita' | 'despesa'
  initial?: FdmcEntry
  prefill?: FdmcEntry
  defaultDate: string
  onClose: () => void
  onSaved: () => void
}) {
  const src = initial ?? prefill
  const cats = type === 'receita' ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES
  const [form, setForm] = useState({
    description: src?.description ?? '',
    amount: src ? String(src.amount) : '',
    category: src?.category && cats[src.category] ? src.category : 'outro',
    entry_date: initial ? initial.entry_date : prefill ? todayStr() : defaultDate,
    recurrent: initial ? !!initial.recurrent : false,
    recurrence_end_date: '',
    notes: src?.notes ?? '',
  })
  const [alreadyPaid, setAlreadyPaid] = useState(false)
  const [paidDate, setPaidDate] = useState(form.entry_date)
  const [paidTouched, setPaidTouched] = useState(false)
  const [applyForward, setApplyForward] = useState(false)
  const [effectiveDate, setEffectiveDate] = useState(initial?.entry_date ?? todayStr())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isRecurringEdit = !!initial?.recurrence_group
  const amountChanged = initial ? Number(form.amount) !== Number(initial.amount) : false

  async function save() {
    setError('')
    if (!form.description.trim()) return setError('Informe a descrição')
    const amountNum = parseFloat(String(form.amount).replace(',', '.'))
    if (!amountNum || amountNum <= 0) return setError('Informe um valor maior que zero')
    if (!form.entry_date) return setError('Informe a data')
    setSaving(true)
    const res = await fetch(initial ? `/api/fdmc/entries/${initial.id}` : '/api/fdmc/entries', {
      method: initial ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        type,
        amount: amountNum,
        ...(isRecurringEdit && amountChanged && applyForward ? { effective_date: effectiveDate } : {}),
        ...(!initial && alreadyPaid ? { paid_at: new Date(paidDate + 'T12:00:00').toISOString() } : {}),
      }),
    })
    if (res.ok) { onSaved(); return }
    const err = await res.json().catch(() => ({}))
    setError(err.error ?? 'Erro ao salvar')
    setSaving(false)
  }

  const title = `${initial ? 'Editar' : prefill ? 'Repetir' : 'Nova'} ${type === 'receita' ? 'receita' : 'despesa'}`

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Descrição</label>
            <input autoFocus value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder={type === 'receita' ? 'Ex: Venda, comissão...' : 'Ex: Pró-labore, aluguel, imposto...'} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Valor (R$)</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0,00" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Vencimento</label>
              <input type="date" value={form.entry_date} onChange={e => { const v = e.target.value; setForm(f => ({ ...f, entry_date: v })); if (!paidTouched) setPaidDate(v) }} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Categoria</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
              {Object.entries(cats).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          {!initial && (
            <div className="rounded-lg border border-[#2a2a2a] p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={alreadyPaid} onChange={e => { setAlreadyPaid(e.target.checked); if (e.target.checked && !paidTouched) setPaidDate(form.entry_date) }} className="accent-[#22c55e]" />
                {type === 'receita' ? 'Já foi recebida' : 'Já está paga'}
              </label>
              {alreadyPaid && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">{type === 'receita' ? 'Data do recebimento' : 'Data do pagamento'}</label>
                  <input type="date" value={paidDate} onChange={e => { setPaidDate(e.target.value); setPaidTouched(true) }} className={inputCls} />
                </div>
              )}
            </div>
          )}

          {(!initial || !initial.recurrence_group) && (
            <div className="rounded-lg border border-[#2a2a2a] p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.recurrent} onChange={e => setForm(f => ({ ...f, recurrent: e.target.checked }))} className="accent-[#efefef]" />
                Repetir todo mês
              </label>
              {form.recurrent && (
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Até quando (opcional)</label>
                  <input type="date" value={form.recurrence_end_date} onChange={e => setForm(f => ({ ...f, recurrence_end_date: e.target.value }))} className={inputCls} />
                  <p className="text-[11px] text-muted-foreground mt-1">Deixe em branco para repetir sem prazo.</p>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Observações (opcional)</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Referência, número NF..." className={inputCls} />
          </div>

          {isRecurringEdit && amountChanged && (
            <div className="bg-[#efefef]/10 border border-[#efefef]/20 rounded-lg p-3 space-y-2.5">
              <p className="text-xs text-foreground">O valor mudou. Vale pra quais meses?</p>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="radio" checked={!applyForward} onChange={() => setApplyForward(false)} className="mt-1 accent-[#efefef]" />
                <span>Só este lançamento<span className="block text-[11px] text-muted-foreground">Os outros meses continuam com o valor de antes.</span></span>
              </label>
              <label className="flex items-start gap-2 text-sm cursor-pointer">
                <input type="radio" checked={applyForward} onChange={() => setApplyForward(true)} className="mt-1 accent-[#efefef]" />
                <span>Este e os próximos meses<span className="block text-[11px] text-muted-foreground">Reajuste: atualiza as parcelas futuras ainda não pagas.</span></span>
              </label>
              {applyForward && (
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">A partir de</label>
                  <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className={inputCls} />
                </div>
              )}
            </div>
          )}
        </div>

        {error && <p className="text-xs text-[#ef4444] flex items-center gap-1"><AlertCircle size={12} />{error}</p>}

        <div className="flex gap-3 pt-1">
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
