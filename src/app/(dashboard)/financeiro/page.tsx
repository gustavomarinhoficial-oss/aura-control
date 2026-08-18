'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatBRL, formatDate } from '@/lib/utils/format'
import {
  Plus, ChevronLeft, ChevronRight, Check, TrendingUp, MessageCircle,
  Copy, X, Trash2, ArrowUpCircle, ArrowDownCircle, Wallet,
  Clock, AlertCircle, Edit2, Tag
} from 'lucide-react'
import { NewChargeModal } from '@/components/domain/NewChargeModal'
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend,
  AreaChart, Area, CartesianGrid
} from 'recharts'
import type { Charge } from '@/lib/supabase/types'

// ── tipos ──────────────────────────────────────────────────────────────────
type ChargeService = { active: boolean; contract_end?: string | null } | null
type ChargeWithStatus = Charge & { status: string; clients?: { name: string; phone?: string }; services?: ChargeService }

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  due_date: string
  paid_at: string | null
  recurrent: boolean
  recurrence_group: string | null
  notes: string | null
}

interface HistoricoPoint { label: string; key: string; revenue: number; expenses: number; profit: number }

// ── constantes ──────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES: Record<string, { label: string; color: string }> = {
  prolabore:  { label: 'Pró-labore',    color: '#a78bfa' },
  salario:    { label: 'Salário',       color: '#818cf8' },
  impostos:   { label: 'Impostos',      color: '#f59e0b' },
  aluguel:    { label: 'Aluguel',       color: '#60a5fa' },
  software:   { label: 'Software/Tools',color: '#34d399' },
  marketing:  { label: 'Marketing',     color: '#f472b6' },
  pessoal:    { label: 'Pessoal',       color: '#fb923c' },
  outro:      { label: 'Outro',         color: '#6b7280' },
}

const chargeStatusStyle: Record<string, string> = {
  pago:      'text-[#22c55e] bg-[#22c55e]/10',
  pendente:  'text-muted-foreground bg-[#2a2a2a]',
  atrasado:  'text-[#ef4444] bg-[#ef4444]/10',
  encerrado: 'text-muted-foreground/50 bg-[#2a2a2a]',
}
const chargeStatusLabel: Record<string, string> = { pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado', encerrado: 'Encerrado' }

const EMPTY_EXPENSE = { description: '', amount: '', category: 'outro', due_date: '', recurrent: false, notes: '' }

// ── helpers ─────────────────────────────────────────────────────────────────
function resolveStatus(c: ChargeWithStatus): string {
  if (c.paid_at) return 'pago'
  if (c.services && c.services.active === false) return 'encerrado'
  if (new Date(c.due_date) < new Date(new Date().toDateString())) return 'atrasado'
  return 'pendente'
}

function buildWhatsAppMessage(charge: ChargeWithStatus, pixKey: string, agencyName: string): string {
  const clientName = charge.clients?.name ?? 'Cliente'
  const isOverdue = !charge.paid_at && new Date(charge.due_date) < new Date()
  const dueFormatted = new Date(charge.due_date + 'T12:00:00').toLocaleDateString('pt-BR')
  return `Olá, ${clientName}! 👋\n\n${isOverdue ? '⚠️ Identificamos uma cobrança em aberto:' : 'Passando pra lembrar sobre a cobrança:'}\n\n📋 *${charge.description}*\n💰 *${formatBRL(Number(charge.amount))}*\n📅 Vencimento: ${dueFormatted}${isOverdue ? ' _(em atraso)_' : ''}\n\nPara realizar o pagamento via *PIX*:\n🔑 \`${pixKey || 'chave não configurada — acesse Configurações'}\`\n${pixKey ? '\nÉ só copiar a chave acima e realizar o pagamento pelo seu banco. ✅' : ''}\n\nQualquer dúvida, estamos à disposição! 😊\n\n_${agencyName}_`
}

// ── WhatsApp modal ───────────────────────────────────────────────────────────
function WhatsAppModal({ charge, onClose }: { charge: ChargeWithStatus; onClose: () => void }) {
  const [pixKey, setPixKey] = useState(localStorage.getItem('aura_pix_key') ?? '')
  const [agencyName] = useState(localStorage.getItem('aura_agency_name') ?? 'Aura MKT.CLUB')
  const [copied, setCopied] = useState(false)
  const msg = buildWhatsAppMessage(charge, pixKey, agencyName)
  const phone = charge.clients?.phone

  function copyMsg() { navigator.clipboard.writeText(msg); setCopied(true); setTimeout(() => setCopied(false), 2000) }
  function openWA() {
    const encoded = encodeURIComponent(msg)
    const phoneClean = phone ? phone.replace(/\D/g, '') : ''
    window.open(phoneClean ? `https://wa.me/55${phoneClean}?text=${encoded}` : `https://wa.me/?text=${encoded}`, '_blank')
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><MessageCircle size={15} className="text-[#25d366]" /><h2 className="text-sm font-semibold">Mensagem de cobrança</h2></div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
        </div>
        {!pixKey && <div className="flex items-start gap-2 bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-lg px-3 py-2.5"><span className="text-[#f59e0b] text-xs">⚠️ Chave PIX não configurada. Acesse <strong>Configurações</strong>.</span></div>}
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-4"><pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{msg}</pre></div>
        <div className="flex gap-2">
          <button onClick={copyMsg} className={`flex-1 flex items-center justify-center gap-2 text-sm py-2.5 rounded-lg border transition-all ${copied ? 'border-[#22c55e]/40 text-[#22c55e] bg-[#22c55e]/5' : 'border-[#2a2a2a] hover:bg-[#222222]'}`}>
            {copied ? <><Check size={13} /> Copiado!</> : <><Copy size={13} /> Copiar</>}
          </button>
          <button onClick={openWA} className="flex-1 flex items-center justify-center gap-2 text-sm py-2.5 rounded-lg bg-[#25d366] hover:bg-[#22c55e] text-white font-medium transition-colors">
            <MessageCircle size={13} />{phone ? 'Abrir WhatsApp' : 'WhatsApp Web'}
          </button>
        </div>
        {!phone && <p className="text-[10px] text-muted-foreground text-center">Sem telefone cadastrado — WhatsApp abrirá sem destinatário.</p>}
      </div>
    </div>
  )
}

// ── Expense modal ────────────────────────────────────────────────────────────
function ExpenseModal({ initial, onClose, onSaved }: {
  initial?: Expense
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState(initial ? {
    description: initial.description,
    amount: String(initial.amount),
    category: initial.category,
    due_date: initial.due_date,
    recurrent: initial.recurrent,
    notes: initial.notes ?? '',
  } : { ...EMPTY_EXPENSE, due_date: new Date().toISOString().split('T')[0] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isRecurringEdit = !!initial?.recurrence_group
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0])
  const amountChanged = initial ? Number(form.amount) !== initial.amount : false

  async function save() {
    if (!form.description.trim()) return setError('Informe a descrição')
    if (!form.amount || isNaN(Number(form.amount))) return setError('Informe o valor')
    if (!form.due_date) return setError('Informe a data')
    setSaving(true)
    const res = await fetch(initial ? `/api/expenses/${initial.id}` : '/api/expenses', {
      method: initial ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        amount: Number(form.amount),
        ...(isRecurringEdit && amountChanged ? { effective_date: effectiveDate } : {}),
      }),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erro'); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{initial ? 'Editar despesa' : 'Nova despesa'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Descrição</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Ex: Pró-labore do sócio, Imposto DAS..."
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Valor (R$)</label>
              <input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0,00"
                className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Vencimento</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Categoria</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors">
              {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Observações (opcional)</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Referência, número NF..."
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors" />
          </div>
          {initial ? (
            isRecurringEdit && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Tag size={11} />Despesa recorrente — as parcelas futuras seguem vinculadas.
              </p>
            )
          ) : (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.recurrent} onChange={e => setForm(f => ({ ...f, recurrent: e.target.checked }))}
                className="w-4 h-4 accent-[#7c3aed]" />
              <span className="text-sm">Despesa recorrente (mensal)</span>
            </label>
          )}
          {isRecurringEdit && amountChanged && (
            <div className="bg-[#7c3aed]/10 border border-[#7c3aed]/20 rounded-lg p-3 space-y-2">
              <p className="text-xs text-foreground">O valor mudou. A partir de quando vale o novo valor?</p>
              <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)}
                className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors" />
              <p className="text-[11px] text-muted-foreground">Atualiza esta e todas as parcelas futuras ainda não pagas.</p>
            </div>
          )}
        </div>

        {error && <p className="text-xs text-[#ef4444] flex items-center gap-1"><AlertCircle size={12} />{error}</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-[#2a2a2a] text-sm py-2.5 rounded-lg hover:bg-[#222222] transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving}
            className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm py-2.5 rounded-lg transition-colors disabled:opacity-60 font-medium">
            {saving ? 'Salvando...' : initial ? 'Salvar' : 'Criar despesa'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function FinanceiroPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [tab, setTab] = useState<'visao' | 'receitas' | 'despesas' | 'vencimentos'>('visao')

  const [charges, setCharges] = useState<ChargeWithStatus[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [historico, setHistorico] = useState<HistoricoPoint[]>([])
  const [loading, setLoading] = useState(true)

  const [showNewCharge, setShowNewCharge] = useState(false)
  const [showNewExpense, setShowNewExpense] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  const [paying, setPaying] = useState<string | null>(null)
  const [payingExp, setPayingExp] = useState<string | null>(null)
  const [deletingCharge, setDeletingCharge] = useState<string | null>(null)
  const [deletingExp, setDeletingExp] = useState<string | null>(null)
  const [whatsAppCharge, setWhatsAppCharge] = useState<ChargeWithStatus | null>(null)

  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const monthName = new Date(year, month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  const load = useCallback(async () => {
    setLoading(true)
    const [chargesRes, expensesRes] = await Promise.all([
      fetch(`/api/charges?month=${monthStr}`).then(r => r.json()).catch(() => []),
      fetch(`/api/expenses?month=${monthStr}`).then(r => r.json()).catch(() => []),
    ])
    setCharges(Array.isArray(chargesRes) ? chargesRes : [])
    setExpenses(Array.isArray(expensesRes) ? expensesRes : [])
    setLoading(false)
  }, [monthStr])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/charges/generate', { method: 'POST' }).then(() => load()).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetch('/api/financeiro/historico').then(r => r.json()).then(d => setHistorico(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  // ── cálculos de receita ──────────────────────────────────────────────────
  const withStatus = charges.map(c => ({ ...c, status: resolveStatus(c) }))
  const receita      = withStatus.filter(c => c.status === 'pago').reduce((s, c) => s + Number(c.amount), 0)
  const aReceber     = withStatus.filter(c => c.status === 'pendente').reduce((s, c) => s + Number(c.amount), 0)
  const inadimplente = withStatus.filter(c => c.status === 'atrasado').reduce((s, c) => s + Number(c.amount), 0)

  // ── cálculos de despesa ──────────────────────────────────────────────────
  const despesaTotal  = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const despesaPaga   = expenses.filter(e => e.paid_at).reduce((s, e) => s + Number(e.amount), 0)
  const despesaPendente = expenses.filter(e => !e.paid_at).reduce((s, e) => s + Number(e.amount), 0)

  // ── lucro ────────────────────────────────────────────────────────────────
  const lucro = receita - despesaPaga

  // ── próximos vencimentos (14 dias) ───────────────────────────────────────
  const hoje = today.toISOString().split('T')[0]
  const limite = new Date(today.getTime() + 14 * 86400000).toISOString().split('T')[0]
  const vencimentosCharges = withStatus.filter(c => !c.paid_at && c.due_date >= hoje && c.due_date <= limite && c.status !== 'encerrado')
  const vencimentosExp = expenses.filter(e => !e.paid_at && e.due_date >= hoje && e.due_date <= limite)

  // ── categorias de despesa ────────────────────────────────────────────────
  const byCategory = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount); return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  // ── ações ────────────────────────────────────────────────────────────────
  async function markChargePaid(id: string, isPaid: boolean) {
    setPaying(id)
    await fetch(`/api/charges/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: isPaid ? 'unpay' : 'pay' }) })
    setPaying(null)
    load()
  }

  async function deleteCharge(id: string) {
    setDeletingCharge(id)
    await fetch(`/api/charges/${id}`, { method: 'DELETE' })
    setDeletingCharge(null)
    load()
  }

  async function markExpensePaid(id: string, isPaid: boolean) {
    setPayingExp(id)
    await fetch(`/api/expenses/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: isPaid ? 'unpay' : 'pay' }) })
    setPayingExp(null)
    load()
  }

  async function deleteExpense(id: string) {
    setDeletingExp(id)
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    setDeletingExp(null)
    load()
  }

  // ── UI ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">{monthName}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
            <button onClick={prevMonth} className="p-2 hover:bg-[#222222] rounded-l-lg transition-colors"><ChevronLeft size={14} /></button>
            <span className="text-xs px-3 capitalize min-w-[130px] text-center">{monthName}</span>
            <button onClick={nextMonth} className="p-2 hover:bg-[#222222] rounded-r-lg transition-colors"><ChevronRight size={14} /></button>
          </div>
          <button onClick={() => setShowNewExpense(true)}
            className="flex items-center gap-2 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={14} /> Nova despesa
          </button>
          <button onClick={() => setShowNewCharge(true)}
            className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={14} /> Nova receita
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ArrowUpCircle size={13} className="text-[#22c55e]" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Receita</p>
          </div>
          <p className="text-xl font-semibold text-[#22c55e]">{formatBRL(receita)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{formatBRL(aReceber)} a receber</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownCircle size={13} className="text-[#ef4444]" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Despesas</p>
          </div>
          <p className="text-xl font-semibold text-[#ef4444]">{formatBRL(despesaTotal)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{formatBRL(despesaPendente)} pendente</p>
        </div>
        <div className={`bg-[#1a1a1a] border rounded-xl p-5 ${lucro >= 0 ? 'border-[#2a2a2a]' : 'border-[#ef4444]/20'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={13} className="text-[#a78bfa]" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Lucro líquido</p>
          </div>
          <p className={`text-xl font-semibold ${lucro >= 0 ? 'text-[#a78bfa]' : 'text-[#ef4444]'}`}>{formatBRL(lucro)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">receita − despesas pagas</p>
        </div>
        <div className={`bg-[#1a1a1a] border rounded-xl p-5 ${inadimplente > 0 ? 'border-[#ef4444]/20' : 'border-[#2a2a2a]'}`}>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={13} className={inadimplente > 0 ? 'text-[#ef4444]' : 'text-muted-foreground'} />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Inadimplente</p>
          </div>
          <p className={`text-xl font-semibold ${inadimplente > 0 ? 'text-[#ef4444]' : 'text-muted-foreground'}`}>{formatBRL(inadimplente)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{withStatus.filter(c => c.status === 'atrasado').length} cobrança(s) em atraso</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1 w-fit flex-wrap">
        {([['visao', 'Visão geral'], ['receitas', 'Receitas'], ['despesas', 'Despesas'], ['vencimentos', 'Vencimentos']] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${tab === k ? 'bg-[#2a2a2a] text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── Tab: Visão Geral ───────────────────────────────────────────────── */}
      {tab === 'visao' && (
        <div className="space-y-5">

          {/* Gráfico comparativo 6 meses */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp size={14} className="text-[#a78bfa]" />
              <h2 className="text-sm font-medium">Receita vs Despesas — últimos 6 meses</h2>
            </div>
            {historico.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Carregando...</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={historico} barSize={20} barGap={4}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.4} />
                    </linearGradient>
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#2a2a2a" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: unknown) => [formatBRL(Number(v)), '']}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                    formatter={v => v === 'revenue' ? 'Receita' : 'Despesas'} />
                  <Bar dataKey="revenue" fill="url(#gRev)" radius={[4, 4, 0, 0]} name="revenue" />
                  <Bar dataKey="expenses" fill="url(#gExp)" radius={[4, 4, 0, 0]} name="expenses" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Fluxo de caixa */}
          {historico.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <Wallet size={14} className="text-[#a78bfa]" />
                <h2 className="text-sm font-medium">Lucro líquido — últimos 6 meses</h2>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={historico}>
                  <defs>
                    <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#2a2a2a" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: unknown) => [formatBRL(Number(v)), 'Lucro']}
                  />
                  <Area type="monotone" dataKey="profit" stroke="#a78bfa" fill="url(#gProfit)" strokeWidth={2} dot={{ fill: '#a78bfa', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Comparativo por mês */}
          {historico.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
              {historico.slice().reverse().map(h => (
                <div key={h.key} className="px-5 py-4 flex items-center gap-4">
                  <span className="text-sm text-muted-foreground capitalize w-20">{h.label}</span>
                  <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Receita</p>
                      <p className="font-medium text-[#22c55e]">{formatBRL(h.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Despesas</p>
                      <p className="font-medium text-[#ef4444]">{formatBRL(h.expenses)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-0.5">Lucro</p>
                      <p className={`font-medium ${h.profit >= 0 ? 'text-[#a78bfa]' : 'text-[#ef4444]'}`}>{formatBRL(h.profit)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Despesas por categoria */}
          {byCategory.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Tag size={13} className="text-muted-foreground" />
                <h2 className="text-sm font-medium">Despesas por categoria — {monthName}</h2>
              </div>
              <div className="space-y-3">
                {byCategory.map(([cat, val]) => {
                  const info = EXPENSE_CATEGORIES[cat] ?? EXPENSE_CATEGORIES.outro
                  const pct = despesaTotal > 0 ? Math.round((val / despesaTotal) * 100) : 0
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{info.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                          <span className="text-sm font-medium">{formatBRL(val)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: info.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Receitas ─────────────────────────────────────────────────── */}
      {tab === 'receitas' && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" /></div>
          ) : withStatus.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Nenhuma receita neste mês</div>
          ) : (
            <div className="divide-y divide-[#2a2a2a]">
              {withStatus.map(c => (
                <div key={c.id} className="p-4 space-y-3">
                  {/* Linha 1: cliente + valor */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.clients?.name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.description}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{formatBRL(Number(c.amount))}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(c.due_date)}</p>
                    </div>
                  </div>
                  {/* Linha 2: status + ações */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${chargeStatusStyle[c.status]}`}>
                      {chargeStatusLabel[c.status]}
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => markChargePaid(c.id, !!c.paid_at)} disabled={paying === c.id}
                        className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${c.paid_at ? 'border border-[#2a2a2a] text-muted-foreground hover:text-foreground' : 'bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 border border-[#22c55e]/20'}`}>
                        <Check size={12} />{c.paid_at ? 'Desfazer' : 'Marcar pago'}
                      </button>
                      {!c.paid_at && c.status !== 'encerrado' && (
                        <button onClick={() => setWhatsAppCharge(c as ChargeWithStatus)}
                          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-[#25d366]/30 text-[#25d366] hover:bg-[#25d366]/10 transition-colors">
                          <MessageCircle size={12} /> Cobrar
                        </button>
                      )}
                      <button onClick={() => { if (confirm('Apagar esta cobrança?')) deleteCharge(c.id) }} disabled={deletingCharge === c.id}
                        className="text-muted-foreground/50 hover:text-[#ef4444] p-1.5 rounded-lg hover:bg-[#ef4444]/5 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Despesas ─────────────────────────────────────────────────── */}
      {tab === 'despesas' && (
        <div className="space-y-4">
          {expenses.length === 0 && !loading && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl flex flex-col items-center justify-center h-40 gap-3 text-sm text-muted-foreground">
              <ArrowDownCircle size={24} className="opacity-30" />
              Nenhuma despesa neste mês
              <button onClick={() => setShowNewExpense(true)} className="flex items-center gap-1 text-xs text-[#a78bfa] hover:text-[#7c3aed] transition-colors">
                <Plus size={12} /> Adicionar despesa
              </button>
            </div>
          )}
          {expenses.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <div className="divide-y divide-[#2a2a2a]">
                {expenses.map(e => {
                  const catInfo = EXPENSE_CATEGORIES[e.category] ?? EXPENSE_CATEGORIES.outro
                  const isPaid = !!e.paid_at
                  const isOverdue = !isPaid && e.due_date < hoje
                  return (
                    <div key={e.id} className="p-4 space-y-3">
                      {/* Linha 1: descrição + valor */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{e.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: catInfo.color + '20', color: catInfo.color }}>
                              {catInfo.label}
                            </span>
                            {e.notes && <p className="text-xs text-muted-foreground truncate">{e.notes}</p>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold">{formatBRL(Number(e.amount))}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(e.due_date)}</p>
                        </div>
                      </div>
                      {/* Linha 2: status + ações */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${isPaid ? 'text-[#22c55e] bg-[#22c55e]/10' : isOverdue ? 'text-[#ef4444] bg-[#ef4444]/10' : 'text-muted-foreground bg-[#2a2a2a]'}`}>
                          {isPaid ? 'Pago' : isOverdue ? 'Atrasado' : 'Pendente'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => markExpensePaid(e.id, isPaid)} disabled={payingExp === e.id}
                            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${isPaid ? 'border border-[#2a2a2a] text-muted-foreground hover:text-foreground' : 'bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 border border-[#22c55e]/20'}`}>
                            <Check size={12} />{isPaid ? 'Desfazer' : 'Marcar pago'}
                          </button>
                          <button onClick={() => setEditingExpense(e)} className="text-muted-foreground/50 hover:text-foreground p-1.5 rounded-lg hover:bg-[#2a2a2a] transition-colors"><Edit2 size={12} /></button>
                          <button onClick={() => { if (confirm('Apagar esta despesa?')) deleteExpense(e.id) }} disabled={deletingExp === e.id}
                            className="text-muted-foreground/50 hover:text-[#ef4444] p-1.5 rounded-lg hover:bg-[#ef4444]/5 transition-colors"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {/* Totais */}
          {expenses.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Total do mês', value: despesaTotal, color: 'text-foreground' },
                { label: 'Pago', value: despesaPaga, color: 'text-[#22c55e]' },
                { label: 'Pendente', value: despesaPendente, color: 'text-[#f59e0b]' },
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

      {/* ── Tab: Vencimentos ──────────────────────────────────────────────── */}
      {tab === 'vencimentos' && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Cobranças e despesas com vencimento nos próximos 14 dias</p>

          {vencimentosCharges.length === 0 && vencimentosExp.length === 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl flex items-center justify-center h-40 text-sm text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <Clock size={24} className="opacity-30" />
                Nenhum vencimento nos próximos 14 dias
              </div>
            </div>
          )}

          {vencimentosCharges.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#2a2a2a] flex items-center gap-2">
                <ArrowUpCircle size={13} className="text-[#22c55e]" />
                <span className="text-xs font-medium text-[#22c55e]">Receitas a receber</span>
              </div>
              <div className="divide-y divide-[#2a2a2a]">
                {vencimentosCharges.map(c => (
                  <div key={c.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{c.clients?.name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{c.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{formatBRL(Number(c.amount))}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(c.due_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {vencimentosExp.length > 0 && (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#2a2a2a] flex items-center gap-2">
                <ArrowDownCircle size={13} className="text-[#ef4444]" />
                <span className="text-xs font-medium text-[#ef4444]">Despesas a pagar</span>
              </div>
              <div className="divide-y divide-[#2a2a2a]">
                {vencimentosExp.map(e => {
                  const catInfo = EXPENSE_CATEGORIES[e.category] ?? EXPENSE_CATEGORIES.outro
                  return (
                    <div key={e.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{e.description}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: catInfo.color + '20', color: catInfo.color }}>{catInfo.label}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatBRL(Number(e.amount))}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(e.due_date)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showNewCharge && (
        <NewChargeModal onClose={() => setShowNewCharge(false)} onCreated={() => { setShowNewCharge(false); load() }} defaultMonth={monthStr} />
      )}
      {showNewExpense && (
        <ExpenseModal onClose={() => setShowNewExpense(false)} onSaved={() => { setShowNewExpense(false); load() }} />
      )}
      {editingExpense && (
        <ExpenseModal initial={editingExpense} onClose={() => setEditingExpense(null)} onSaved={() => { setEditingExpense(null); load() }} />
      )}
      {whatsAppCharge && (
        <WhatsAppModal charge={whatsAppCharge} onClose={() => setWhatsAppCharge(null)} />
      )}
    </div>
  )
}
