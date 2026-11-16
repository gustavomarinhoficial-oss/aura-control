import { randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { addMonthsClamped, installmentAmounts, parseInstallments } from '@/lib/finance/installments'

// Criação de lançamentos do Financeiro (OWL e FDMC), usada pelas telas e pelo conector do Claude.
// À vista, parcelado em N vezes (cria todas as parcelas) ou recorrente (gera 3 meses à frente; o resto vem com o tempo).

export type CreateResult = { ok: true; data: Record<string, unknown> } | { ok: false; error: string; status: number }

const HORIZON_MONTHS = 3

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().split('T')[0]
}

const isDate = (v: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(String(v ?? ''))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Body = Record<string, any>

export async function createOwlExpense(body: Body): Promise<CreateResult> {
  const supabase = createServiceClient()

  // Parcelado em N vezes: cria as N parcelas de uma vez (uma por mês), todas ligadas pelo mesmo grupo
  if (body.installments !== undefined && body.installments !== null) {
    const n = parseInstallments(body.installments)
    if (!n) return { ok: false, error: 'Parcelas: informe um número inteiro de 2 a 60.', status: 400 }
    if (!body.description || !(Number(body.amount) > 0) || !isDate(body.due_date)) {
      return { ok: false, error: 'Informe descrição, valor e data da primeira parcela.', status: 400 }
    }
    const group = randomUUID()
    const amounts = installmentAmounts(Number(body.amount), n, body.amount_mode === 'total' ? 'total' : 'parcela')
    const rows = amounts.map((amount, i) => ({
      description: body.description,
      amount,
      category: body.category || 'outro',
      due_date: addMonthsClamped(body.due_date, i),
      paid_at: i === 0 ? (body.paid_at || null) : null,
      recurrent: false,
      recurrence_group: group,
      recurrence_end_date: null,
      notes: body.notes || null,
      installment_number: i + 1,
      installments_total: n,
    }))
    const { data, error } = await supabase.from('expenses').insert(rows).select().order('due_date', { ascending: true })
    if (error) return { ok: false, error: `${error.message}. Se for sobre "installment", rode o SQL da migration 056.`, status: 500 }
    return { ok: true, data: { ...(data?.[0] ?? {}), parcelas_criadas: data?.length ?? 0 } }
  }

  const recurrent = body.recurrent ?? false
  const recurrenceGroup = recurrent ? randomUUID() : null
  // Opcional: até quando repetir (ex: despesa mensal por 6 meses). Vazio = sem prazo.
  const recurrenceEndDate = recurrent && body.recurrence_end_date ? body.recurrence_end_date : null

  const { data, error } = await supabase.from('expenses').insert({
    description: body.description,
    amount: Number(body.amount),
    category: body.category || 'outro',
    due_date: body.due_date,
    paid_at: body.paid_at || null,
    recurrent,
    recurrence_group: recurrenceGroup,
    recurrence_end_date: recurrenceEndDate,
    notes: body.notes || null,
  }).select().single()

  if (error) return { ok: false, error: error.message, status: 500 }

  // Gera as próximas parcelas mensais automaticamente, respeitando o prazo se houver
  if (recurrent && recurrenceGroup) {
    const future = []
    for (let i = 1; i <= HORIZON_MONTHS; i++) {
      const due_date = addMonths(body.due_date, i)
      if (recurrenceEndDate && due_date >= recurrenceEndDate) break
      future.push({
        description: body.description,
        amount: Number(body.amount),
        category: body.category || 'outro',
        due_date,
        recurrent: true,
        recurrence_group: recurrenceGroup,
        recurrence_end_date: recurrenceEndDate,
        notes: body.notes || null,
      })
    }
    if (future.length > 0) await supabase.from('expenses').insert(future)
  }

  return { ok: true, data }
}

export async function createFdmcEntry(body: Body): Promise<CreateResult> {
  const supabase = createServiceClient()

  if (!body.description || !body.amount || !body.entry_date || !['receita', 'despesa'].includes(body.type)) {
    return { ok: false, error: 'Dados incompletos', status: 400 }
  }

  // Parcelado em N vezes (só despesa): cria as N parcelas de uma vez, uma por mês, ligadas pelo mesmo grupo
  if (body.installments !== undefined && body.installments !== null) {
    const n = parseInstallments(body.installments)
    if (!n) return { ok: false, error: 'Parcelas: informe um número inteiro de 2 a 60.', status: 400 }
    if (body.type !== 'despesa') return { ok: false, error: 'Só despesa pode ser parcelada.', status: 400 }
    const group = randomUUID()
    const amounts = installmentAmounts(Number(body.amount), n, body.amount_mode === 'total' ? 'total' : 'parcela')
    const rows = amounts.map((amount, i) => ({
      type: body.type,
      description: body.description,
      amount,
      category: body.category || 'outro',
      notes: body.notes || null,
      recurrent: false,
      recurrence_group: group,
      recurrence_end_date: null,
      entry_date: addMonthsClamped(body.entry_date, i),
      paid_at: i === 0 ? (body.paid_at || null) : null,
      installment_number: i + 1,
      installments_total: n,
    }))
    const { data, error } = await supabase.from('fdmc_entries').insert(rows).select().order('entry_date', { ascending: true })
    if (error) return { ok: false, error: `${error.message}. Se for sobre "installment", rode o SQL da migration 056.`, status: 500 }
    return { ok: true, data: { ...(data?.[0] ?? {}), parcelas_criadas: data?.length ?? 0 } }
  }

  const recurrent = body.recurrent === true
  const group = recurrent ? randomUUID() : null
  const endDate = recurrent && body.recurrence_end_date ? body.recurrence_end_date : null

  const base = {
    type: body.type,
    description: body.description,
    amount: Number(body.amount),
    category: body.category || 'outro',
    notes: body.notes || null,
    recurrent,
    recurrence_group: group,
    recurrence_end_date: endDate,
  }

  const { data, error } = await supabase
    .from('fdmc_entries')
    .insert({ ...base, entry_date: body.entry_date, paid_at: body.paid_at || null })
    .select()
    .single()

  if (error) return { ok: false, error: error.message, status: 500 }

  // Gera as próximas parcelas mensais (respeitando o prazo, se houver)
  if (recurrent && group) {
    const future = []
    for (let i = 1; i <= HORIZON_MONTHS; i++) {
      const entry_date = addMonths(body.entry_date, i)
      if (endDate && entry_date >= endDate) break
      future.push({ ...base, entry_date })
    }
    if (future.length > 0) await supabase.from('fdmc_entries').insert(future)
  }

  return { ok: true, data }
}
