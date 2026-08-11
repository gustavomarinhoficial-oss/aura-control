import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  const update: Record<string, unknown> = {}
  if (body.title !== undefined) update.title = body.title
  if (body.description !== undefined) update.description = body.description
  if (body.status !== undefined) update.status = body.status
  if (body.priority !== undefined) update.priority = body.priority
  if (body.due_date !== undefined) update.due_date = body.due_date || null
  if (body.client_id !== undefined) update.client_id = body.client_id || null
  if (body.is_global !== undefined) update.is_global = body.is_global
  if (body.assignee_id !== undefined) update.assignee_id = body.assignee_id || null

  const { data, error } = await supabase
    .from('tasks')
    .update(update)
    .eq('id', id)
    .select('*, clients(id, name), members(id, name, initials, color)')
    .single()

  if (error) {
    if (error.message?.includes('members')) {
      const { data: d2, error: e2 } = await supabase.from('tasks').update(update).eq('id', id).select('*, clients(id, name)').single()
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      return NextResponse.json(d2)
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
