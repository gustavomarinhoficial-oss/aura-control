import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().split('T')[0]
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  const { data: service, error } = await supabase
    .from('services')
    .insert({
      client_id: body.client_id,
      name: body.name,
      type: body.type,
      amount: body.amount,
      recurrence: body.recurrence || null,
      started_at: body.started_at,
      contract_end: body.contract_end || null,
      active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Gerar cobranÃ§as automÃ¡ticas para serviÃ§os recorrentes
  if (body.type === 'recorrente' && body.started_at) {
    const monthStep = body.recurrence === 'trimestral' ? 3 : body.recurrence === 'anual' ? 12 : 1
    const horizon = 6 // gerar 6 perÃ­odos Ã  frente
    const contractEnd = body.contract_end ? new Date(body.contract_end + 'T12:00:00Z') : null
    const today = new Date().toISOString().split('T')[0]

    // Usa billing_day do body, ou busca do cliente como fallback
    let billingDay: number | null = body.billing_day ? parseInt(body.billing_day) : null
    if (!billingDay && body.client_id) {
      const { data: clientData } = await supabase.from('clients').select('billing_day').eq('id', body.client_id).single()
      if (clientData?.billing_day) billingDay = clientData.billing_day
    }

    const charges: { client_id: string; service_id: string; description: string; amount: number; due_date: string; status: string }[] = []

    let dueDate: string
    if (billingDay && billingDay >= 1 && billingDay <= 28) {
      // Usa o dia de vencimento especÃ­fico: prÃ³xima ocorrÃªncia desse dia a partir de hoje
      const todayDate = new Date(today + 'T12:00:00Z')
      const candidate = new Date(todayDate)
      candidate.setUTCDate(billingDay)
      if (candidate.toISOString().split('T')[0] <= today) {
        // JÃ¡ passou este mÃªs, vai para o prÃ³ximo
        candidate.setUTCMonth(candidate.getUTCMonth() + 1)
        candidate.setUTCDate(billingDay)
      }
      dueDate = candidate.toISOString().split('T')[0]
    } else {
      // Sem dia fixo: comeÃ§a 1 dia apÃ³s o inÃ­cio e avanÃ§a atÃ© o futuro
      dueDate = addDays(body.started_at, 1)
      while (dueDate < today) {
        dueDate = addMonths(dueDate, monthStep)
      }
    }

    for (let i = 0; i < horizon; i++) {
      const dueDateObj = new Date(dueDate + 'T12:00:00Z')
      if (contractEnd && dueDateObj > contractEnd) break

      charges.push({
        client_id: body.client_id,
        service_id: service.id,
        description: service.name,
        amount: body.amount,
        due_date: dueDate,
        status: 'pendente',
      })

      dueDate = addMonths(dueDate, monthStep)
    }

    if (charges.length > 0) {
      await supabase.from('charges').insert(charges)
    }
  }

  return NextResponse.json(service, { status: 201 })
}
