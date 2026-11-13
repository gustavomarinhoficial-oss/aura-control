import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { requireFdmcAccess } from '@/lib/fdmc/auth'
import { addMonthsClamped, installmentAmounts, parseInstallments } from '@/lib/finance/installments'

const HORIZON_MONTHS = 3

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().split('T')[0]
}

export async function GET(request: Request) {
  if (!(await requireFdmcAccess())) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // YYYY-MM

  const supabase = createServiceClient()
  let query = supabase
    .from('fdmc_entries')
    .select('*')
    .order('entry_date', { ascending: true })
    .order('created_at', { ascending: true })

  if (month) {
    const monthStart = `${month}-01`
    query = query.gte('entry_date', monthStart).lt('entry_date', addMonths(monthStart, 1))
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  if (!(await requireFdmcAccess())) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const supabase = createServiceClient()
  const body = await request.json()

  if (!body.description || !body.amount || !body.entry_date || !['receita', 'despesa'].includes(body.type)) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  // Parcelado em N vezes (só despesa): cria as N parcelas de uma vez, uma por mês, ligadas pelo mesmo grupo
  if (body.installments !== undefined && body.installments !== null) {
    const n = parseInstallments(body.installments)
    if (!n) return NextResponse.json({ error: 'Parcelas: informe um número inteiro de 2 a 60.' }, { status: 400 })
    if (body.type !== 'despesa') return NextResponse.json({ error: 'Só despesa pode ser parcelada.' }, { status: 400 })
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
    if (error) return NextResponse.json({ error: `${error.message}. Se for sobre "installment", rode o SQL da migration 056.` }, { status: 500 })
    return NextResponse.json(data?.[0] ?? null, { status: 201 })
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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

  return NextResponse.json(data, { status: 201 })
}
