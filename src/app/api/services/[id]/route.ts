import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.amount !== undefined) updates.amount = body.amount
  if (body.active !== undefined) updates.active = body.active
  if (body.recurrence !== undefined) updates.recurrence = body.recurrence
  if (body.contract_end !== undefined) updates.contract_end = body.contract_end || null
  if (body.started_at !== undefined) updates.started_at = body.started_at
  if (body.ended_at !== undefined) updates.ended_at = body.ended_at
  if (body.first_charge_date !== undefined) updates.first_charge_date = body.first_charge_date || null

  const { data, error } = await supabase
    .from('services')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Se o valor mudou com data de vigência, atualiza cobranças futuras pendentes
  if (body.amount !== undefined && body.effective_date) {
    await supabase
      .from('charges')
      .update({ amount: body.amount })
      .eq('service_id', id)
      .eq('status', 'pendente')
      .gte('due_date', body.effective_date)
  }

  // Adiou o início da cobrança: remove cobranças ainda não pagas que ficaram
  // antes dessa nova data (não devem existir como pendência no sistema)
  if (body.first_charge_date) {
    await supabase
      .from('charges')
      .delete()
      .eq('service_id', id)
      .is('paid_at', null)
      .lt('due_date', body.first_charge_date)
  }

  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('services').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
