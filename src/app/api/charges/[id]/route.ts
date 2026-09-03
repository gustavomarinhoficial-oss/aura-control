import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

function dayBefore(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().split('T')[0]
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  // Encerra a recorrência do serviço a partir de um mês: apaga essa cobrança
  // e as futuras ainda não pagas do mesmo serviço, e trava o /api/charges/generate
  // de criar novas a partir dali (mesmo padrão usado pra despesas recorrentes).
  if (body.action === 'stop_recurrence') {
    const fromDate = body.from_date as string
    if (!fromDate) return NextResponse.json({ error: 'from_date obrigatório' }, { status: 400 })

    const { data: current, error: findError } = await supabase.from('charges').select('service_id').eq('id', id).single()
    if (findError) return NextResponse.json({ error: findError.message }, { status: 500 })
    if (!current.service_id) return NextResponse.json({ error: 'Esta cobrança não é de um serviço recorrente' }, { status: 400 })

    await supabase.from('services').update({ contract_end: dayBefore(fromDate) }).eq('id', current.service_id)
    await supabase.from('charges').delete().eq('service_id', current.service_id).is('paid_at', null).gte('due_date', fromDate)

    return NextResponse.json({ ok: true })
  }

  const updates: Record<string, unknown> = {}

  if (body.action === 'pay') {
    updates.paid_at = new Date().toISOString()
    updates.status = 'pago'
  } else if (body.action === 'unpay') {
    updates.paid_at = null
    updates.status = 'pendente'
  } else {
    if (body.description !== undefined) updates.description = body.description
    if (body.amount !== undefined) updates.amount = body.amount
    if (body.due_date !== undefined) updates.due_date = body.due_date
  }

  const { data, error } = await supabase
    .from('charges')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('charges').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
