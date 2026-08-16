import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { flattenAssignees } from '@/lib/utils/tasks'

const SELECT_WITH_ASSIGNEES = '*, clients(id, name), task_assignees(members(id, name, initials, color))'

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

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from('tasks').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (body.assignee_ids !== undefined) {
    const assigneeIds: string[] = Array.isArray(body.assignee_ids) ? body.assignee_ids.filter(Boolean) : []
    const { error: delErr } = await supabase.from('task_assignees').delete().eq('task_id', id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    if (assigneeIds.length > 0) {
      const { error: insErr } = await supabase
        .from('task_assignees')
        .insert(assigneeIds.map(member_id => ({ task_id: id, member_id })))
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  const { data, error } = await supabase.from('tasks').select(SELECT_WITH_ASSIGNEES).eq('id', id).single()
  if (error) {
    if (error.message?.includes('task_assignees')) {
      const { data: d2, error: e2 } = await supabase.from('tasks').select('*, clients(id, name)').eq('id', id).single()
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      return NextResponse.json({ ...d2, assignees: [] })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(flattenAssignees(data))
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
