import Groq from 'groq-sdk'
import { createServiceClient } from '@/lib/supabase/server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = 'openai/gpt-oss-120b'

function fmt(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

// Semana de trabalho: segunda a sexta da semana que contém a data de referência (padrão: agora, em Brasília)
export function getWeekWindow(reference = new Date()): { weekStart: string; weekEnd: string } {
  const brToday = new Date(reference.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  const day = brToday.getDay() // 0 = domingo
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(brToday)
  monday.setDate(brToday.getDate() + diffToMonday)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  return { weekStart: fmt(monday), weekEnd: fmt(friday) }
}

function previousWeek(weekStart: string, weekEnd: string): { weekStart: string; weekEnd: string } {
  const shift = (s: string) => {
    const d = new Date(s + 'T12:00:00')
    d.setDate(d.getDate() - 7)
    return fmt(d)
  }
  return { weekStart: shift(weekStart), weekEnd: shift(weekEnd) }
}

export interface Metrics {
  tarefas_no_periodo: number
  tarefas_concluidas: number
  // tarefas com prazo já vencido e ainda abertas (informativo, não é o foco do relatório)
  tarefas_atrasadas: number
  // tarefas fixas/diárias (sem prazo) em aberto: não contam como atraso
  tarefas_fixas_abertas?: number
  destaques_tarefas?: string[]
  conteudos_no_periodo: number
  conteudos_publicados: number
  conteudos_atrasados: number
  conteudos_publicados_mes?: number
  meta_conteudo_mes?: number
  cobrancas_no_periodo: number
  cobrancas_pagas: number
  valor_cobrado: number
  valor_recebido: number
}

// Chaves com dinheiro: removidas pra quem não tem acesso ao financeiro (Julia, Mari).
const FINANCE_KEYS = ['cobrancas_no_periodo', 'cobrancas_pagas', 'valor_cobrado', 'valor_recebido', 'mrr', 'cobrancas_em_aberto']

export function stripFinance<T>(data: T): T {
  if (Array.isArray(data)) return data.map(stripFinance) as unknown as T
  if (data && typeof data === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (FINANCE_KEYS.includes(k)) continue
      out[k] = stripFinance(v)
    }
    return out as T
  }
  return data
}

function nextDay(d: string): string {
  const x = new Date(d + 'T12:00:00')
  x.setDate(x.getDate() + 1)
  return fmt(x)
}

async function computeMetrics(weekStart: string, weekEnd: string, clientId: string | null): Promise<Metrics> {
  const db = createServiceClient()
  const today = fmt(new Date())
  const monthStart = `${weekEnd.slice(0, 7)}-01`
  const monthEnd = fmt(new Date(Number(weekEnd.slice(0, 4)), Number(weekEnd.slice(5, 7)), 0))

  // Feito na semana: tarefas concluídas dentro da janela (por data de conclusão, não por prazo).
  let doneQuery = db.from('tasks').select('id, title, priority').eq('workspace', 'owl').eq('status', 'concluido')
    .gte('completed_at', `${weekStart}T00:00:00-03:00`).lt('completed_at', `${nextDay(weekEnd)}T00:00:00-03:00`)
  let openQuery = db.from('tasks').select('id, due_date').eq('workspace', 'owl').neq('status', 'concluido')
  let contentQuery = db.from('content_posts').select('id, status, scheduled_date').gte('scheduled_date', weekStart).lte('scheduled_date', weekEnd)
  let monthContentQuery = db.from('content_posts').select('id').eq('status', 'publicado').gte('scheduled_date', monthStart).lte('scheduled_date', monthEnd)
  let chargeQuery = db.from('charges').select('id, amount, paid_at').gte('due_date', weekStart).lte('due_date', weekEnd)
  let quotaQuery = db.from('clients').select('monthly_content_quota').eq('status', 'ativo')

  if (clientId) {
    doneQuery = doneQuery.eq('client_id', clientId)
    openQuery = openQuery.eq('client_id', clientId)
    contentQuery = contentQuery.eq('client_id', clientId)
    monthContentQuery = monthContentQuery.eq('client_id', clientId)
    chargeQuery = chargeQuery.eq('client_id', clientId)
    quotaQuery = quotaQuery.eq('id', clientId)
  }

  const [doneRes, openRes, contentRes, monthContentRes, chargesRes, quotaRes] = await Promise.all([
    doneQuery, openQuery, contentQuery, monthContentQuery, chargeQuery, quotaQuery,
  ])
  const done = doneRes.data ?? []
  const open = openRes.data ?? []
  const content = contentRes.data ?? []
  const charges = chargesRes.data ?? []

  const weight: Record<string, number> = { alta: 0, media: 1, baixa: 2 }
  const destaques = [...done].sort((a, b) => (weight[a.priority] ?? 1) - (weight[b.priority] ?? 1)).slice(0, 8).map(t => t.title)

  return {
    tarefas_no_periodo: done.length,
    tarefas_concluidas: done.length,
    tarefas_atrasadas: open.filter(t => t.due_date && t.due_date < today).length,
    tarefas_fixas_abertas: open.filter(t => !t.due_date).length,
    destaques_tarefas: destaques,
    conteudos_no_periodo: content.length,
    conteudos_publicados: content.filter(c => c.status === 'publicado').length,
    // só conta como atrasado o que já passou da data e não foi publicado
    conteudos_atrasados: content.filter(c => c.status !== 'publicado' && c.scheduled_date <= today).length,
    conteudos_publicados_mes: (monthContentRes.data ?? []).length,
    meta_conteudo_mes: (quotaRes.data ?? []).reduce((sum, c) => sum + Number(c.monthly_content_quota ?? 0), 0),
    cobrancas_no_periodo: charges.length,
    cobrancas_pagas: charges.filter(c => c.paid_at).length,
    valor_cobrado: charges.reduce((s, c) => s + Number(c.amount), 0),
    valor_recebido: charges.filter(c => c.paid_at).reduce((s, c) => s + Number(c.amount), 0),
  }
}

// Cliente que merece olhar: conteúdo travado ou cobrança em aberto. Tarefa atrasada sozinha não entra
// (muita tarefa vence sem importar de verdade).
function needsAttention(m: Metrics): boolean {
  return m.conteudos_atrasados > 0 || (m.cobrancas_no_periodo > 0 && m.cobrancas_pagas < m.cobrancas_no_periodo)
}

// Versão sem nada de dinheiro: é o que a IA do relatório do cliente enxerga.
function withoutMoney(m: Metrics) {
  return stripFinance(m)
}

async function callOmar(systemPrompt: string, data: unknown): Promise<string> {
  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 600,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(data) },
      ],
    })
    return completion.choices[0]?.message?.content?.trim() || 'Sem análise disponível.'
  } catch {
    return 'Não consegui gerar a análise agora — os números continuam disponíveis normalmente.'
  }
}

const CLIENT_SYSTEM_PROMPT = `Você é o Omar, agente de IA interno de uma agência de marketing. Vai receber as métricas da semana de um cliente (e da semana anterior, pra comparação). Escreva um relatório semanal curto e útil pro time, focado no que FOI FEITO e no que importa: tarefas concluídas na semana (use "destaques_tarefas" pra citar entregas reais), quantos conteúdos foram publicados na semana e no mês (compare "conteudos_publicados_mes" com "meta_conteudo_mes" quando houver meta), e o que merece atenção de verdade. Regras: (1) NÃO cobre nem se prenda a tarefas atrasadas: atraso de tarefa é só informativo e só vale citar se for muito grande; (2) tarefas fixas/diárias (sem prazo) nunca são atraso; (3) nunca cite valores em dinheiro, cobranças ou faturamento; (4) se não houver dados no período, diga isso em uma frase, sem inventar. 4 a 6 frases, português do Brasil, sem markdown, tom direto e positivo, como um braço direito falando com o time.`

const COMPANY_SYSTEM_PROMPT = `Você é o Omar, agente de IA interno de uma agência de marketing. Vai receber um resumo da semana da agência inteira e a lista de clientes que precisam de atenção. Escreva o relatório semanal geral pros sócios, focado no que importa pra manter a empresa: o que foi entregue (tarefas concluídas na semana, com destaques de "destaques_tarefas"), quantos conteúdos foram publicados na semana e no mês frente à meta ("conteudos_publicados_mes" e "meta_conteudo_mes"), clientes que merecem atenção e por quê, novos leads, e como estão as finanças em alto nível (MRR e recebimentos). Regras: (1) não se prenda a tarefas atrasadas: cite só se for algo crítico; tarefas fixas/diárias (sem prazo) nunca são atraso; (2) compare com a semana anterior só quando a diferença for relevante; (3) destaque o que sustenta a empresa no próximo mês (renovações, leads quentes, entregas que seguram clientes). 5 a 8 frases, português do Brasil, sem markdown, tom direto e de confiança.`

export interface ClientReportResult {
  id: string
  week_start: string
  week_end: string
  client_id: string
  client_name: string
  summary: string
  data: { atual: Metrics; anterior: Metrics }
}

async function generateClientReport(
  clientId: string,
  clientName: string,
  weekStart: string,
  weekEnd: string,
  force: boolean
): Promise<ClientReportResult> {
  const db = createServiceClient()

  if (!force) {
    const { data: existing } = await db.from('weekly_reports').select('*').eq('week_start', weekStart).eq('client_id', clientId).maybeSingle()
    if (existing) return { ...existing, client_name: clientName }
  }

  const prev = previousWeek(weekStart, weekEnd)
  const [atual, anterior] = await Promise.all([
    computeMetrics(weekStart, weekEnd, clientId),
    computeMetrics(prev.weekStart, prev.weekEnd, clientId),
  ])

  const summary = await callOmar(CLIENT_SYSTEM_PROMPT, { cliente: clientName, semana_atual: withoutMoney(atual), semana_anterior: withoutMoney(anterior) })

  const { data: saved, error } = await db
    .from('weekly_reports')
    .upsert(
      { week_start: weekStart, week_end: weekEnd, client_id: clientId, summary, data: { atual, anterior } },
      { onConflict: 'week_start,client_id' }
    )
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return { ...saved, client_name: clientName }
}

async function generateCompanyReport(
  weekStart: string,
  weekEnd: string,
  clientReports: ClientReportResult[],
  force: boolean
) {
  const db = createServiceClient()

  if (!force) {
    const { data: existing } = await db.from('weekly_reports').select('*').eq('week_start', weekStart).is('client_id', null).maybeSingle()
    if (existing) return existing
  }

  const prev = previousWeek(weekStart, weekEnd)
  const [atual, anterior, servicesRes, leadsRes, prevLeadsRes] = await Promise.all([
    computeMetrics(weekStart, weekEnd, null),
    computeMetrics(prev.weekStart, prev.weekEnd, null),
    createServiceClient().from('services').select('amount').eq('active', true).eq('type', 'recorrente'),
    createServiceClient().from('leads').select('id, stage, estimated_value, created_at').gte('created_at', weekStart),
    createServiceClient().from('leads').select('id').gte('created_at', prev.weekStart).lt('created_at', weekStart),
  ])

  const mrr = (servicesRes.data ?? []).reduce((s, x) => s + Number(x.amount), 0)
  const novosLeads = (leadsRes.data ?? []).length
  const novosLeadsSemanaAnterior = (prevLeadsRes.data ?? []).length

  const clientesAtencao = clientReports
    .filter(r => needsAttention(r.data.atual))
    .map(r => ({ cliente: r.client_name, conteudos_atrasados: r.data.atual.conteudos_atrasados, cobrancas_em_aberto: r.data.atual.cobrancas_no_periodo - r.data.atual.cobrancas_pagas }))

  const data = {
    mrr,
    semana_atual: atual,
    semana_anterior: anterior,
    novos_leads_semana: novosLeads,
    novos_leads_semana_anterior: novosLeadsSemanaAnterior,
    total_clientes_ativos: clientReports.length,
    clientes_precisam_atencao: clientesAtencao,
  }

  const summary = await callOmar(COMPANY_SYSTEM_PROMPT, data)

  const { data: saved, error } = await db
    .from('weekly_reports')
    .upsert(
      { week_start: weekStart, week_end: weekEnd, client_id: null, summary, data },
      { onConflict: 'week_start,client_id' }
    )
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return saved
}

export async function generateWeeklyReports(force = false) {
  const { weekStart, weekEnd } = getWeekWindow()
  const db = createServiceClient()

  const { data: clients } = await db.from('clients').select('id, name').eq('status', 'ativo').order('name')

  const clientReports: ClientReportResult[] = []
  for (const client of clients ?? []) {
    try {
      const report = await generateClientReport(client.id, client.name, weekStart, weekEnd, force)
      clientReports.push(report)
    } catch (err) {
      // segue pros próximos clientes mesmo se um falhar
      console.error(`Falha ao gerar relatório de ${client.name}:`, err)
    }
  }

  const companyReport = await generateCompanyReport(weekStart, weekEnd, clientReports, force)

  return { weekStart, weekEnd, clientCount: clientReports.length, companyReport }
}

export async function getClientWeeklyReport(clientId: string, force = false): Promise<ClientReportResult | null> {
  const { weekStart, weekEnd } = getWeekWindow()
  const db = createServiceClient()
  const { data: client } = await db.from('clients').select('id, name').eq('id', clientId).single()
  if (!client) return null
  return generateClientReport(client.id, client.name, weekStart, weekEnd, force)
}
