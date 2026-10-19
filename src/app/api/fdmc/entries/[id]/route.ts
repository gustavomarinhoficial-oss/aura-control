import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireFdmcAccess } from '@/lib/fdmc/auth'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireFdmcAccess())) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  if (body.action === 'pay') {
    const { data, error } = await supabase
      .from('fdmc_entries').update({ paid_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }
  if (body.action === 'unpay') {
    const { data, error } = await supabase
      .from('fdmc_entries').update({ paid_at: null }).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Encerra a recorrência a partir de uma data: apaga as parcelas futuras não pagas e trava novas.
  if (body.action === 'stop_recurrence') {
    const fromDate = body.from_date as string
    if (!fromDate) return NextResponse.json({ error: 'from_date obrigatório' }, { status: 400 })
    const { data: current, error: findError } = await supabase.from('fdmc_entries').select('recurrence_group').eq('id', id).single()
    if (findError) return NextResponse.json({ error: findError.message }, { status: 500 })
    if (!current.recurrence_group) return NextResponse.json({ error: 'Este lançamento não é recorrente' }, { status: 400 })
    await supabase.from('fdmc_entries').update({ recurrence_end_date: fromDate }).eq('recurrence_group', current.recurrence_group)
    await supabase.from('fdmc_entries').delete().eq('recurrence_group', current.recurrence_group).is('paid_at', null).gte('entry_date', fromDate)
    return NextResponse.json({ ok: true })
  }

  const allowed = ['type', 'description', 'amount', 'entry_date', 'notes', 'category']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }
  if ('amount' in update) update.amount = Number(update.amount)

  const { data, error } = await supabase.from('fdmc_entries').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Valor mudou "daqui pra frente": atualiza as parcelas futuras não pagas do mesmo grupo
  if (body.amount !== undefined && body.effective_date && data.recurrence_group) {
    await supabase
      .from('fdmc_entries')
      .update({ amount: Number(body.amount) })
      .eq('recurrence_group', data.recurrence_group)
      .is('paid_at', null)
      .gte('entry_date', body.effective_date)
      .neq('id', id)
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireFdmcAccess())) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('fdmc_entries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
