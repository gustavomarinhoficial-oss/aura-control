'use client'

import { useEffect, useState, useCallback } from 'react'
import { Sparkles, ChevronLeft, ChevronRight, Users, FileBarChart } from 'lucide-react'
import { formatBRL, formatDate } from '@/lib/utils/format'

interface Client { id: string; name: string }

interface Metrics {
  tarefas_no_periodo: number
  tarefas_concluidas: number
  tarefas_atrasadas: number
  conteudos_no_periodo: number
  conteudos_publicados: number
  conteudos_atrasados: number
  cobrancas_no_periodo: number
  cobrancas_pagas: number
  valor_cobrado: number
  valor_recebido: number
}

interface ClientAttention { cliente: string; tarefas_atrasadas: number; conteudos_atrasados: number }

interface CompanyData {
  mrr: number
  semana_atual: Metrics
  semana_anterior: Metrics
  novos_leads_semana: number
  total_clientes_ativos: number
  clientes_precisam_atencao: ClientAttention[]
}

interface Report {
  id: string
  week_start: string
  week_end: string
  client_id: string | null
  summary: string
  data: CompanyData | { atual: Metrics; anterior: Metrics }
}

function StatDelta({ label, atual, anterior }: { label: string; atual: number; anterior: number }) {
  const diff = atual - anterior
  return (
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3">
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <p className="text-lg font-semibold">{atual}</p>
        {anterior > 0 || atual > 0 ? (
          <span className={`text-[10px] ${diff > 0 ? 'text-[#22c55e]' : diff < 0 ? 'text-[#ef4444]' : 'text-muted-foreground'}`}>
            {diff > 0 ? '+' : ''}{diff} vs sem. anterior
          </span>
        ) : null}
      </div>
    </div>
  )
}

export default function RelatoriosPage() {
  const [companyReports, setCompanyReports] = useState<Report[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [weekIndex, setWeekIndex] = useState(0)
  const [scope, setScope] = useState<'geral' | string>('geral')
  const [clientReport, setClientReport] = useState<Report | null>(null)
  const [loadingClient, setLoadingClient] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/weekly-reports').then(r => r.json()).catch(() => []),
      fetch('/api/clients').then(r => r.json()).catch(() => []),
    ]).then(([reports, cl]) => {
      setCompanyReports(Array.isArray(reports) ? reports : [])
      setClients(Array.isArray(cl) ? cl.map((c: Client) => ({ id: c.id, name: c.name })) : [])
      setLoading(false)
    })
  }, [])

  const currentWeek = companyReports[weekIndex]

  const loadClientReport = useCallback((clientId: string, weekStart: string) => {
    setLoadingClient(true)
    fetch(`/api/weekly-reports?client_id=${clientId}&week_start=${weekStart}`)
      .then(r => r.json())
      .then(d => setClientReport(Array.isArray(d) && d.length > 0 ? d[0] : null))
      .finally(() => setLoadingClient(false))
  }, [])

  useEffect(() => {
    if (scope !== 'geral' && currentWeek) {
      loadClientReport(scope, currentWeek.week_start)
    } else {
      setClientReport(null)
    }
  }, [scope, currentWeek, loadClientReport])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (companyReports.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">Análise semanal gerada pelo Omar</p>
        </div>
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
          <FileBarChart size={28} className="text-muted-foreground" strokeWidth={1} />
          <div>
            <p className="text-sm font-medium">Nenhum relatório ainda</p>
            <p className="text-xs text-muted-foreground mt-0.5">O primeiro é gerado toda sexta-feira às 17h</p>
          </div>
        </div>
      </div>
    )
  }

  const activeReport = scope === 'geral' ? currentWeek : clientReport
  const isCompany = scope === 'geral'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Relatórios</h1>
          <p className="text-sm text-muted-foreground mt-1">Análise semanal gerada pelo Omar</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekIndex(i => Math.min(i + 1, companyReports.length - 1))}
            disabled={weekIndex >= companyReports.length - 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#2a2a2a] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-muted-foreground min-w-[140px] text-center">
            {currentWeek && `${formatDate(currentWeek.week_start)} – ${formatDate(currentWeek.week_end)}`}
          </span>
          <button
            onClick={() => setWeekIndex(i => Math.max(i - 1, 0))}
            disabled={weekIndex <= 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#2a2a2a] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => setScope('geral')}
          className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors shrink-0 ${
            scope === 'geral' ? 'bg-[#7c3aed]/15 text-[#a78bfa] font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a]'
          }`}
        >
          Geral da empresa
        </button>
        {clients.map(c => (
          <button
            key={c.id}
            onClick={() => setScope(c.id)}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors shrink-0 ${
              scope === c.id ? 'bg-[#7c3aed]/15 text-[#a78bfa] font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a]'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {loadingClient ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !activeReport ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2 text-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
          <p className="text-sm text-muted-foreground">Sem relatório desse cliente pra essa semana</p>
        </div>
      ) : (
        <>
          <div className="bg-gradient-to-br from-[#7c3aed]/10 to-transparent border border-[#7c3aed]/25 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={14} className="text-[#a78bfa]" />
              <h2 className="text-sm font-medium text-[#a78bfa]">Análise do Omar</h2>
            </div>
            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{activeReport.summary}</p>
          </div>

          {isCompany && 'clientes_precisam_atencao' in activeReport.data && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatDelta label="Tarefas concluídas" atual={(activeReport.data as CompanyData).semana_atual.tarefas_concluidas} anterior={(activeReport.data as CompanyData).semana_anterior.tarefas_concluidas} />
                <StatDelta label="Tarefas atrasadas" atual={(activeReport.data as CompanyData).semana_atual.tarefas_atrasadas} anterior={(activeReport.data as CompanyData).semana_anterior.tarefas_atrasadas} />
                <StatDelta label="Conteúdo publicado" atual={(activeReport.data as CompanyData).semana_atual.conteudos_publicados} anterior={(activeReport.data as CompanyData).semana_anterior.conteudos_publicados} />
                <StatDelta label="Novos leads" atual={(activeReport.data as CompanyData).novos_leads_semana} anterior={0} />
              </div>

              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">MRR atual</p>
                <p className="text-xl font-semibold">{formatBRL((activeReport.data as CompanyData).mrr)}</p>
              </div>

              {(activeReport.data as CompanyData).clientes_precisam_atencao.length > 0 && (
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={13} className="text-[#f59e0b]" />
                    <h3 className="text-sm font-medium">Clientes que precisam de atenção</h3>
                  </div>
                  <div className="space-y-2">
                    {(activeReport.data as CompanyData).clientes_precisam_atencao.map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2">
                        <span className="font-medium">{c.cliente}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.tarefas_atrasadas > 0 && `${c.tarefas_atrasadas} tarefa${c.tarefas_atrasadas !== 1 ? 's' : ''} atrasada${c.tarefas_atrasadas !== 1 ? 's' : ''}`}
                          {c.tarefas_atrasadas > 0 && c.conteudos_atrasados > 0 && ' · '}
                          {c.conteudos_atrasados > 0 && `${c.conteudos_atrasados} conteúdo${c.conteudos_atrasados !== 1 ? 's' : ''} atrasado${c.conteudos_atrasados !== 1 ? 's' : ''}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!isCompany && 'atual' in activeReport.data && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatDelta label="Tarefas concluídas" atual={(activeReport.data as { atual: Metrics; anterior: Metrics }).atual.tarefas_concluidas} anterior={(activeReport.data as { atual: Metrics; anterior: Metrics }).anterior.tarefas_concluidas} />
              <StatDelta label="Tarefas atrasadas" atual={(activeReport.data as { atual: Metrics; anterior: Metrics }).atual.tarefas_atrasadas} anterior={(activeReport.data as { atual: Metrics; anterior: Metrics }).anterior.tarefas_atrasadas} />
              <StatDelta label="Conteúdo publicado" atual={(activeReport.data as { atual: Metrics; anterior: Metrics }).atual.conteudos_publicados} anterior={(activeReport.data as { atual: Metrics; anterior: Metrics }).anterior.conteudos_publicados} />
              <StatDelta label="Cobranças pagas" atual={(activeReport.data as { atual: Metrics; anterior: Metrics }).atual.cobrancas_pagas} anterior={(activeReport.data as { atual: Metrics; anterior: Metrics }).anterior.cobrancas_pagas} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
