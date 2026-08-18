import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  if (body.action === 'pay') {
    const { data, error } = await supabase
      .from('expenses').update({ paid_at: new Date().toISOString() }).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }
  if (body.action === 'unpay') {
    const { data, error } = await supabase
      .from('expenses').update({ paid_at: null }).eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const allowed = ['description', 'amount', 'category', 'due_date', 'recurrent', 'notes']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }
  if ('amount' in update) update.amount = Number(update.amount)

  const { data, error } = await supabase.from('expenses').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Valor mudou com data de vigência: atualiza as parcelas futuras não pagas
  // da mesma despesa recorrente a partir dessa data (mesmo padrão de serviços/cobranças)
  if (body.amount !== undefined && body.effective_date && data.recurrence_group) {
    await supabase
      .from('expenses')
      .update({ amount: Number(body.amount) })
      .eq('recurrence_group', data.recurrence_group)
      .is('paid_at', null)
      .gte('due_date', body.effective_date)
      .neq('id', id)
  }

  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
