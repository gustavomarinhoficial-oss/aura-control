import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServiceClient()
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
    // Clientes que cancelaram/ficaram inativos este mês (via histórico)
    supabase.from('client_status_history').select('client_id').eq('new_status', 'cancelado').gte('changed_at', monthStart).lte('changed_at', monthEnd),
    // Serviços recorrentes encerrados este mês (MRR churn)
    supabase.from('services').select('amount').eq('active', false).eq('type', 'recorrente').gte('ended_at', monthStart).lte('ended_at', monthEnd),
  ])

  const activeClients = (clientsRes.data ?? []).filter(c => c.status === 'ativo').length
  const mrr = (servicesRes.data ?? []).reduce((sum, s) => sum + Number(s.amount), 0)

  // Churn
  const clientChurn = (churnedClientsRes.data ?? []).length
  const mrrChurn = (churnedServicesRes.data ?? []).reduce((sum, s) => sum + Number(s.amount), 0)
  const charges = chargesMonthRes.data ?? []
  const estimatedMonth = charges.reduce((sum, c) => sum + Number(c.amount), 0)
  const receivedMonth = charges.filter(c => c.paid_at).reduce((sum, c) => sum + Number(c.amount), 0)
  const overdueCount = (overdueRes.data ?? []).length

  // Receita realizada por mês nos últimos 6 meses
  const chartData = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const mStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('charges')
      .select('amount')
      .not('paid_at', 'is', null)
      .gte('paid_at', mStart)
      .lte('paid_at', mEnd)

    chartData.push({
      month: d.toLocaleDateString('pt-BR', { month: 'short' }),
      value: (data ?? []).reduce((sum, c) => sum + Number(c.amount), 0),
    })
  }

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
