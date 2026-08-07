'use client'

import { useEffect, useState } from 'react'
import { formatBRL, formatDate } from '@/lib/utils/format'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, BarChart, Bar, CartesianGrid } from 'recharts'
import { Users, TrendingUp, DollarSign, AlertCircle, ArrowUpRight, CheckSquare, Bell, Clock, X, Kanban, Pencil, Check, CalendarDays, Layers, ImageIcon, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getRole, type Role } from '@/lib/roles'
import type { Task } from '@/lib/supabase/types'

// ── tipos ──────────────────────────────────────────────────────────────────────
interface DashboardData {
  activeClients: number; mrr: number; estimatedMonth: number; receivedMonth: number
  overdueCount: number; clientChurn: number; mrrChurn: number
  chartData: { month: string; value: number }[]
  upcoming: { id: string; description: string; amount: number; due_date: string; clients: { name: string } | null }[]
}
interface Lead { id: string; company_name: string; estimated_value: number | null; stage: string }
interface AlertData {
  overdue: { id: string; description: string; amount: number; due_date: string; clients: { name: string } | null }[]
  upcoming: { id: string; description: string; amount: number; due_date: string; clients: { name: string } | null }[]
  renewals: { id: string; name: string; contract_end: string; clients: { name: string } | null }[]
}
interface ContentPost {
  id: string; client_id: string; title: string; platform: string; status: string
  scheduled_date: string | null; published_at: string | null
  media_url: string | null; responsible: string | null
  result: Record<string, number>
  clients?: { id: string; name: string } | null
}
interface Project {
  id: string; title: string; status: string; deadline: string | null; owner: string | null
  clients?: { id: string; name: string } | null
  checklist: { id: string; title: string; done: boolean }[]
}
interface Client { id: string; name: string; status: string }

const PLATFORM_COLOR: Record<string, string> = {
  instagram: '#e1306c', facebook: '#1877f2', linkedin: '#0a66c2',
  tiktok: '#69c9d0', youtube: '#ff4444', twitter: '#94a3b8',
  pinterest: '#e60023', google_ads: '#4285f4', email: '#8b5cf6',
}
const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn',
  tiktok: 'TikTok', youtube: 'YouTube', twitter: 'Twitter/X',
  pinterest: 'Pinterest', google_ads: 'Google Ads', email: 'E-mail',
}
const STAGE_META: Record<string, { label: string; color: string }> = {
  prospecto:  { label: 'Prospecto',        color: '#6b7280' },
  contato:    { label: 'Contato feito',    color: '#3b82f6' },
  proposta:   { label: 'Proposta enviada', color: '#f59e0b' },
  negociacao: { label: 'Negociação',       color: '#f97316' },
  fechado:    { label: 'Fechado',          color: '#22c55e' },
}

// ── KpiCard (reused) ───────────────────────────────────────────────────────────
function KpiCard({ label, value, numericValue, sub, icon: Icon, highlight, accent, goalKey, isCurrency, hide }: {
  label: string; value: string; numericValue: number; sub?: string
  icon: React.ElementType; highlight?: boolean; accent?: boolean; goalKey: string; isCurrency?: boolean; hide?: boolean
}) {
  const storageKey = `kpi_goal_${goalKey}`
  const [goal, setGoal]     = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [input, setInput]   = useState('')

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved) setGoal(Number(saved))
  }, [storageKey])

  function saveGoal() {
    const val = parseFloat(input.replace(/[^\d.,]/g, '').replace(',', '.'))
    if (!isNaN(val) && val > 0) { localStorage.setItem(storageKey, String(val)); setGoal(val) }
    setEditing(false); setInput('')
  }
  function clearGoal() { localStorage.removeItem(storageKey); setGoal(null); setEditing(false) }

  const pct      = goal && goal > 0 ? Math.min((numericValue / goal) * 100, 100) : null
  const overGoal = goal ? numericValue >= goal : false
  const barColor = overGoal ? '#22c55e' : pct && pct >= 70 ? '#f59e0b' : '#7c3aed'

  return (
    <div className={`relative bg-[#1a1a1a] border rounded-xl p-5 overflow-hidden transition-all group hover:border-[#3a3a3a] ${
      accent ? 'border-[#7c3aed]/30' : highlight ? 'border-[#ef4444]/20' : 'border-[#2a2a2a]'
    }`}>
      {accent && <div className="absolute inset-0 bg-gradient-to-br from-[#7c3aed]/5 to-transparent pointer-events-none" />}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => { setEditing(true); setInput(goal ? String(goal) : '') }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-[#a78bfa] p-1 rounded" title="Definir meta">
            <Pencil size={11} />
          </button>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            highlight ? 'bg-[#ef4444]/10' : accent ? 'bg-[#7c3aed]/10' : 'bg-[#2a2a2a]'
          }`}>
            <Icon size={13} className={highlight ? 'text-[#ef4444]' : accent ? 'text-[#a78bfa]' : 'text-muted-foreground'} strokeWidth={1.5} />
          </div>
        </div>
      </div>
      <p className={`text-2xl font-semibold tracking-tight ${highlight ? 'text-[#ef4444]' : 'text-foreground'} ${hide ? 'blur-sm select-none' : ''}`}>{value}</p>
      {goal ? (
        <div className="mt-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className={`text-xs ${overGoal ? 'text-[#22c55e]' : 'text-muted-foreground'} ${hide ? 'blur-sm select-none' : ''}`}>
              {overGoal ? '✓ meta atingida' : `${Math.round(pct ?? 0)}% de ${isCurrency ? formatBRL(goal) : goal}`}
            </p>
            <button onClick={clearGoal} className="text-[9px] text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">limpar</button>
          </div>
          <div className="h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
          </div>
        </div>
      ) : sub && <p className={`text-xs text-muted-foreground mt-1 ${hide ? 'blur-sm select-none' : ''}`}>{sub}</p>}
      {editing && (
        <div className="absolute inset-0 bg-[#1a1a1a] rounded-xl p-4 flex flex-col justify-center z-10" onClick={e => e.stopPropagation()}>
          <p className="text-xs text-muted-foreground mb-2">Meta para <strong className="text-foreground">{label}</strong></p>
          <input autoFocus type="number" placeholder={isCurrency ? 'Ex: 30000' : 'Ex: 10'} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setEditing(false) }}
            className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] mb-2 placeholder:text-muted-foreground" />
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex-1 text-xs border border-[#2a2a2a] py-1.5 rounded-lg hover:bg-[#222] transition-colors">Cancelar</button>
            <button onClick={saveGoal} className="flex-1 text-xs bg-[#7c3aed] hover:bg-[#6d28d9] text-white py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1">
              <Check size={11} /> Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dashboard do Gustavo ───────────────────────────────────────────────────────
function GustavoDashboard() {
  const [data, setData]         = useState<DashboardData | null>(null)
  const [tasks, setTasks]       = useState<Task[]>([])
  const [alerts, setAlerts]     = useState<AlertData>({ overdue: [], upcoming: [], renewals: [] })
  const [leads, setLeads]       = useState<Lead[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [hideNums, setHideNums] = useState(false)

  useEffect(() => {
    setHideNums(localStorage.getItem('aura_hideNums') === '1')
  }, [])

  function toggleHide() {
    const next = !hideNums
    setHideNums(next)
    localStorage.setItem('aura_hideNums', next ? '1' : '0')
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()).catch(() => null),
      fetch('/api/tasks').then(r => r.json()).catch(() => []),
      fetch('/api/alerts').then(r => r.json()).catch(() => ({ overdue: [], upcoming: [], renewals: [] })),
      fetch('/api/leads').then(r => r.json()).catch(() => []),
    ]).then(([d, t, a, l]) => {
      setData(d)
      setTasks(Array.isArray(t) ? t.filter((task: Task) => task.status !== 'concluido').slice(0, 5) : [])
      setAlerts(a)
      setLeads(Array.isArray(l) ? l : [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" /></div>
  if (!data) return null

  const hasChartData  = data.chartData.some(d => d.value > 0)
  const pctReceived   = data.estimatedMonth > 0 ? Math.round((data.receivedMonth / data.estimatedMonth) * 100) : 0
  const totalAlerts   = alerts.overdue.length + alerts.upcoming.length + alerts.renewals.length
  const activeLeads   = leads.filter(l => l.stage !== 'perdido' && l.stage !== 'fechado')
  const hotLeads      = leads.filter(l => l.stage === 'negociacao' || l.stage === 'proposta')
  const pipelineTotal = activeLeads.reduce((s, l) => s + (l.estimated_value ?? 0), 0)
  const hotTotal      = hotLeads.reduce((s, l) => s + (l.estimated_value ?? 0), 0)

  return (
    <div className="space-y-8">
      {totalAlerts > 0 && !dismissed && (
        <div className="bg-[#1a1a1a] border border-[#f59e0b]/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-[#f59e0b]" />
              <span className="text-sm font-medium text-[#f59e0b]">{totalAlerts} {totalAlerts === 1 ? 'alerta' : 'alertas'} de atenção</span>
            </div>
            <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground transition-colors"><X size={14} /></button>
          </div>
          <div className="space-y-1.5">
            {alerts.overdue.map(c => (
              <div key={c.id} className="flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0" />
                  <span className="text-[#ef4444] font-medium shrink-0">Atrasado</span>
                  <span className="text-muted-foreground truncate">{c.clients?.name} · {c.description}</span>
                </div>
                <span className={`text-[#ef4444] shrink-0 font-medium ${hideNums ? 'blur-sm select-none' : ''}`}>{formatBRL(c.amount)}</span>
              </div>
            ))}
            {alerts.upcoming.map(c => (
              <div key={c.id} className="flex items-center justify-between text-xs gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] shrink-0" />
                  <span className="text-[#f59e0b] font-medium shrink-0">Vence em breve</span>
                  <span className="text-muted-foreground truncate">{c.clients?.name} · {c.description} · {formatDate(c.due_date)}</span>
                </div>
                <span className={`text-foreground shrink-0 font-medium ${hideNums ? 'blur-sm select-none' : ''}`}>{formatBRL(c.amount)}</span>
              </div>
            ))}
            {alerts.renewals.map(s => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <Clock size={11} className="text-[#a78bfa] shrink-0" />
                <span className="text-[#a78bfa] font-medium shrink-0">Renovação</span>
                <span className="text-muted-foreground truncate">{s.clients?.name} · {s.name} · até {formatDate(s.contract_end)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Olá, Gustavo 👋</h1>
          <p className="text-sm text-muted-foreground mt-1">Sua visão comercial — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <button
          onClick={toggleHide}
          title={hideNums ? 'Mostrar valores' : 'Ocultar valores'}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] transition-colors"
        >
          {hideNums ? <EyeOff size={15} strokeWidth={1.5} /> : <Eye size={15} strokeWidth={1.5} />}
          <span className="text-xs hidden sm:inline">{hideNums ? 'Mostrar' : 'Ocultar'}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Clientes ativos" value={String(data.activeClients)} numericValue={data.activeClients} sub="na carteira" icon={Users} goalKey="activeClients" hide={hideNums} />
        <KpiCard label="MRR" value={formatBRL(data.mrr)} numericValue={data.mrr} sub="receita recorrente" icon={TrendingUp} accent goalKey="mrr" isCurrency hide={hideNums} />
        <KpiCard label="Ticket médio" value={data.activeClients > 0 ? formatBRL(data.mrr / data.activeClients) : '—'} numericValue={data.activeClients > 0 ? data.mrr / data.activeClients : 0} sub="por cliente ativo" icon={TrendingUp} goalKey="ticketMedio" isCurrency hide={hideNums} />
        <KpiCard label="Receita do mês" value={formatBRL(data.receivedMonth)} numericValue={data.receivedMonth} sub={`${pctReceived}% de ${formatBRL(data.estimatedMonth)}`} icon={DollarSign} goalKey="receivedMonth" isCurrency hide={hideNums} />
        <KpiCard label="Churn de clientes" value={String(data.clientChurn)} numericValue={data.clientChurn} sub={data.clientChurn === 0 ? 'nenhum cancelamento este mês' : `cancelamento${data.clientChurn !== 1 ? 's' : ''} este mês`} icon={Users} highlight={data.clientChurn > 0} goalKey="clientChurn" hide={hideNums} />
        <KpiCard label="Churn de MRR" value={data.mrrChurn > 0 ? formatBRL(data.mrrChurn) : 'R$ 0'} numericValue={data.mrrChurn} sub={data.mrrChurn === 0 ? 'sem perda de receita' : 'receita perdida este mês'} icon={DollarSign} highlight={data.mrrChurn > 0} goalKey="mrrChurn" isCurrency hide={hideNums} />
        <KpiCard label="Inadimplentes" value={String(data.overdueCount)} numericValue={data.overdueCount} sub="cobranças em atraso" icon={AlertCircle} highlight={data.overdueCount > 0} goalKey="overdue" hide={hideNums} />
        <KpiCard label="Pipeline ativo" value={formatBRL(pipelineTotal)} numericValue={pipelineTotal} sub={`${activeLeads.length} lead${activeLeads.length !== 1 ? 's' : ''} em aberto`} icon={Kanban} accent={pipelineTotal > 0} goalKey="pipeline" isCurrency hide={hideNums} />
      </div>

      {pipelineTotal > 0 && (
        <div className="bg-[#1a1a1a] border border-[#7c3aed]/20 rounded-xl p-5 hover:border-[#7c3aed]/40 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Kanban size={14} className="text-[#a78bfa]" /><h2 className="text-sm font-medium">Receita potencial</h2></div>
            <Link href="/pipeline" className="text-xs text-[#7c3aed] hover:text-[#a78bfa] transition-colors flex items-center gap-1">Ver pipeline <ArrowUpRight size={10} /></Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3"><p className="text-[10px] text-muted-foreground mb-1">MRR atual</p><p className={`text-lg font-semibold ${hideNums ? 'blur-sm select-none' : ''}`}>{formatBRL(data.mrr)}</p></div>
            <div className="bg-[#111111] border border-[#f97316]/30 rounded-lg p-3"><p className="text-[10px] text-muted-foreground mb-1">Quase fechando</p><p className={`text-lg font-semibold text-[#f97316] ${hideNums ? 'blur-sm select-none' : ''}`}>{formatBRL(hotTotal)}</p><p className={`text-[9px] text-muted-foreground ${hideNums ? 'blur-sm select-none' : ''}`}>{hotLeads.length} lead{hotLeads.length !== 1 ? 's' : ''}</p></div>
            <div className="bg-[#111111] border border-[#7c3aed]/30 rounded-lg p-3 relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-br from-[#7c3aed]/10 to-transparent pointer-events-none" /><p className="text-[10px] text-muted-foreground mb-1">Se tudo fechar</p><p className={`text-lg font-semibold text-[#a78bfa] ${hideNums ? 'blur-sm select-none' : ''}`}>{formatBRL(data.mrr + pipelineTotal)}</p><p className={`text-[9px] text-[#7c3aed] ${hideNums ? 'blur-sm select-none' : ''}`}>+{formatBRL(pipelineTotal)}</p></div>
          </div>
          <div className="space-y-2">
            {Object.entries(STAGE_META).map(([key, meta]) => {
              const sl = activeLeads.filter(l => l.stage === key)
              const sv = sl.reduce((s, l) => s + (l.estimated_value ?? 0), 0)
              if (sl.length === 0) return null
              const pct = pipelineTotal > 0 ? (sv / pipelineTotal) * 100 : 0
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-[100px] shrink-0"><span className="text-[10px] text-muted-foreground">{meta.label}</span></div>
                  <div className="flex-1 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden"><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: meta.color }} /></div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-medium w-[70px] text-right ${hideNums ? 'blur-sm select-none' : ''}`} style={{ color: meta.color }}>{formatBRL(sv)}</span>
                    <span className={`text-[9px] text-muted-foreground w-[50px] ${hideNums ? 'blur-sm select-none' : ''}`}>{sl.length} lead{sl.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 hover:border-[#3a3a3a] transition-colors">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-medium">Receita — últimos 6 meses</h2>
            {hasChartData && <span className={`text-xs text-[#a78bfa] bg-[#7c3aed]/10 px-2 py-0.5 rounded-full ${hideNums ? 'blur-sm select-none' : ''}`}>{formatBRL(data.chartData.reduce((s, d) => s + d.value, 0))} total</span>}
          </div>
          {!hasChartData ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Nenhum pagamento registrado ainda</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={data.chartData}>
                <defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7c3aed" stopOpacity={0.2} /><stop offset="95%" stopColor="#7c3aed" stopOpacity={0} /></linearGradient></defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }} formatter={(v) => [formatBRL(Number(v)), 'Receita']} />
                <Area type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2} fill="url(#pg)" dot={{ fill: '#7c3aed', r: 3, strokeWidth: 0 }} activeDot={{ r: 5, fill: '#a78bfa' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 hover:border-[#3a3a3a] transition-colors">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium">Vencendo em 7 dias</h2>
            {data.upcoming.length > 0 && <Link href="/financeiro" className="text-xs text-[#7c3aed] hover:text-[#a78bfa] transition-colors flex items-center gap-1">Ver todos <ArrowUpRight size={10} /></Link>}
          </div>
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma cobrança próxima</p>
          ) : (
            <div className="space-y-3">
              {data.upcoming.map(c => (
                <div key={c.id} className="flex items-start justify-between gap-2 py-2 border-b border-[#2a2a2a] last:border-0 last:pb-0">
                  <div className="min-w-0"><p className="text-sm font-medium truncate">{c.clients?.name ?? '—'}</p><p className="text-xs text-muted-foreground truncate">{c.description}</p><p className="text-xs text-muted-foreground">{formatDate(c.due_date)}</p></div>
                  <span className={`text-sm font-semibold whitespace-nowrap ${hideNums ? 'blur-sm select-none' : ''}`}>{formatBRL(c.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {tasks.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><CheckSquare size={14} className="text-[#a78bfa]" /><h2 className="text-sm font-medium">Tarefas abertas</h2><span className="text-[11px] bg-[#7c3aed]/10 text-[#a78bfa] px-1.5 py-0.5 rounded-full">{tasks.length}</span></div>
            <Link href="/tarefas" className="text-xs text-[#7c3aed] hover:text-[#a78bfa] transition-colors flex items-center gap-1">Ver todas <ArrowUpRight size={10} /></Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {tasks.map(task => {
              const today = new Date().toISOString().split('T')[0]
              const isOverdue = task.due_date && task.due_date < today
              const pColor = task.priority === 'alta' ? 'bg-[#ef4444]/10 text-[#ef4444]' : task.priority === 'media' ? 'bg-[#f59e0b]/10 text-[#f59e0b]' : 'bg-[#2a2a2a] text-muted-foreground'
              return (
                <div key={task.id} className="flex items-start gap-3 bg-[#111111] border border-[#2a2a2a] rounded-lg px-4 py-3">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${task.status === 'em_andamento' ? 'bg-[#f59e0b]' : 'bg-[#3a3a3a]'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {task.clients && <span className="text-[10px] text-[#a78bfa]">{task.clients.name}</span>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${pColor}`}>{task.priority}</span>
                      {task.due_date && <span className={`text-[10px] ${isOverdue ? 'text-[#ef4444]' : 'text-muted-foreground'}`}>{formatDate(task.due_date)}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dashboard do Gabriel ───────────────────────────────────────────────────────
function GabrielDashboard() {
  const [posts, setPosts]       = useState<ContentPost[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients]   = useState<Client[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/content').then(r => r.json()).catch(() => []),
      fetch('/api/projects').then(r => r.json()).catch(() => []),
      fetch('/api/clients').then(r => r.json()).catch(() => []),
    ]).then(([p, pr, cl]) => {
      setPosts(Array.isArray(p) ? p : [])
      setProjects(Array.isArray(pr) ? pr : [])
      setClients(Array.isArray(cl) ? cl : [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-5 h-5 border-2 border-[#34d399] border-t-transparent rounded-full animate-spin" /></div>

  const today = new Date().toISOString().split('T')[0]
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  const thisWeek   = posts.filter(p => p.scheduled_date && p.scheduled_date >= today && p.scheduled_date <= weekEnd)
  const awaiting   = posts.filter(p => p.status === 'aguardando_aprovacao')
  const published  = posts.filter(p => p.status === 'publicado')
  const inApproval = projects.filter(p => p.status === 'aprovacao')

  const next14 = posts
    .filter(p => p.scheduled_date && p.scheduled_date >= today)
    .sort((a, b) => (a.scheduled_date ?? '').localeCompare(b.scheduled_date ?? ''))
    .slice(0, 10)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Olá, Gabriel 🎨</h1>
          <p className="text-sm text-muted-foreground mt-1">Central criativa — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <Link href="/conteudo" className="text-xs text-[#34d399] hover:opacity-80 flex items-center gap-1 transition-opacity">
          Central de conteúdo <ArrowUpRight size={12} />
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Posts esta semana',     value: String(thisWeek.length),  color: '#34d399', icon: CalendarDays },
          { label: 'Aguardando aprovação',  value: String(awaiting.length),  color: '#f59e0b', icon: Bell },
          { label: 'Publicados este mês',   value: String(published.length), color: '#22c55e', icon: CheckSquare },
          { label: 'Projetos em aprovação', value: String(inApproval.length),color: '#a78bfa', icon: Layers },
        ].map(k => (
          <div key={k.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{k.label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#2a2a2a]">
                <k.icon size={13} className="text-muted-foreground" strokeWidth={1.5} />
              </div>
            </div>
            <p className="text-2xl font-semibold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aguardando aprovação */}
        <div className="bg-[#1a1a1a] border border-[#f59e0b]/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-[#f59e0b]" />
              <h2 className="text-sm font-medium">Aguardando aprovação</h2>
              {awaiting.length > 0 && <span className="text-[10px] bg-[#f59e0b]/10 text-[#f59e0b] px-1.5 py-0.5 rounded-full">{awaiting.length}</span>}
            </div>
            <Link href="/conteudo" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">Ver todos <ArrowUpRight size={10} /></Link>
          </div>
          {awaiting.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum post aguardando</p>
          ) : (
            <div className="space-y-2">
              {awaiting.slice(0, 6).map(post => {
                const color = PLATFORM_COLOR[post.platform] ?? '#6b7280'
                return (
                  <div key={post.id} className="flex items-center gap-3 bg-[#111111] border border-[#2a2a2a] rounded-lg p-3 hover:border-[#3a3a3a] transition-colors">
                    {post.media_url ? (
                      <img src={post.media_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                    ) : (
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: color + '22' }}>
                        <ImageIcon size={16} style={{ color }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{post.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-medium" style={{ color }}>{PLATFORM_LABEL[post.platform] ?? post.platform}</span>
                        {post.clients && <span className="text-[10px] text-muted-foreground">{post.clients.name}</span>}
                      </div>
                    </div>
                    {post.scheduled_date && (
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(post.scheduled_date)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Agenda próximos 14 dias */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={13} className="text-[#34d399]" />
              <h2 className="text-sm font-medium">Próximos posts agendados</h2>
            </div>
            <Link href="/conteudo" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">Calendário <ArrowUpRight size={10} /></Link>
          </div>
          {next14.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum post agendado</p>
          ) : (
            <div className="space-y-2">
              {next14.map(post => {
                const color = PLATFORM_COLOR[post.platform] ?? '#6b7280'
                return (
                  <div key={post.id} className="flex items-center gap-3 py-2 border-b border-[#1f1f1f] last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{post.title}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px]" style={{ color }}>{PLATFORM_LABEL[post.platform] ?? post.platform}</span>
                        {post.clients && <span className="text-[10px] text-muted-foreground">{post.clients.name}</span>}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{post.scheduled_date ? formatDate(post.scheduled_date) : '—'}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Projetos em aprovação */}
      {inApproval.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#a78bfa]/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><Layers size={13} className="text-[#a78bfa]" /><h2 className="text-sm font-medium">Projetos aguardando aprovação</h2><span className="text-[10px] bg-[#7c3aed]/10 text-[#a78bfa] px-1.5 py-0.5 rounded-full">{inApproval.length}</span></div>
            <Link href="/projetos" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">Ver todos <ArrowUpRight size={10} /></Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {inApproval.map(proj => {
              const done  = proj.checklist.filter(i => i.done).length
              const total = proj.checklist.length
              return (
                <div key={proj.id} className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-4">
                  <p className="text-sm font-medium truncate mb-1">{proj.title}</p>
                  {proj.clients && <p className="text-[10px] text-muted-foreground mb-2">{proj.clients.name}</p>}
                  {total > 0 && <div className="h-1 bg-[#2a2a2a] rounded-full overflow-hidden"><div className="h-full bg-[#a78bfa] rounded-full" style={{ width: `${Math.round((done/total)*100)}%` }} /></div>}
                  {proj.deadline && <p className="text-[10px] text-muted-foreground mt-1.5">Prazo: {formatDate(proj.deadline)}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Engajamento por cliente */}
      <EngajamentoClientes posts={posts} clients={clients} />
    </div>
  )
}

// ── Engajamento por cliente (usado no GabrielDashboard) ───────────────────────
function EngajamentoClientes({ posts, clients }: { posts: ContentPost[]; clients: Client[] }) {
  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth()
  const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  // últimos 6 meses para o gráfico de barras comparativo
  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - (5 - i), 1)
    return { year: d.getFullYear(), month: d.getMonth(), label: MONTH_NAMES[d.getMonth()].slice(0, 3) }
  })

  function calcClient(clientId: string, y: number, m: number) {
    const filtered = posts.filter(p => {
      if (p.client_id !== clientId || p.status !== 'publicado') return false
      const d = p.published_at ? p.published_at.split('T')[0] : p.scheduled_date
      if (!d) return false
      const [py, pm] = d.split('-').map(Number)
      return py === y && pm - 1 === m
    })
    const curtidas    = filtered.reduce((s, p) => s + (p.result?.curtidas    ?? 0), 0)
    const comentarios = filtered.reduce((s, p) => s + (p.result?.comentarios ?? 0), 0)
    const salvamentos = filtered.reduce((s, p) => s + (p.result?.salvamentos ?? 0), 0)
    const alcance     = filtered.reduce((s, p) => s + (p.result?.alcance     ?? 0), 0)
    const rate        = alcance > 0 ? parseFloat(((curtidas + comentarios + salvamentos) / alcance * 100).toFixed(2)) : 0
    return { total: filtered.length, curtidas, comentarios, salvamentos, alcance, rate }
  }

  const activeClients = clients.filter(c => c.status === 'ativo' || c.status === 'trial')
  const clientMetrics = activeClients.map(c => ({
    ...c,
    cur: calcClient(c.id, year, month),
  })).filter(c => c.cur.total > 0 || posts.some(p => p.client_id === c.id && p.status === 'publicado'))
    .sort((a, b) => b.cur.rate - a.cur.rate)

  const maxRate = Math.max(...clientMetrics.map(c => c.cur.rate), 0.01)

  // gráfico comparativo: taxa média de engajamento de todos os clientes por mês
  const chartData = last6.map(m => {
    const rates = activeClients
      .map(c => calcClient(c.id, m.year, m.month).rate)
      .filter(r => r > 0)
    const avg = rates.length > 0 ? parseFloat((rates.reduce((s, r) => s + r, 0) / rates.length).toFixed(2)) : 0
    return { name: m.label, taxa: avg }
  })

  const hasAnyData = clientMetrics.length > 0

  return (
    <div className="bg-[#1a1a1a] border border-[#34d399]/20 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <TrendingUp size={13} className="text-[#34d399]" />
          <h2 className="text-sm font-medium">Engajamento por cliente — {MONTH_NAMES[month]}</h2>
        </div>
        <Link href="/conteudo" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          Ver métricas <ArrowUpRight size={10} />
        </Link>
      </div>

      {!hasAnyData ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Publique posts com resultados para ver o engajamento aqui
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cards por cliente */}
          <div className="space-y-3">
            {clientMetrics.map((c, idx) => {
              const barPct = maxRate > 0 ? (c.cur.rate / maxRate) * 100 : 0
              const medal  = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
              return (
                <div key={c.id} className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-4 hover:border-[#3a3a3a] transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {medal && <span className="text-sm shrink-0">{medal}</span>}
                      <p className="text-sm font-medium truncate">{c.name}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="text-[10px] text-muted-foreground">{c.cur.total} post{c.cur.total !== 1 ? 's' : ''}</span>
                      <span className="text-base font-bold text-[#34d399]">
                        {c.cur.rate > 0 ? c.cur.rate.toFixed(2) + '%' : '—'}
                      </span>
                    </div>
                  </div>
                  {/* mini barra */}
                  <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${barPct}%`,
                        background: idx === 0 ? '#34d399' : idx === 1 ? '#60a5fa' : '#a78bfa',
                      }}
                    />
                  </div>
                  {c.cur.alcance > 0 && (
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                      <span>♥ {c.cur.curtidas.toLocaleString('pt-BR')}</span>
                      <span>👁 {c.cur.alcance.toLocaleString('pt-BR')}</span>
                      {c.cur.comentarios > 0 && <span>💬 {c.cur.comentarios.toLocaleString('pt-BR')}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Gráfico tendência média */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Tendência — taxa média todos clientes</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#555' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#555' }} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: unknown) => [Number(v).toFixed(2) + '%', 'Engajamento médio']}
                  labelStyle={{ color: '#888' }}
                />
                <Bar dataKey="taxa" fill="#34d399" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dashboard do Thomas ────────────────────────────────────────────────────────
function ThomasDashboard() {
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients]   = useState<Client[]>([])
  const [tasks, setTasks]       = useState<Task[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/projects').then(r => r.json()).catch(() => []),
      fetch('/api/clients').then(r => r.json()).catch(() => []),
      fetch('/api/tasks').then(r => r.json()).catch(() => []),
    ]).then(([pr, cl, t]) => {
      setProjects(Array.isArray(pr) ? pr : [])
      setClients(Array.isArray(cl) ? cl : [])
      setTasks(Array.isArray(t) ? t.filter((task: Task) => task.status !== 'concluido') : [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-5 h-5 border-2 border-[#60a5fa] border-t-transparent rounded-full animate-spin" /></div>

  const today   = new Date().toISOString().split('T')[0]
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  const active   = projects.filter(p => p.status !== 'arquivo')
  const overdue  = active.filter(p => p.deadline && p.deadline < today && p.status !== 'concluido')
  const thisWeek = active.filter(p => p.deadline && p.deadline >= today && p.deadline <= weekEnd && p.status !== 'concluido')

  const clientStatus = {
    ativo:    clients.filter(c => c.status === 'ativo').length,
    trial:    clients.filter(c => c.status === 'trial').length,
    pausado:  clients.filter(c => c.status === 'pausado').length,
    inativo:  clients.filter(c => c.status === 'inativo').length,
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Olá, Thomas ⚙️</h1>
          <p className="text-sm text-muted-foreground mt-1">Painel de operações — {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Projetos atrasados',    value: String(overdue.length),          color: overdue.length > 0 ? '#ef4444' : '#22c55e' },
          { label: 'Vencendo esta semana',  value: String(thisWeek.length),         color: thisWeek.length > 0 ? '#f59e0b' : '#22c55e' },
          { label: 'Clientes ativos',       value: String(clientStatus.ativo),      color: '#60a5fa' },
          { label: 'Tarefas abertas',       value: String(tasks.length),            color: '#a78bfa' },
        ].map(k => (
          <div key={k.label} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">{k.label}</p>
            <p className="text-2xl font-semibold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projetos atrasados */}
        <div className={`bg-[#1a1a1a] border rounded-xl p-5 ${overdue.length > 0 ? 'border-[#ef4444]/20' : 'border-[#2a2a2a]'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className={overdue.length > 0 ? 'text-[#ef4444]' : 'text-muted-foreground'} />
              <h2 className="text-sm font-medium">Projetos atrasados</h2>
              {overdue.length > 0 && <span className="text-[10px] bg-[#ef4444]/10 text-[#ef4444] px-1.5 py-0.5 rounded-full">{overdue.length}</span>}
            </div>
            <Link href="/projetos" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">Ver todos <ArrowUpRight size={10} /></Link>
          </div>
          {overdue.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum projeto atrasado 🎉</p>
          ) : (
            <div className="space-y-2">
              {overdue.map(proj => {
                const days = Math.abs(Math.ceil((new Date(proj.deadline!).getTime() - Date.now()) / 86400000))
                return (
                  <div key={proj.id} className="flex items-center gap-3 bg-[#111111] border border-[#2a2a2a] rounded-lg px-4 py-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{proj.title}</p>
                      {proj.clients && <p className="text-[10px] text-muted-foreground">{proj.clients.name}</p>}
                    </div>
                    <span className="text-[10px] text-[#ef4444] shrink-0">{days}d atraso</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Vencendo esta semana */}
        <div className={`bg-[#1a1a1a] border rounded-xl p-5 ${thisWeek.length > 0 ? 'border-[#f59e0b]/20' : 'border-[#2a2a2a]'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock size={13} className={thisWeek.length > 0 ? 'text-[#f59e0b]' : 'text-muted-foreground'} />
              <h2 className="text-sm font-medium">Prazos esta semana</h2>
              {thisWeek.length > 0 && <span className="text-[10px] bg-[#f59e0b]/10 text-[#f59e0b] px-1.5 py-0.5 rounded-full">{thisWeek.length}</span>}
            </div>
          </div>
          {thisWeek.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum prazo esta semana</p>
          ) : (
            <div className="space-y-2">
              {thisWeek.sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? '')).map(proj => {
                const daysLeft = Math.ceil((new Date(proj.deadline!).getTime() - Date.now()) / 86400000)
                return (
                  <div key={proj.id} className="flex items-center gap-3 bg-[#111111] border border-[#2a2a2a] rounded-lg px-4 py-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{proj.title}</p>
                      {proj.clients && <p className="text-[10px] text-muted-foreground">{proj.clients.name}</p>}
                    </div>
                    <span className="text-[10px] text-[#f59e0b] shrink-0">
                      {daysLeft === 0 ? 'hoje' : `${daysLeft}d`}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Status de clientes */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Users size={13} className="text-[#60a5fa]" /><h2 className="text-sm font-medium">Carteira de clientes</h2></div>
          <Link href="/clientes" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">Ver todos <ArrowUpRight size={10} /></Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Ativos',   value: clientStatus.ativo,   color: '#22c55e' },
            { label: 'Trial',    value: clientStatus.trial,   color: '#f59e0b' },
            { label: 'Pausados', value: clientStatus.pausado, color: '#6b7280' },
            { label: 'Inativos', value: clientStatus.inativo, color: '#ef4444' },
          ].map(s => (
            <div key={s.label} className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3 text-center">
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tarefas */}
      {tasks.length > 0 && (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><CheckSquare size={14} className="text-[#a78bfa]" /><h2 className="text-sm font-medium">Tarefas abertas</h2><span className="text-[11px] bg-[#7c3aed]/10 text-[#a78bfa] px-1.5 py-0.5 rounded-full">{tasks.length}</span></div>
            <Link href="/tarefas" className="text-xs text-[#7c3aed] hover:text-[#a78bfa] transition-colors flex items-center gap-1">Ver todas <ArrowUpRight size={10} /></Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {tasks.slice(0, 6).map(task => {
              const isOverdue = task.due_date && task.due_date < today
              const pColor = task.priority === 'alta' ? 'bg-[#ef4444]/10 text-[#ef4444]' : task.priority === 'media' ? 'bg-[#f59e0b]/10 text-[#f59e0b]' : 'bg-[#2a2a2a] text-muted-foreground'
              return (
                <div key={task.id} className="flex items-start gap-3 bg-[#111111] border border-[#2a2a2a] rounded-lg px-4 py-3">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${task.status === 'em_andamento' ? 'bg-[#f59e0b]' : 'bg-[#3a3a3a]'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {task.clients && <span className="text-[10px] text-[#a78bfa]">{task.clients.name}</span>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${pColor}`}>{task.priority}</span>
                      {task.due_date && <span className={`text-[10px] ${isOverdue ? 'text-[#ef4444]' : 'text-muted-foreground'}`}>{formatDate(task.due_date)}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página principal — detecta role e renderiza o dashboard certo ───────────────
export default function DashboardPage() {
  const [role, setRole]     = useState<Role | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setRole(getRole(user?.email))
    })
  }, [])

  if (role === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (role === 'gabriel') return <GabrielDashboard />
  if (role === 'thomas')  return <ThomasDashboard />
  return <GustavoDashboard />
}
