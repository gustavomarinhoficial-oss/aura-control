import { createServiceClient } from '@/lib/supabase/server'
import { createOwlExpense, createFdmcEntry } from '@/lib/finance/create'
import { addMonthsClamped, parseInstallments } from '@/lib/finance/installments'
import { matchByName, norm } from '@/lib/meetings/voiceParse'
import { ToolError } from './errors'
import type { Tool } from './tools'

// Ferramentas do Financeiro (OWL e FDMC) para o Claude: lançar despesa/receita, marcar como pago, listar e resumir o mês.
// Só aparecem para tokens com o escopo "financeiro".

const fail = (msg: string): never => { throw new ToolError(msg) }

const EXPENSE_CATS: Record<string, string> = {
  prolabore: 'Pró-labore', aplicacao: 'Aplicação / aporte', salario: 'Salário', freelancer: 'Freelancer',
  impostos: 'Impostos', aluguel: 'Aluguel', software: 'Software/Tools', marketing: 'Marketing', pessoal: 'Pessoal',
  comida: 'Comida', transporte: 'Transporte (Uber, combustível, estacionamento)', assinaturas: 'Assinaturas',
  reinvestimento: 'Reinvestimento (equipamentos, melhorias)', outro: 'Outro',
}
const FDMC_REVENUE_CATS: Record<string, string> = { vendas: 'Vendas', servicos: 'Serviços', comissao: 'Comissão', outro: 'Outro' }

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + 'T12:00:00Z').toISOString().startsWith(v)
const isMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
const todayBR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const paidAtISO = (d: string) => new Date(`${d}T12:00:00-03:00`).toISOString()
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function empresa(v: unknown): 'owl' | 'fdmc' {
  const e = typeof v === 'string' ? v.toLowerCase().trim() : ''
  if (e === 'owl' || e === 'fdmc') return e
  return fail('"empresa" deve ser "owl" (OWL Creative Club) ou "fdmc".')
}

function valor(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/\./g, '').replace(',', '.'))
  if (!(n > 0)) return fail('"valor" deve ser um número maior que zero (ex.: 386.5).')
  return Math.round(n * 100) / 100
}

function categoria(v: unknown, cats: Record<string, string>): string {
  if (v === undefined || v === null || v === '') return 'outro'
  const q = norm(String(v))
  const hit = Object.entries(cats).find(([k, label]) => norm(k) === q || norm(label) === q || norm(label).startsWith(q))
  return hit ? hit[0] : fail(`Categoria "${v}" não existe. Use uma destas: ${Object.keys(cats).join(', ')}.`)
}

function monthRange(m: string) {
  const [y, mo] = m.split('-').map(Number)
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}` }
}

type Row = Record<string, unknown>
const status = (paidAt: unknown, due: string) => (paidAt ? 'pago' : due < todayBR() ? 'atrasado' : 'pendente')

function shapeExpense(r: Row, tipo: 'despesa' | 'receita', dateKey: string) {
  return {
    id: r.id,
    tipo,
    descricao: r.description,
    valor: Number(r.amount),
    vencimento: r[dateKey],
    categoria: r.category ?? null,
    status: status(r.paid_at, String(r[dateKey])),
    pago_em: r.paid_at ? new Date(String(r.paid_at)).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) : null,
    parcela: r.installments_total ? `${r.installment_number}/${r.installments_total}` : null,
    recorrente: !!r.recurrent,
    observacoes: r.notes ?? null,
  }
}

const empresaProp = { type: 'string', enum: ['owl', 'fdmc'], description: '"owl" = OWL Creative Club; "fdmc" = FDMC.' }

export const FINANCE_TOOLS: Tool[] = [
  {
    name: 'fin_categorias',
    description: 'Lista as categorias de despesa (OWL e FDMC) e de receita (FDMC). Use antes de lançar se não souber a categoria certa.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run() {
      return {
        despesa: Object.entries(EXPENSE_CATS).map(([chave, nome]) => ({ chave, nome })),
        receita_fdmc: Object.entries(FDMC_REVENUE_CATS).map(([chave, nome]) => ({ chave, nome })),
        observacao: 'Pró-labore, Aplicação e Reinvestimento ficam fora do custo operacional e do lucro. Receita da OWL é uma cobrança de um cliente (não tem categoria).',
      }
    },
  },
  {
    name: 'fin_criar_despesa',
    description: 'Lança uma despesa no Financeiro da OWL ou do FDMC. Formas: "avista" (padrão), "parcelado" (cria todas as N parcelas, uma por mês, a partir do vencimento) ou "recorrente" (todo mês, por N meses ou sem prazo). Confirme com o Gustavo valor, data e categoria antes de lançar.',
    inputSchema: {
      type: 'object',
      properties: {
        empresa: empresaProp,
        descricao: { type: 'string' },
        valor: { type: 'number', description: 'Valor em reais. Parcelado: valor de CADA parcela, a menos que valor_e_do_total=true.' },
        vencimento: { type: 'string', description: 'AAAA-MM-DD. Parcelado: data da 1ª parcela.' },
        categoria: { type: 'string', description: 'Chave ou nome da categoria (fin_categorias). Padrão: outro.' },
        forma: { type: 'string', enum: ['avista', 'parcelado', 'recorrente'] },
        parcelas: { type: 'number', description: 'Parcelado: em quantas vezes (2 a 60).' },
        valor_e_do_total: { type: 'boolean', description: 'Parcelado: true se o "valor" é o total da compra (divide entre as parcelas).' },
        meses: { type: 'number', description: 'Recorrente: por quantos meses (vazio = sem prazo).' },
        ja_paga: { type: 'boolean', description: 'true se já foi paga (no parcelado, só a 1ª parcela).' },
        data_pagamento: { type: 'string', description: 'AAAA-MM-DD; padrão = vencimento.' },
        observacoes: { type: 'string' },
      },
      required: ['empresa', 'descricao', 'valor', 'vencimento'],
      additionalProperties: false,
    },
    async run(a) {
      const emp = empresa(a.empresa)
      if (typeof a.descricao !== 'string' || !a.descricao.trim()) return fail('Informe a "descricao".')
      if (!isDate(a.vencimento)) return fail('"vencimento" deve estar no formato AAAA-MM-DD.')
      const amount = valor(a.valor)
      const category = categoria(a.categoria, EXPENSE_CATS)
      const forma = a.forma ?? 'avista'
      if (!['avista', 'parcelado', 'recorrente'].includes(String(forma))) return fail('"forma" deve ser avista, parcelado ou recorrente.')
      if (a.data_pagamento !== undefined && !isDate(a.data_pagamento)) return fail('"data_pagamento" deve estar no formato AAAA-MM-DD.')
      const body: Record<string, unknown> = {
        description: a.descricao.trim(),
        amount,
        category,
        notes: typeof a.observacoes === 'string' ? a.observacoes : null,
        paid_at: a.ja_paga ? paidAtISO((a.data_pagamento as string) ?? a.vencimento) : null,
      }
      if (forma === 'parcelado') {
        const n = parseInstallments(a.parcelas)
        if (!n) return fail('Parcelado: informe "parcelas" (2 a 60).')
        body.installments = n
        body.amount_mode = a.valor_e_do_total ? 'total' : 'parcela'
      } else if (forma === 'recorrente') {
        body.recurrent = true
        const m = Number(a.meses)
        body.recurrence_end_date = a.meses !== undefined && Number.isInteger(m) && m >= 1 ? addMonthsClamped(a.vencimento, m) : null
      }
      const r = emp === 'owl'
        ? await createOwlExpense({ ...body, due_date: a.vencimento })
        : await createFdmcEntry({ ...body, type: 'despesa', entry_date: a.vencimento })
      if (!r.ok) return fail(r.error)
      return { lancado: true, empresa: emp, forma, ...shapeExpense(r.data, 'despesa', emp === 'owl' ? 'due_date' : 'entry_date'), parcelas_criadas: r.data.parcelas_criadas ?? null }
    },
  },
  {
    name: 'fin_criar_receita',
    description: 'Lança uma receita. OWL: é uma cobrança de um cliente (informe "cliente" pelo nome ou id). FDMC: receita com categoria (vendas, servicos, comissao, outro), pode ser recorrente. Confirme com o Gustavo antes de lançar.',
    inputSchema: {
      type: 'object',
      properties: {
        empresa: empresaProp,
        descricao: { type: 'string' },
        valor: { type: 'number' },
        vencimento: { type: 'string', description: 'AAAA-MM-DD' },
        cliente: { type: 'string', description: 'OWL: nome ou id do cliente (obrigatório na OWL).' },
        categoria: { type: 'string', description: 'FDMC: vendas, servicos, comissao ou outro.' },
        recorrente: { type: 'boolean', description: 'FDMC: repete todo mês.' },
        meses: { type: 'number', description: 'FDMC recorrente: por quantos meses.' },
        ja_recebida: { type: 'boolean' },
        data_recebimento: { type: 'string', description: 'AAAA-MM-DD; padrão = vencimento.' },
        observacoes: { type: 'string' },
      },
      required: ['empresa', 'descricao', 'valor', 'vencimento'],
      additionalProperties: false,
    },
    async run(a) {
      const emp = empresa(a.empresa)
      if (typeof a.descricao !== 'string' || !a.descricao.trim()) return fail('Informe a "descricao".')
      if (!isDate(a.vencimento)) return fail('"vencimento" deve estar no formato AAAA-MM-DD.')
      if (a.data_recebimento !== undefined && !isDate(a.data_recebimento)) return fail('"data_recebimento" deve estar no formato AAAA-MM-DD.')
      const amount = valor(a.valor)
      const paidAt = a.ja_recebida ? paidAtISO((a.data_recebimento as string) ?? a.vencimento) : null

      if (emp === 'owl') {
        if (a.recorrente) return fail('Receita recorrente da OWL é um serviço do cliente: cadastre na página do cliente (Serviços). Aqui eu lanço uma cobrança avulsa.')
        if (typeof a.cliente !== 'string' || !a.cliente.trim()) return fail('Na OWL a receita é de um cliente: informe "cliente".')
        const db = createServiceClient()
        const { data: clients } = await db.from('clients').select('id, name')
        const list = clients ?? []
        const client = list.find(c => c.id === a.cliente) ?? matchByName(list, c => c.name, a.cliente as string)
        if (!client) return fail(`Não achei o cliente "${a.cliente}". Clientes: ${list.map(c => c.name).join(', ')}.`)
        const { data, error } = await db.from('charges').insert({
          client_id: client.id, description: a.descricao.trim(), amount, due_date: a.vencimento,
          status: paidAt ? 'pago' : 'pendente', paid_at: paidAt,
        }).select().single()
        if (error || !data) return fail(`Erro ao lançar: ${error?.message ?? 'desconhecido'}`)
        return { lancado: true, empresa: emp, cliente: client.name, ...shapeExpense(data, 'receita', 'due_date') }
      }

      const body: Record<string, unknown> = {
        type: 'receita', description: a.descricao.trim(), amount, entry_date: a.vencimento,
        category: categoria(a.categoria, FDMC_REVENUE_CATS), notes: typeof a.observacoes === 'string' ? a.observacoes : null, paid_at: paidAt,
      }
      if (a.recorrente) {
        body.recurrent = true
        const m = Number(a.meses)
        body.recurrence_end_date = a.meses !== undefined && Number.isInteger(m) && m >= 1 ? addMonthsClamped(a.vencimento, m) : null
      }
      const r = await createFdmcEntry(body)
      if (!r.ok) return fail(r.error)
      return { lancado: true, empresa: emp, ...shapeExpense(r.data, 'receita', 'entry_date') }
    },
  },
  {
    name: 'fin_listar',
    description: 'Lista os lançamentos de um mês (despesas e/ou receitas) com id, valor, vencimento, categoria e status (pendente, pago, atrasado). Use para achar o id antes de marcar como pago.',
    inputSchema: {
      type: 'object',
      properties: {
        empresa: empresaProp,
        mes: { type: 'string', description: 'AAAA-MM (padrão: mês atual).' },
        tipo: { type: 'string', enum: ['despesa', 'receita'] },
        status: { type: 'string', enum: ['pendente', 'pago', 'atrasado'] },
        busca: { type: 'string', description: 'Filtra pela descrição (ou cliente, na OWL).' },
      },
      required: ['empresa'],
      additionalProperties: false,
    },
    async run(a) {
      const emp = empresa(a.empresa)
      const mes = a.mes === undefined ? todayBR().slice(0, 7) : (isMonth(a.mes) ? a.mes : fail('"mes" deve estar no formato AAAA-MM.'))
      const { from, to } = monthRange(mes)
      const db = createServiceClient()
      let items: ReturnType<typeof shapeExpense>[] = []
      if (emp === 'owl') {
        const [exp, chg] = await Promise.all([
          a.tipo === 'receita' ? null : db.from('expenses').select('*').gte('due_date', from).lte('due_date', to).order('due_date'),
          a.tipo === 'despesa' ? null : db.from('charges').select('*, clients(name)').gte('due_date', from).lte('due_date', to).order('due_date'),
        ])
        items = [
          ...((exp?.data ?? []) as Row[]).map(r => shapeExpense(r, 'despesa', 'due_date')),
          ...((chg?.data ?? []) as Row[]).map(r => ({ ...shapeExpense(r, 'receita', 'due_date'), cliente: (r.clients as { name?: string } | null)?.name ?? null })),
        ]
      } else {
        let q = db.from('fdmc_entries').select('*').gte('entry_date', from).lte('entry_date', to).order('entry_date')
        if (a.tipo) q = q.eq('type', a.tipo as string)
        const { data } = await q
        items = ((data ?? []) as Row[]).map(r => shapeExpense(r, r.type as 'despesa' | 'receita', 'entry_date'))
      }
      if (a.status) items = items.filter(i => i.status === a.status)
      if (typeof a.busca === 'string' && a.busca.trim()) {
        const q = norm(a.busca)
        items = items.filter(i => norm(`${i.descricao} ${(i as { cliente?: string }).cliente ?? ''}`).includes(q))
      }
      return { empresa: emp, mes, total: items.length, soma: brl(items.reduce((s, i) => s + i.valor, 0)), lancamentos: items }
    },
  },
  {
    name: 'fin_marcar_pago',
    description: 'Marca uma despesa como paga ou uma receita como recebida (use o id de fin_listar). Para desfazer, use desfazer=true.',
    inputSchema: {
      type: 'object',
      properties: {
        empresa: empresaProp,
        tipo: { type: 'string', enum: ['despesa', 'receita'] },
        id: { type: 'string' },
        data_pagamento: { type: 'string', description: 'AAAA-MM-DD; padrão = hoje.' },
        desfazer: { type: 'boolean', description: 'true para voltar a pendente.' },
      },
      required: ['empresa', 'tipo', 'id'],
      additionalProperties: false,
    },
    async run(a) {
      const emp = empresa(a.empresa)
      if (a.tipo !== 'despesa' && a.tipo !== 'receita') return fail('"tipo" deve ser despesa ou receita.')
      if (typeof a.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(a.id)) return fail('"id" inválido. Use um id de fin_listar.')
      if (a.data_pagamento !== undefined && !isDate(a.data_pagamento)) return fail('"data_pagamento" deve estar no formato AAAA-MM-DD.')
      const paidAt = a.desfazer ? null : paidAtISO((a.data_pagamento as string) ?? todayBR())
      const db = createServiceClient()
      const table = emp === 'fdmc' ? 'fdmc_entries' : a.tipo === 'receita' ? 'charges' : 'expenses'
      const update: Record<string, unknown> = { paid_at: paidAt }
      if (table === 'charges') update.status = paidAt ? 'pago' : 'pendente'
      let q = db.from(table).update(update).eq('id', a.id)
      if (table === 'fdmc_entries') q = q.eq('type', a.tipo)
      const { data, error } = await q.select().maybeSingle()
      if (error) return fail(`Erro: ${error.message}`)
      if (!data) return fail('Lançamento não encontrado (confira empresa, tipo e id).')
      return { ok: true, ...shapeExpense(data as Row, a.tipo, table === 'fdmc_entries' ? 'entry_date' : 'due_date') }
    },
  },
  {
    name: 'fin_resumo_mes',
    description: 'Resumo do mês: receitas (recebidas e previstas), custo operacional, pró-labore, reinvestimento, aplicação, total de despesas, sobra, o que falta pagar/receber e o que está atrasado.',
    inputSchema: {
      type: 'object',
      properties: { empresa: empresaProp, mes: { type: 'string', description: 'AAAA-MM (padrão: mês atual).' } },
      required: ['empresa'],
      additionalProperties: false,
    },
    async run(a) {
      const emp = empresa(a.empresa)
      const mes = a.mes === undefined ? todayBR().slice(0, 7) : (isMonth(a.mes) ? a.mes : fail('"mes" deve estar no formato AAAA-MM.'))
      const { from, to } = monthRange(mes)
      const db = createServiceClient()
      let rev: { amount: number; paid: boolean; due: string }[] = []
      let exp: { amount: number; paid: boolean; due: string; cat: string }[] = []
      if (emp === 'owl') {
        const [e, c] = await Promise.all([
          db.from('expenses').select('amount, paid_at, due_date, category').gte('due_date', from).lte('due_date', to),
          db.from('charges').select('amount, paid_at, due_date, services(active)').gte('due_date', from).lte('due_date', to),
        ])
        exp = (e.data ?? []).map(r => ({ amount: Number(r.amount), paid: !!r.paid_at, due: r.due_date, cat: r.category }))
        rev = ((c.data ?? []) as unknown as { amount: number; paid_at: string | null; due_date: string; services: { active: boolean } | null }[])
          .filter(r => r.paid_at || r.services?.active !== false)
          .map(r => ({ amount: Number(r.amount), paid: !!r.paid_at, due: r.due_date }))
      } else {
        const { data } = await db.from('fdmc_entries').select('type, amount, paid_at, entry_date, category').gte('entry_date', from).lte('entry_date', to)
        for (const r of data ?? []) {
          if (r.type === 'receita') rev.push({ amount: Number(r.amount), paid: !!r.paid_at, due: r.entry_date })
          else exp.push({ amount: Number(r.amount), paid: !!r.paid_at, due: r.entry_date, cat: r.category ?? 'outro' })
        }
      }
      const sum = <T extends { amount: number }>(l: T[]) => Math.round(l.reduce((s, x) => s + x.amount, 0) * 100) / 100
      const today = todayBR()
      const notAplic = exp.filter(x => x.cat !== 'aplicacao')
      const block = (onlyPaid: boolean) => {
        const pick = <T extends { paid: boolean }>(l: T[]) => (onlyPaid ? l.filter(x => x.paid) : l)
        const custo = sum(pick(notAplic.filter(x => x.cat !== 'reinvestimento')))
        const reinvest = sum(pick(notAplic.filter(x => x.cat === 'reinvestimento')))
        const receitas = sum(pick(rev))
        return { receitas: brl(receitas), custo_operacional: brl(custo), reinvestimento: brl(reinvest), total_despesas: brl(custo + reinvest), sobra: brl(receitas - custo - reinvest) }
      }
      return {
        empresa: emp,
        mes,
        realizado: block(true),
        previsto: block(false),
        pro_labore: brl(sum(exp.filter(x => x.cat === 'prolabore'))),
        aplicado: brl(sum(exp.filter(x => x.cat === 'aplicacao'))),
        a_receber: brl(sum(rev.filter(x => !x.paid))),
        a_pagar: brl(sum(exp.filter(x => !x.paid))),
        receitas_atrasadas: rev.filter(x => !x.paid && x.due < today).length,
        despesas_atrasadas: exp.filter(x => !x.paid && x.due < today).length,
        observacao: 'Custo operacional inclui pró-labore (equipe, pró-labore, fixos e variáveis). Aplicação/aporte não é despesa.',
      }
    },
  },
]
