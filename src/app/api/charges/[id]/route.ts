import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServiceClient()
  const body = await request.json()

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
  const supabase = await createServiceClient()
  const { error } = await supabase.from('charges').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
