import Groq from 'groq-sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { ROLE_NAME, type Role } from '@/lib/roles'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = 'openai/gpt-oss-120b'

export function todayBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

interface Stat {
  label: string
  value: string
  href: string
}

interface Foco {
  title: string
  due_date: string | null
  priority: string
  cliente: string | null
}

const SCOPED_MEMBERS: Partial<Record<Role, string[]>> = {
  gabriel: ['Gabriel'],
  thomas: ['Thomas'],
  julia: ['Julia', 'Gabriel'],
}

async function gatherData(role: Role): Promise<{ data: Record<string, unknown>; focos: Foco[]; stats: Stat[]; alerts: string[] }> {
  const db = createServiceClient()
  const today = todayBR()
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const memberNames = SCOPED_MEMBERS[role] ?? null

  const tasksRes = await db
    .from('tasks')
    .select('id, title, status, priority, due_date, clients(name), task_assignees(members(id, name))')
    .neq('status', 'concluido')
  const allTasks = tasksRes.data ?? []

  const scopedTasks = memberNames
    ? allTasks.filter(t =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((t as any).task_assignees ?? []).some((ta: { members: { name: string } | null }) => memberNames.includes(ta.members?.name ?? ''))
      )
    : allTasks

  const overdueTasks = scopedTasks.filter(t => t.due_date && t.due_date < today)
  const criticalTasks = scopedTasks.filter(t => t.priority === 'alta' && t.due_date && t.due_date <= today)

  const focos: Foco[] = [...overdueTasks, ...criticalTasks]
    .filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)
    .sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''))
    .slice(0, 5)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((t: any) => ({ title: t.title, due_date: t.due_date, priority: t.priority, cliente: t.clients?.name ?? null }))

  const stats: Stat[] = [
    { label: memberNames ? 'Suas tarefas atrasadas' : 'Tarefas atrasadas', value: String(overdueTasks.length), href: '/tarefas' },
  ]
  const alerts: string[] = []
  const data: Record<string, unknown> = {
    tarefas_atrasadas: overdueTasks.length,
    tarefas_criticas_hoje: criticalTasks.length,
  }

  if (role === 'thomas') {
    const [projectsRes, clientsRes] = await Promise.all([
      db.from('projects').select('id, status, deadline'),
      db.from('clients').select('id, status'),
    ])
    const projects = projectsRes.data ?? []
    const overdueProjects = projects.filter(p => p.status !== 'arquivo' && p.status !== 'concluido' && p.deadline && p.deadline < today)
    const activeClients = (clientsRes.data ?? []).filter(c => c.status === 'ativo').length
    stats.push({ label: 'Projetos atrasados', value: String(overdueProjects.length), href: '/projetos' })
    stats.push({ label: 'Clientes ativos', value: String(activeClients), href: '/clientes' })
    data.projetos_atrasados = overdueProjects.length
    data.clientes_ativos = activeClients
  } else if (role === 'gabriel') {
    const [contentRes, projectsRes] = await Promise.all([
      db.from('content_posts').select('id, status'),
      db.from('projects').select('id, status'),
    ])
    const awaiting = (contentRes.data ?? []).filter(c => c.status === 'aguardando_aprovacao').length
    const inApproval = (projectsRes.data ?? []).filter(p => p.status === 'aprovacao').length
    stats.push({ label: 'Conteúdo aguardando aprovação', value: String(awaiting), href: '/conteudo' })
    stats.push({ label: 'Projetos em aprovação', value: String(inApproval), href: '/projetos' })
    data.conteudo_aguardando_aprovacao = awaiting
    data.projetos_em_aprovacao = inApproval
  } else if (role === 'julia') {
    const contentRes = await db.from('content_posts').select('id, status, scheduled_date')
    const content = contentRes.data ?? []
    const awaiting = content.filter(c => c.status === 'aguardando_aprovacao').length
    const next7 = new Date()
    next7.setDate(next7.getDate() + 7)
    const next7Str = next7.toISOString().split('T')[0]
    const scheduled = content.filter(c => c.status === 'agendado' && c.scheduled_date && c.scheduled_date >= today && c.scheduled_date <= next7Str).length
    stats.push({ label: 'Conteúdo aguardando aprovação', value: String(awaiting), href: '/conteudo' })
    stats.push({ label: 'Posts agendados (7 dias)', value: String(scheduled), href: '/calendario' })
    data.conteudo_aguardando_aprovacao = awaiting
    data.posts_agendados_semana = scheduled
  } else {
    // gustavo / admin — visão completa da empresa
    const [servicesRes, chargesMonthRes, overdueChargesRes, expensesRes, contentRes, leadsRes] = await Promise.all([
      db.from('services').select('amount').eq('active', true).eq('type', 'recorrente'),
      db.from('charges').select('amount, paid_at').gte('due_date', monthStart).lte('due_date', monthEnd),
      db.from('charges').select('id, amount').is('paid_at', null).lt('due_date', today),
      db.from('expenses').select('amount').gte('due_date', monthStart).lte('due_date', monthEnd),
      db.from('content_posts').select('id, status'),
      db.from('leads').select('stage, estimated_value'),
    ])

    const mrr = (servicesRes.data ?? []).reduce((s, x) => s + Number(x.amount), 0)
    const charges = chargesMonthRes.data ?? []
    const receitaRecebida = charges.filter(c => c.paid_at).reduce((s, c) => s + Number(c.amount), 0)
    const despesas = (expensesRes.data ?? []).reduce((s, e) => s + Number(e.amount), 0)
    const overdueCharges = overdueChargesRes.data ?? []
    const awaitingContent = (contentRes.data ?? []).filter(c => c.status === 'aguardando_aprovacao').length

    const loadByMember = new Map<string, { nome: string; count: number }>()
    for (const t of allTasks) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const ta of (t as any).task_assignees ?? []) {
        const m = ta.members
        if (!m) continue
        const entry = loadByMember.get(m.id) ?? { nome: m.name, count: 0 }
        entry.count += 1
        loadByMember.set(m.id, entry)
      }
    }
    const busiest = [...loadByMember.values()].sort((a, b) => b.count - a.count)[0] ?? null

    const leads = leadsRes.data ?? []
    const leadsAtivos = leads.filter(l => l.stage !== 'perdido' && l.stage !== 'fechado')
    const leadsQuentes = leads.filter(l => l.stage === 'proposta' || l.stage === 'negociacao')
    const pipelineTotal = leadsAtivos.reduce((s, l) => s + Number(l.estimated_value ?? 0), 0)

    stats.push({ label: 'Conteúdo aguardando aprovação', value: String(awaitingContent), href: '/conteudo' })
    stats.push({ label: 'Mais sobrecarregado', value: busiest ? `${busiest.nome} (${busiest.count})` : '—', href: '/tarefas' })

    const valorAtrasado = overdueCharges.reduce((s, c) => s + Number(c.amount), 0)
    if (overdueCharges.length > 0) {
      alerts.push(`${overdueCharges.length} cobrança${overdueCharges.length !== 1 ? 's' : ''} em atraso somando ${valorAtrasado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`)
    }

    data.financeiro = {
      mrr,
      receita_recebida_mes: receitaRecebida,
      despesas_mes: despesas,
      margem_mes: receitaRecebida - despesas,
      cobrancas_atrasadas: overdueCharges.length,
      valor_atrasado: valorAtrasado,
    }
    data.comercial = { pipeline_total: pipelineTotal, leads_ativos: leadsAtivos.length, leads_quentes: leadsQuentes.length }
    data.conteudo_aguardando_aprovacao = awaitingContent
    data.membro_mais_sobrecarregado = busiest
  }

  return { data, focos, stats, alerts }
}

async function generateRecommendation(role: Role, data: Record<string, unknown>, focos: Foco[]): Promise<string> {
  const name = ROLE_NAME[role] || 'a pessoa'
  const completion = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 400,
    messages: [
      {
        role: 'system',
        content: `Você é o Omar, agente de IA interno de uma agência de marketing. Vai receber um resumo em JSON do que está sob a responsabilidade de ${name} hoje. Escreva uma recomendação curta pra ${name}, no estilo "Se eu fosse priorizar seu dia, começaria por X, porque Y." — interprete os dados, não apenas repita números. Fale só sobre o que aparece no JSON — nunca invente ou mencione áreas (financeiro, comercial, etc.) que não estão nos dados. 3 a 5 frases, português do Brasil, sem markdown, tom direto e de confiança, como um braço direito falando com a pessoa. Se não houver nada urgente, diga isso com tranquilidade.`,
      },
      { role: 'user', content: JSON.stringify({ ...data, prioridades: focos }) },
    ],
  })
  return completion.choices[0]?.message?.content?.trim() || 'Sem recomendação disponível no momento.'
}

export async function generateBriefingForRole(role: Role, force = false) {
  const db = createServiceClient()
  const today = todayBR()

  if (!force) {
    const { data: existing } = await db.from('ceo_briefings').select('*').eq('briefing_date', today).eq('role', role).maybeSingle()
    if (existing) return existing
  }

  const { data, focos, stats, alerts } = await gatherData(role)

  let recommendation: string
  try {
    recommendation = await generateRecommendation(role, data, focos)
  } catch {
    recommendation = 'Não consegui gerar a recomendação agora — os números abaixo continuam atualizados normalmente.'
  }

  const { data: saved, error } = await db
    .from('ceo_briefings')
    .upsert(
      { briefing_date: today, role, recommendation, focos, data: { ...data, stats, alerts } },
      { onConflict: 'briefing_date,role' }
    )
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return saved
}
