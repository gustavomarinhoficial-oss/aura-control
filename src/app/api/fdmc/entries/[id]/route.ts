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

  const allowed = ['type', 'description', 'amount', 'entry_date', 'notes']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }
  if ('amount' in update) update.amount = Number(update.amount)

  const { data, error } = await supabase.from('fdmc_entries').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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
