import { createServiceClient } from '@/lib/supabase/server'

export interface CashFlow {
  month: string
  carryOver: number     // sobrou dos meses anteriores (o "caixa" que vira junto)
  received: number      // entrou no mês (receitas recebidas)
  spent: number         // saiu em despesas (sem pró-labore e sem aplicação)
  prolabore: number     // saiu em pró-labore
  invested: number      // foi aplicado / aporte no mês
  final: number         // saldo final do mês
  investedTotal: number // total já aplicado (acumulado)
  openingBalance: number
  flowStartMonth: string | null
}

interface PaidRow { month: string; kind: 'in' | 'spent' | 'prolabore' | 'invested'; amount: number }

// Só conta o que já foi pago/recebido. O mês de cada lançamento é o do vencimento,
// o mesmo critério dos cartões do Financeiro.
async function paidRows(workspace: 'owl' | 'fdmc'): Promise<PaidRow[]> {
  const db = createServiceClient()
  const rows: PaidRow[] = []
  const classify = (category: string | null): PaidRow['kind'] =>
    category === 'prolabore' ? 'prolabore' : category === 'aplicacao' ? 'invested' : 'spent'

  if (workspace === 'fdmc') {
    const { data } = await db.from('fdmc_entries').select('type, amount, category, entry_date').not('paid_at', 'is', null)
    for (const r of data ?? []) {
      rows.push({ month: String(r.entry_date).slice(0, 7), kind: r.type === 'receita' ? 'in' : classify(r.category), amount: Number(r.amount) })
    }
  } else {
    const [charges, expenses] = await Promise.all([
      db.from('charges').select('amount, due_date').not('paid_at', 'is', null),
      db.from('expenses').select('amount, due_date, category').not('paid_at', 'is', null),
    ])
    for (const c of charges.data ?? []) rows.push({ month: String(c.due_date).slice(0, 7), kind: 'in', amount: Number(c.amount) })
    for (const e of expenses.data ?? []) rows.push({ month: String(e.due_date).slice(0, 7), kind: classify(e.category), amount: Number(e.amount) })
  }
  return rows
}

export async function computeCashFlow(workspace: 'owl' | 'fdmc', month: string): Promise<CashFlow> {
  const db = createServiceClient()
  const [rows, settingsRes] = await Promise.all([
    paidRows(workspace),
    db.from('available_cash').select('opening_balance, flow_start_month').eq('workspace', workspace).maybeSingle(),
  ])
  const openingBalance = Number(settingsRes.data?.opening_balance ?? 0)
  const flowStartMonth = (settingsRes.data?.flow_start_month as string | null) ?? null

  // lançamentos antes do ponto de partida não entram na conta
  const counted = rows.filter(r => !flowStartMonth || r.month >= flowStartMonth)
  const net = (r: PaidRow) => (r.kind === 'in' ? r.amount : -r.amount)

  const startsAfter = !!flowStartMonth && month < flowStartMonth
  const carryOver = startsAfter ? 0 : openingBalance + counted.filter(r => r.month < month).reduce((s, r) => s + net(r), 0)

  const inMonth = counted.filter(r => r.month === month)
  const sum = (kind: PaidRow['kind']) => inMonth.filter(r => r.kind === kind).reduce((s, r) => s + r.amount, 0)
  const received = sum('in')
  const spent = sum('spent')
  const prolabore = sum('prolabore')
  const invested = sum('invested')

  return {
    month,
    carryOver,
    received,
    spent,
    prolabore,
    invested,
    final: carryOver + received - spent - prolabore - invested,
    investedTotal: counted.filter(r => r.kind === 'invested').reduce((s, r) => s + r.amount, 0),
    openingBalance,
    flowStartMonth,
  }
}
