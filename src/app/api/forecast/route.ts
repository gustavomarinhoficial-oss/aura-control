import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServiceClient()

  // Buscar todos os serviços recorrentes ativos
  // Tenta com contract_end (após migration 003), senão cai para sem ele
  let servicesResult = await supabase
    .from('services')
    .select('id, name, amount, recurrence, started_at, contract_end, client_id')
    .eq('active', true)
    .eq('type', 'recorrente')

  if (servicesResult.error?.message?.includes('contract_end')) {
    servicesResult = await supabase
      .from('services')
      .select('id, name, amount, recurrence, started_at, client_id')
      .eq('active', true)
      .eq('type', 'recorrente') as typeof servicesResult
  }

  if (servicesResult.error) return NextResponse.json({ error: servicesResult.error.message }, { status: 500 })
  const services = servicesResult.data

  // Buscar cobranças já pagas nos próximos 3 meses para marcar como recebido
  const today = new Date()
  const end = new Date(today)
  end.setUTCMonth(end.getUTCMonth() + 3)

  const { data: paidCharges } = await supabase
    .from('charges')
    .select('amount, due_date')
    .not('paid_at', 'is', null)
    .gte('due_date', today.toISOString().split('T')[0])
    .lte('due_date', end.toISOString().split('T')[0])

  // Montar projeção mês a mês (3 meses)
  const months: { label: string; key: string; valor: number; recebido: number }[] = []
  for (let i = 0; i < 3; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    months.push({ label, key, valor: 0, recebido: 0 })
  }

  // Para cada serviço, calcular em quais meses vai gerar receita
  for (const svc of services ?? []) {
    const step = svc.recurrence === 'trimestral' ? 3 : svc.recurrence === 'anual' ? 12 : 1
    const contractEnd = (svc as { contract_end?: string | null }).contract_end ? new Date(((svc as { contract_end?: string }).contract_end as string) + 'T12:00:00Z') : null

    for (const mo of months) {
      const moDate = new Date(mo.key + '-01T12:00:00Z')
      if (contractEnd && moDate > contractEnd) continue

      // Para recorrência mensal, sempre conta
      // Para trimestral: conta se o mês está na sequência do started_at
      const startDate = new Date(svc.started_at + 'T12:00:00Z')
      const diffMonths = (moDate.getFullYear() - startDate.getFullYear()) * 12 + (moDate.getMonth() - startDate.getMonth())
      if (diffMonths >= 0 && diffMonths % step === 0) {
        mo.valor += Number(svc.amount)
      }
    }
  }

  // Somar cobranças já pagas nesse período
  for (const charge of paidCharges ?? []) {
    const moKey = charge.due_date.slice(0, 7)
    const mo = months.find(m => m.key === moKey)
    if (mo) mo.recebido += Number(charge.amount)
  }

  return NextResponse.json(months.map(m => ({ label: m.label, valor: m.valor, recebido: m.recebido })))
}
