import { createServiceClient } from '@/lib/supabase/server'
import { JULIA_TASK_MEMBERS, type Role } from '@/lib/roles'

export interface OmarContext {
  role: Role
}

export interface OmarTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
  execute: (input: Record<string, unknown>, ctx: OmarContext) => Promise<unknown>
}

const today = () => new Date().toISOString().split('T')[0]

function getWeekBounds(): { from: string; to: string } {
  const now = new Date()
  const day = now.getDay() // 0 = domingo
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { from: fmt(monday), to: fmt(sunday) }
}

const getDashboardSummary: OmarTool = {
  name: 'get_dashboard_summary',
  description:
    'Retorna um resumo geral da agência: clientes ativos, MRR, cobranças em atraso, tarefas atrasadas e tarefas com prazo nos próximos 7 dias. Use isso quando o usuário perguntar "o que precisa da minha atenção", pedir uma visão geral, ou quiser saber como está o negócio.',
  input_schema: { type: 'object', properties: {} },
  async execute(_input, ctx) {
    const supabase = createServiceClient()
    const next7 = new Date()
    next7.setDate(next7.getDate() + 7)
    const next7Str = next7.toISOString().split('T')[0]

    const [clientsRes, servicesRes, tasksRes] = await Promise.all([
      supabase.from('clients').select('id, status'),
      supabase.from('services').select('amount').eq('active', true).eq('type', 'recorrente'),
      supabase.from('tasks').select('id, title, status, priority, due_date, task_assignees(members(name))').neq('status', 'concluido'),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tasks = (tasksRes.data ?? []).map((t: any) => ({
      ...t,
      assignee_names: (t.task_assignees ?? []).map((ta: { members: { name: string } | null }) => ta.members?.name).filter(Boolean),
    }))
    if (ctx.role === 'julia') {
      tasks = tasks.filter(t => t.assignee_names.some((n: string) => JULIA_TASK_MEMBERS.includes(n)))
    }
    const overdueTasks = tasks.filter(t => t.due_date && t.due_date < today())
    const upcomingTasks = tasks.filter(t => t.due_date && t.due_date >= today() && t.due_date <= next7Str)

    const base: Record<string, unknown> = {
      tarefas_atrasadas: overdueTasks.length,
      tarefas_proximos_7_dias: upcomingTasks.length,
      exemplos_atrasadas: overdueTasks.slice(0, 5).map(t => ({ title: t.title, due_date: t.due_date, priority: t.priority })),
      exemplos_proximas: upcomingTasks.slice(0, 5).map(t => ({ title: t.title, due_date: t.due_date, priority: t.priority })),
    }

    if (ctx.role === 'julia') return base

    const activeClients = (clientsRes.data ?? []).filter(c => c.status === 'ativo').length
    const mrr = (servicesRes.data ?? []).reduce((sum, s) => sum + Number(s.amount), 0)
    const { data: overdueCharges } = await supabase
      .from('charges')
      .select('id, amount, due_date, clients(name)')
      .is('paid_at', null)
      .lt('due_date', today())

    return {
      ...base,
      clientes_ativos: activeClients,
      mrr,
      cobrancas_em_atraso: overdueCharges?.length ?? 0,
      valor_total_em_atraso: (overdueCharges ?? []).reduce((sum, c) => sum + Number(c.amount), 0),
      exemplos_cobrancas_atrasadas: (overdueCharges ?? []).slice(0, 5),
    }
  },
}

const listClients: OmarTool = {
  name: 'list_clients',
  description: 'Lista clientes da agência, opcionalmente filtrando por status (ativo, pausado, encerrado).',
  input_schema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['ativo', 'pausado', 'encerrado'], description: 'Filtrar por status do cliente' },
    },
  },
  async execute(input, ctx) {
    if (ctx.role === 'julia') return { error: 'Sem acesso a dados de clientes.' }
    const supabase = createServiceClient()
    let query = supabase.from('clients').select('id, name, email, status, started_at').order('name')
    if (input.status) query = query.eq('status', input.status as string)
    const { data, error } = await query
    if (error) return { error: error.message }
    return data
  },
}

const listTasks: OmarTool = {
  name: 'list_tasks',
  description:
    'Lista tarefas, com filtros opcionais por status, prioridade, responsável (nome do membro) ou cliente. Use para responder perguntas sobre o que está pendente, em andamento ou atrasado.',
  input_schema: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: ['pendente', 'em_andamento', 'concluido'] },
      priority: { type: 'string', enum: ['baixa', 'media', 'alta'] },
      assignee_name: { type: 'string', description: 'Nome do responsável, ex: "Gabriel"' },
      overdue_only: { type: 'boolean', description: 'Se true, retorna apenas tarefas com prazo vencido e não concluídas' },
      client_name: { type: 'string', description: 'Nome do cliente para filtrar tarefas relacionadas' },
    },
  },
  async execute(input, ctx) {
    const supabase = createServiceClient()
    let query = supabase
      .from('tasks')
      .select('id, title, description, status, priority, due_date, clients(name), task_assignees(members(name))')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(50)

    if (input.status) query = query.eq('status', input.status as string)
    if (input.priority) query = query.eq('priority', input.priority as string)
    if (input.overdue_only) query = query.lt('due_date', today()).neq('status', 'concluido')

    const { data, error } = await query
    if (error) return { error: error.message }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let results = (data as any[]).map(t => {
      const { task_assignees, ...rest } = t
      return {
        ...rest,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        assignees: (task_assignees ?? []).map((ta: any) => ta.members?.name).filter(Boolean),
      }
    })

    if (ctx.role === 'julia') {
      results = results.filter(t => t.assignees.some((n: string) => JULIA_TASK_MEMBERS.includes(n)))
    }
    if (input.assignee_name) {
      const name = (input.assignee_name as string).toLowerCase()
      results = results.filter(t => t.assignees.some((n: string) => n.toLowerCase().includes(name)))
    }
    if (input.client_name) {
      const name = (input.client_name as string).toLowerCase()
      results = results.filter(t => t.clients?.name?.toLowerCase().includes(name))
    }
    return results
  },
}

const listProjects: OmarTool = {
  name: 'list_projects',
  description: 'Lista projetos da agência, opcionalmente filtrando por status.',
  input_schema: {
    type: 'object',
    properties: {
      status: { type: 'string', description: 'Filtrar por status do projeto' },
    },
  },
  async execute(input) {
    const supabase = createServiceClient()
    let query = supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(50)
    if (input.status) query = query.eq('status', input.status as string)
    const { data, error } = await query
    if (error) return { error: error.message }
    return data
  },
}

const getFinanceiroSummary: OmarTool = {
  name: 'get_financeiro_summary',
  description:
    'Retorna um resumo financeiro do mês atual: receita estimada, receita recebida, despesas e cobranças em atraso. Use para perguntas sobre números, faturamento ou saúde financeira.',
  input_schema: { type: 'object', properties: {} },
  async execute(_input, ctx) {
    if (ctx.role === 'julia') return { error: 'Sem acesso a dados financeiros.' }
    const supabase = createServiceClient()
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const [chargesRes, expensesRes, overdueRes] = await Promise.all([
      supabase.from('charges').select('amount, paid_at, status').gte('due_date', monthStart).lte('due_date', monthEnd),
      supabase.from('expenses').select('amount').gte('due_date', monthStart).lte('due_date', monthEnd),
      supabase.from('charges').select('id, amount, due_date, clients(name)').is('paid_at', null).lt('due_date', today()),
    ])

    const charges = chargesRes.data ?? []
    const estimatedMonth = charges.reduce((sum, c) => sum + Number(c.amount), 0)
    const receivedMonth = charges.filter(c => c.paid_at).reduce((sum, c) => sum + Number(c.amount), 0)
    const expensesMonth = (expensesRes.data ?? []).reduce((sum, e) => sum + Number(e.amount), 0)

    return {
      receita_estimada_mes: estimatedMonth,
      receita_recebida_mes: receivedMonth,
      despesas_mes: expensesMonth,
      cobrancas_em_atraso: overdueRes.data ?? [],
    }
  },
}

const listMembers: OmarTool = {
  name: 'list_members',
  description: 'Lista os membros da equipe (usado para resolver nomes de responsáveis antes de criar ou editar tarefas).',
  input_schema: { type: 'object', properties: {} },
  async execute() {
    const supabase = createServiceClient()
    const { data, error } = await supabase.from('members').select('id, name, initials').order('name')
    if (error) return { error: error.message }
    return data
  },
}

const createTask: OmarTool = {
  name: 'create_task',
  description:
    'Cria uma nova tarefa. Pode ter zero, um ou vários responsáveis ao mesmo tempo (uma tarefa às vezes precisa de mais de uma pessoa). Use list_members antes para resolver nomes em IDs. Se o usuário não especificar cliente ou responsável, deixe em branco.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Título da tarefa' },
      description: { type: 'string', description: 'Descrição opcional' },
      client_id: { type: 'string', description: 'ID do cliente relacionado, se houver' },
      assignee_ids: { type: 'array', items: { type: 'string' }, description: 'IDs dos membros responsáveis, se houver (pode ser mais de um)' },
      priority: { type: 'string', enum: ['baixa', 'media', 'alta'] },
      due_date: { type: 'string', description: 'Data de prazo no formato YYYY-MM-DD, se houver' },
    },
    required: ['title'],
  },
  async execute(input) {
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: input.title,
        description: input.description ?? null,
        client_id: input.client_id ?? null,
        priority: input.priority ?? 'media',
        due_date: input.due_date ?? null,
        status: 'pendente',
      })
      .select('id, title, priority, due_date')
      .single()
    if (error) return { error: error.message }

    const assigneeIds = Array.isArray(input.assignee_ids) ? (input.assignee_ids as string[]).filter(Boolean) : []
    if (assigneeIds.length > 0) {
      const { error: aErr } = await supabase
        .from('task_assignees')
        .insert(assigneeIds.map(member_id => ({ task_id: data.id, member_id })))
      if (aErr) return { error: aErr.message }
    }
    return { success: true, task: data }
  },
}

const updateTask: OmarTool = {
  name: 'update_task',
  description:
    'Atualiza uma tarefa existente (status, prioridade, prazo, responsáveis ou título). Use list_tasks antes para encontrar o task_id correto. Ao passar assignee_ids, isso substitui a lista de responsáveis inteira — inclua todos que devem continuar, não só os novos.',
  input_schema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'ID da tarefa a atualizar' },
      title: { type: 'string' },
      status: { type: 'string', enum: ['pendente', 'em_andamento', 'concluido'] },
      priority: { type: 'string', enum: ['baixa', 'media', 'alta'] },
      due_date: { type: 'string', description: 'Formato YYYY-MM-DD' },
      assignee_ids: { type: 'array', items: { type: 'string' }, description: 'Lista completa de IDs de responsáveis (substitui a atual)' },
    },
    required: ['task_id'],
  },
  async execute(input) {
    const supabase = createServiceClient()
    const update: Record<string, unknown> = {}
    if (input.title !== undefined) update.title = input.title
    if (input.status !== undefined) update.status = input.status
    if (input.priority !== undefined) update.priority = input.priority
    if (input.due_date !== undefined) update.due_date = input.due_date

    if (Object.keys(update).length > 0) {
      const { error } = await supabase.from('tasks').update(update).eq('id', input.task_id)
      if (error) return { error: error.message }
    }

    if (input.assignee_ids !== undefined) {
      const assigneeIds = Array.isArray(input.assignee_ids) ? (input.assignee_ids as string[]).filter(Boolean) : []
      const { error: delErr } = await supabase.from('task_assignees').delete().eq('task_id', input.task_id)
      if (delErr) return { error: delErr.message }
      if (assigneeIds.length > 0) {
        const { error: insErr } = await supabase
          .from('task_assignees')
          .insert(assigneeIds.map(member_id => ({ task_id: input.task_id, member_id })))
        if (insErr) return { error: insErr.message }
      }
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status, priority, due_date')
      .eq('id', input.task_id)
      .single()
    if (error) return { error: error.message }
    return { success: true, task: data }
  },
}

const createClientTool: OmarTool = {
  name: 'create_client',
  description: 'Cadastra um novo cliente na agência. Use quando o usuário pedir para adicionar ou cadastrar um cliente novo.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nome do cliente' },
      email: { type: 'string' },
      phone: { type: 'string' },
      status: { type: 'string', enum: ['ativo', 'pausado', 'encerrado'] },
      notes: { type: 'string' },
    },
    required: ['name'],
  },
  async execute(input, ctx) {
    if (ctx.role === 'julia') return { error: 'Sem acesso a dados de clientes.' }
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('clients')
      .insert({
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        status: input.status ?? 'ativo',
        started_at: today(),
        notes: input.notes ?? null,
      })
      .select('id, name, status')
      .single()
    if (error) return { error: error.message }
    return { success: true, client: data }
  },
}

const getClientScope: OmarTool = {
  name: 'get_client_scope',
  description:
    'Consulta o dossiê completo de um cliente: serviços contratados (valor, recorrência, se está ativo), objetivos, redes sociais, links úteis, responsável pela conta e observações internas. Use quando perguntarem o que um cliente contratou, qual o escopo/objetivo dele, ou pedirem um resumo do cliente. Nunca retorna senhas — isso fica de fora por segurança.',
  input_schema: {
    type: 'object',
    properties: {
      client_name: { type: 'string', description: 'Nome (ou parte do nome) do cliente' },
    },
    required: ['client_name'],
  },
  async execute(input, ctx) {
    if (ctx.role === 'julia') return { error: 'Sem acesso a dados de clientes.' }
    const supabase = createServiceClient()
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, status, notes')
      .ilike('name', `%${input.client_name}%`)
    if (error) return { error: error.message }
    if (!clients || clients.length === 0) return { error: `Nenhum cliente encontrado com o nome "${input.client_name}"` }

    const results = []
    for (const client of clients) {
      const [{ data: services }, { data: extras }] = await Promise.all([
        supabase.from('services').select('name, type, amount, recurrence, active, contract_end').eq('client_id', client.id),
        supabase.from('client_extras').select('responsavel, objectives, social_media, links').eq('client_id', client.id).maybeSingle(),
      ])
      results.push({
        cliente: client.name,
        status: client.status,
        observacoes: client.notes,
        servicos: services ?? [],
        responsavel_conta: extras?.responsavel ?? null,
        objetivos: extras?.objectives ?? null,
        redes_sociais: extras?.social_media ?? [],
        links: extras?.links ?? [],
      })
    }
    return results
  },
}

const getWeekOverview: OmarTool = {
  name: 'get_week_overview',
  description:
    'Retorna tarefas com prazo e conteúdos agendados dentro de um período (por padrão, a semana atual, segunda a domingo). Use para perguntas como "o que tenho essa semana", "quantos posts vão ser publicados essa semana", "quais reuniões/compromissos tenho", ou "quais são as prioridades da semana" — pode filtrar por cliente.',
  input_schema: {
    type: 'object',
    properties: {
      date_from: { type: 'string', description: 'Início do período, YYYY-MM-DD. Se omitido, usa a segunda-feira da semana atual.' },
      date_to: { type: 'string', description: 'Fim do período, YYYY-MM-DD. Se omitido, usa o domingo da semana atual.' },
      client_name: { type: 'string', description: 'Filtrar por nome do cliente' },
    },
  },
  async execute(input, ctx) {
    const supabase = createServiceClient()
    const bounds = getWeekBounds()
    const from = (input.date_from as string) || bounds.from
    const to = (input.date_to as string) || bounds.to

    const [tasksRes, contentRes] = await Promise.all([
      supabase.from('tasks').select('id, title, status, priority, due_date, clients(name), task_assignees(members(name))').gte('due_date', from).lte('due_date', to),
      supabase.from('content_posts').select('id, title, platform, status, scheduled_date, clients(name)').gte('scheduled_date', from).lte('scheduled_date', to),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tasks = (tasksRes.data ?? []).map((t: any) => {
      const { task_assignees, ...rest } = t
      return {
        ...rest,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        assignees: (task_assignees ?? []).map((ta: any) => ta.members?.name).filter(Boolean),
      }
    })
    if (ctx.role === 'julia') {
      tasks = tasks.filter(t => t.assignees.some((n: string) => JULIA_TASK_MEMBERS.includes(n)))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let content = (contentRes.data ?? []) as any[]

    if (input.client_name) {
      const name = (input.client_name as string).toLowerCase()
      tasks = tasks.filter(t => t.clients?.name?.toLowerCase().includes(name))
      content = content.filter(c => c.clients?.name?.toLowerCase().includes(name))
    }

    return { periodo: { de: from, ate: to }, tarefas: tasks, conteudos: content }
  },
}

const listContent: OmarTool = {
  name: 'list_content',
  description:
    'Lista posts/conteúdos, com filtros opcionais por cliente, status ou plataforma. Use para "quais conteúdos estão pendentes", "o que já foi publicado", etc. Status possíveis: rascunho, em_criacao, aguardando_aprovacao, aprovado, agendado, publicado, reprovado.',
  input_schema: {
    type: 'object',
    properties: {
      client_name: { type: 'string' },
      status: { type: 'string', enum: ['rascunho', 'em_criacao', 'aguardando_aprovacao', 'aprovado', 'agendado', 'publicado', 'reprovado'] },
      platform: { type: 'string', description: 'Ex: instagram, tiktok, email' },
    },
  },
  async execute(input) {
    const supabase = createServiceClient()
    let query = supabase
      .from('content_posts')
      .select('id, title, platform, status, scheduled_date, published_at, responsible, clients(name)')
      .order('scheduled_date', { ascending: false, nullsFirst: false })
      .limit(50)
    if (input.status) query = query.eq('status', input.status as string)
    if (input.platform) query = query.eq('platform', input.platform as string)

    const { data, error } = await query
    if (error) return { error: error.message }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let results = data as any[]
    if (input.client_name) {
      const name = (input.client_name as string).toLowerCase()
      results = results.filter(c => c.clients?.name?.toLowerCase().includes(name))
    }
    return results
  },
}

const updateContent: OmarTool = {
  name: 'update_content',
  description:
    'Atualiza um conteúdo/post existente — status, data agendada, título, legenda ou notas. Use list_content antes para encontrar o content_id. Esta ferramenta não cria conteúdo novo, só edita o que já existe.',
  input_schema: {
    type: 'object',
    properties: {
      content_id: { type: 'string', description: 'ID do conteúdo a atualizar' },
      status: { type: 'string', enum: ['rascunho', 'em_criacao', 'aguardando_aprovacao', 'aprovado', 'agendado', 'publicado', 'reprovado'] },
      title: { type: 'string' },
      caption: { type: 'string' },
      scheduled_date: { type: 'string', description: 'Formato YYYY-MM-DD' },
      notes: { type: 'string' },
    },
    required: ['content_id'],
  },
  async execute(input) {
    const supabase = createServiceClient()
    const update: Record<string, unknown> = {}
    if (input.status !== undefined) update.status = input.status
    if (input.title !== undefined) update.title = input.title
    if (input.caption !== undefined) update.caption = input.caption
    if (input.scheduled_date !== undefined) update.scheduled_date = input.scheduled_date
    if (input.notes !== undefined) update.notes = input.notes

    const { data, error } = await supabase
      .from('content_posts')
      .update(update)
      .eq('id', input.content_id)
      .select('id, title, status, scheduled_date')
      .single()
    if (error) return { error: error.message }
    return { success: true, content: data }
  },
}

const listGoals: OmarTool = {
  name: 'list_goals',
  description:
    'Lista as metas da agência (MRR, número de clientes, ou personalizadas) com valor atual x objetivo e prazo. Use para perguntas sobre objetivos, metas ou "aonde queremos chegar".',
  input_schema: {
    type: 'object',
    properties: {
      period: { type: 'string', description: 'Filtrar por período, formato YYYY-MM' },
    },
  },
  async execute(input) {
    const supabase = createServiceClient()
    let query = supabase
      .from('goals')
      .select('title, type, period, target_value, current_value, unit, deadline, clients(name)')
      .order('deadline', { ascending: true, nullsFirst: false })
    if (input.period) query = query.eq('period', input.period as string)
    const { data, error } = await query
    if (error) return { error: error.message }
    return data
  },
}

const listPipeline: OmarTool = {
  name: 'list_pipeline',
  description:
    'Lista os leads/negociações no funil de vendas (pipeline), com estágio, valor estimado e responsável. Estágios em ordem: novo_lead, contato, reuniao, proposta, negociacao, fechado, perdido. Use para perguntas sobre quantos negócios estão em andamento ou quem está perto de fechar.',
  input_schema: {
    type: 'object',
    properties: {
      stage: { type: 'string', enum: ['novo_lead', 'contato', 'reuniao', 'proposta', 'negociacao', 'fechado', 'perdido'] },
    },
  },
  async execute(input, ctx) {
    if (ctx.role === 'julia') return { error: 'Sem acesso ao pipeline.' }
    const supabase = createServiceClient()
    let query = supabase
      .from('leads')
      .select('company_name, contact_name, stage, estimated_value, responsavel, last_contact_at')
      .order('created_at', { ascending: false })
    if (input.stage) query = query.eq('stage', input.stage as string)
    const { data, error } = await query
    if (error) return { error: error.message }
    return data
  },
}

const getFinancialHistory: OmarTool = {
  name: 'get_financial_history',
  description:
    'Retorna o histórico mensal de MRR (receita recorrente) e receita recebida dos últimos meses, reconstruído a partir da data de início/fim de cada serviço — não é uma projeção, é o valor real de cada mês passado. Use para "qual foi o MRR de [mês]", "como estava o faturamento há X meses", ou comparar meses. Não serve para prever meses futuros.',
  input_schema: {
    type: 'object',
    properties: {
      months: { type: 'number', description: 'Quantos meses para trás incluir, contando o mês atual. Padrão: 6, máximo: 24.' },
    },
  },
  async execute(input, ctx) {
    if (ctx.role === 'julia') return { error: 'Sem acesso a dados financeiros.' }
    const supabase = createServiceClient()
    const monthsBack = typeof input.months === 'number' && input.months > 0 ? Math.min(Math.floor(input.months), 24) : 6

    const now = new Date()
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1)

    const [servicesRes, chargesRes] = await Promise.all([
      supabase.from('services').select('amount, started_at, ended_at').eq('type', 'recorrente'),
      supabase.from('charges').select('amount, paid_at').not('paid_at', 'is', null).gte('paid_at', rangeStart.toISOString().split('T')[0]),
    ])

    const services = servicesRes.data ?? []
    const charges = chargesRes.data ?? []

    const history = []
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]

      const mrr = services
        .filter(s => s.started_at <= monthEnd && (!s.ended_at || s.ended_at >= monthStart))
        .reduce((sum, s) => sum + Number(s.amount), 0)

      const receitaRecebida = charges
        .filter(c => c.paid_at && c.paid_at >= monthStart && c.paid_at <= monthEnd)
        .reduce((sum, c) => sum + Number(c.amount), 0)

      history.push({
        periodo: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        mrr,
        receita_recebida: receitaRecebida,
      })
    }
    return history
  },
}

const ALL_TOOLS: OmarTool[] = [
  getDashboardSummary,
  listClients,
  listTasks,
  listProjects,
  getFinanceiroSummary,
  listMembers,
  createTask,
  updateTask,
  createClientTool,
  getClientScope,
  getWeekOverview,
  listContent,
  updateContent,
  listGoals,
  listPipeline,
  getFinancialHistory,
]

const JULIA_BLOCKED_TOOLS = new Set(['list_clients', 'get_financeiro_summary', 'create_client', 'get_client_scope', 'list_pipeline', 'get_financial_history'])

export function getToolsForRole(role: Role): OmarTool[] {
  if (role === 'julia') return ALL_TOOLS.filter(t => !JULIA_BLOCKED_TOOLS.has(t.name))
  return ALL_TOOLS
}

export function getToolByName(name: string): OmarTool | undefined {
  return ALL_TOOLS.find(t => t.name === name)
}
