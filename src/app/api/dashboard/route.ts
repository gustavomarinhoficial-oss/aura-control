import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const monthStart = `${currentMonth}-01`
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0]
  const next7 = new Date(today)
  next7.setDate(next7.getDate() + 7)

  const [clientsRes, servicesRes, chargesMonthRes, overdueRes, upcomingRes, churnedClientsRes, churnedServicesRes] = await Promise.all([
    supabase.from('clients').select('id, status'),
    supabase.from('services').select('amount, type, active').eq('active', true).eq('type', 'recorrente'),
    supabase.from('charges').select('amount, paid_at, status, due_date').gte('due_date', monthStart).lte('due_date', monthEnd),
    supabase.from('charges').select('id').is('paid_at', null).lt('due_date', today.toISOString().split('T')[0]),
    supabase.from('charges').select('*, clients(name)').is('paid_at', null).neq('status', 'atrasado').gte('due_date', today.toISOString().split('T')[0]).lte('due_date', next7.toISOString().split('T')[0]).order('due_date'),
    // Clientes que cancelaram/ficaram inativos este mÃªs (via histÃ³rico)
    supabase.from('client_status_history').select('client_id').eq('new_status', 'cancelado').gte('changed_at', monthStart).lte('changed_at', monthEnd),
    // ServiÃ§os recorrentes encerrados este mÃªs (MRR churn)
    supabase.from('services').select('amount').eq('active', false).eq('type', 'recorrente').gte('ended_at', monthStart).lte('ended_at', monthEnd),
  ])

  // Antes essas consultas falhando silenciosamente virava um dashboard com
  // tudo zerado (MRR, receita, etc) sem avisar nada -- parecia dado real e
  // nao era. Se alguma falhar (ex: banco acordando de uma pausa por
  // inatividade), devolve erro de verdade em vez de fingir que esta tudo a zero.
  const failed = [
    ['clients', clientsRes], ['services', servicesRes], ['charges (mes)', chargesMonthRes],
    ['charges (atraso)', overdueRes], ['charges (proximas)', upcomingRes],
    ['client_status_history', churnedClientsRes], ['services (churn)', churnedServicesRes],
  ].find(([, res]) => (res as { error: unknown }).error)
  if (failed) {
    const [label, res] = failed as [string, { error: { message: string } }]
    return NextResponse.json({ error: `Falha ao consultar ${label}: ${res.error.message}` }, { status: 500 })
  }

  const activeClients = (clientsRes.data ?? []).filter(c => c.status === 'ativo').length
  const mrr = (servicesRes.data ?? []).reduce((sum, s) => sum + Number(s.amount), 0)

  // Churn
  const clientChurn = (churnedClientsRes.data ?? []).length
  const mrrChurn = (churnedServicesRes.data ?? []).reduce((sum, s) => sum + Number(s.amount), 0)
  const charges = chargesMonthRes.data ?? []
  const estimatedMonth = charges.reduce((sum, c) => sum + Number(c.amount), 0)
  const receivedMonth = charges.filter(c => c.paid_at).reduce((sum, c) => sum + Number(c.amount), 0)
  const overdueCount = (overdueRes.data ?? []).length

  // Receita realizada por mÃªs nos Ãºltimos 6 meses -- consultas em paralelo
  // (antes eram sequenciais, uma esperando a outra, deixando essa rota lenta)
  const last6Months = Array.from({ length: 6 }, (_, idx) => {
    const i = 5 - idx
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const mStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
    return { d, mStart, mEnd }
  })
  const monthResults = await Promise.all(
    last6Months.map(({ mStart, mEnd }) =>
      supabase.from('charges').select('amount').not('paid_at', 'is', null).gte('paid_at', mStart).lte('paid_at', mEnd)
    )
  )
  const failedMonth = monthResults.find(res => res.error)
  if (failedMonth) {
    return NextResponse.json({ error: `Falha ao consultar gráfico de receita: ${failedMonth.error!.message}` }, { status: 500 })
  }
  const chartData = last6Months.map(({ d }, idx) => ({
    month: d.toLocaleDateString('pt-BR', { month: 'short' }),
    value: (monthResults[idx].data ?? []).reduce((sum, c) => sum + Number(c.amount), 0),
  }))

  return NextResponse.json({
    activeClients,
    mrr,
    estimatedMonth,
    receivedMonth,
    overdueCount,
    clientChurn,
    mrrChurn,
    chartData,
    upcoming: upcomingRes.data ?? [],
  })
}
