import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().split('T')[0]
}

function withBillingDay(dateStr: string, billingDay: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(billingDay)
  return d.toISOString().split('T')[0]
}

export async function POST() {
  const supabase = await createServiceClient()
  const today = new Date().toISOString().split('T')[0]
  // Manter sempre 3 meses de cobranças à frente
  const futureLimit = addMonths(today, 3)

  // Busca todos os serviços recorrentes ativos com billing_day do cliente
  const { data: services, error } = await supabase
    .from('services')
    .select('*, clients(billing_day)')
    .eq('type', 'recorrente')
    .eq('active', true)

  if (error || !services?.length) return NextResponse.json({ generated: 0 })

  let totalGenerated = 0

  for (const service of services) {
    const monthStep = service.recurrence === 'trimestral' ? 3 : service.recurrence === 'anual' ? 12 : 1
    const billingDay: number | null = (service.clients as { billing_day?: number | null } | null)?.billing_day ?? null
    const contractEnd = service.contract_end ? new Date(service.contract_end + 'T12:00:00Z') : null

    // Busca a cobrança mais recente deste serviço
    const { data: latest } = await supabase
      .from('charges')
      .select('due_date')
      .eq('service_id', service.id)
      .order('due_date', { ascending: false })
      .limit(1)

    // Se já tem cobrança cobrindo até o futureLimit, pula
    if (latest?.length && latest[0].due_date >= futureLimit) continue

    // Determina o ponto de partida
    let dueDate: string
    if (latest?.length) {
      // Avança a partir da última cobrança existente
      dueDate = addMonths(latest[0].due_date, monthStep)
      if (billingDay) dueDate = withBillingDay(dueDate, billingDay)
    } else {
      // Sem cobranças: calcula a primeira data de vencimento
      if (billingDay) {
        const candidate = new Date(today + 'T12:00:00Z')
        candidate.setUTCDate(billingDay)
        if (candidate.toISOString().split('T')[0] <= today) {
          candidate.setUTCMonth(candidate.getUTCMonth() + 1)
          candidate.setUTCDate(billingDay)
        }
        dueDate = candidate.toISOString().split('T')[0]
      } else {
        dueDate = addMonths(service.started_at, 1)
        while (dueDate < today) dueDate = addMonths(dueDate, monthStep)
      }
    }

    // Gera cobranças até o futureLimit
    const newCharges: { client_id: string; service_id: string; description: string; amount: number; due_date: string; status: string }[] = []
    while (dueDate <= futureLimit) {
      if (contractEnd && new Date(dueDate + 'T12:00:00Z') > contractEnd) break
      newCharges.push({
        client_id: service.client_id,
        service_id: service.id,
        description: service.name,
        amount: service.amount,
        due_date: dueDate,
        status: 'pendente',
      })
      dueDate = addMonths(dueDate, monthStep)
      if (billingDay) dueDate = withBillingDay(dueDate, billingDay)
    }

    if (newCharges.length > 0) {
      await supabase.from('charges').insert(newCharges)
      totalGenerated += newCharges.length
    }
  }

  return NextResponse.json({ generated: totalGenerated })
}
