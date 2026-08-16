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

async function computeMetrics(weekStart: string, weekEnd: string, clientId: string | null): Promise<Metrics> {
  const db = createServiceClient()
  let taskQuery = db.from('tasks').select('id, status').gte('due_date', weekStart).lte('due_date', weekEnd)
  let contentQuery = db.from('content_posts').select('id, status').gte('scheduled_date', weekStart).lte('scheduled_date', weekEnd)
  let chargeQuery = db.from('charges').select('id, amount, paid_at').gte('due_date', weekStart).lte('due_date', weekEnd)

  if (clientId) {
    taskQuery = taskQuery.eq('client_id', clientId)
    contentQuery = contentQuery.eq('client_id', clientId)
    chargeQuery = chargeQuery.eq('client_id', clientId)
  }

  const [tasksRes, contentRes, chargesRes] = await Promise.all([taskQuery, contentQuery, chargeQuery])
  const tasks = tasksRes.data ?? []
  const content = contentRes.data ?? []
  const charges = chargesRes.data ?? []

  return {
    tarefas_no_periodo: tasks.length,
    tarefas_concluidas: tasks.filter(t => t.status === 'concluido').length,
    tarefas_atrasadas: tasks.filter(t => t.status !== 'concluido').length,
    conteudos_no_periodo: content.length,
    conteudos_publicados: content.filter(c => c.status === 'publicado').length,
    conteudos_atrasados: content.filter(c => c.status !== 'publicado').length,
    cobrancas_no_periodo: charges.length,
    cobrancas_pagas: charges.filter(c => c.paid_at).length,
    valor_cobrado: charges.reduce((s, c) => s + Number(c.amount), 0),
    valor_recebido: charges.filter(c => c.paid_at).reduce((s, c) => s + Number(c.amount), 0),
  }
}

function needsAttention(m: Metrics): boolean {
  return m.tarefas_atrasadas > 0 || m.conteudos_atrasados > 0 || (m.cobrancas_no_periodo > 0 && m.cobrancas_pagas < m.cobrancas_no_periodo)
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

const CLIENT_SYSTEM_PROMPT = `Você é o Omar, agente de IA interno de uma agência de marketing. Vai receber as métricas da semana de um cliente específico (tarefas, conteúdo, cobranças) e as da semana anterior, pra comparação. Escreva um relatório semanal curto pra esse cliente: o que funcionou, o que não funcionou, principais problemas, recomendações e prioridades pra semana seguinte. Interprete os números, não apenas repita. Se não houver dados suficientes (cliente sem tarefas ou conteúdo no período), diga isso brevemente, sem inventar nada. 4 a 6 frases, português do Brasil, sem markdown, tom direto e profissional.`

const COMPANY_SYSTEM_PROMPT = `Você é o Omar, agente de IA interno de uma agência de marketing. Vai receber um resumo agregado da semana da agência inteira (tarefas, conteúdo, financeiro, comercial) e a lista de clientes que precisam de atenção, com as métricas da semana anterior pra comparação. Escreva um relatório semanal geral: o que funcionou, o que não funcionou, principais problemas, quais clientes olhar com mais cuidado e por quê, recomendações e prioridades pra semana seguinte. Interprete os números, não apenas repita. 5 a 8 frases, português do Brasil, sem markdown, tom direto e de confiança, como um braço direito falando com o time.`

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

  const summary = await callOmar(CLIENT_SYSTEM_PROMPT, { cliente: clientName, semana_atual: atual, semana_anterior: anterior })

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
    .map(r => ({ cliente: r.client_name, tarefas_atrasadas: r.data.atual.tarefas_atrasadas, conteudos_atrasados: r.data.atual.conteudos_atrasados }))

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
