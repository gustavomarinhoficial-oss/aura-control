import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { flattenAssignees } from '@/lib/utils/tasks'

const SELECT_WITH_ASSIGNEES = '*, clients(id, name), task_assignees(members(id, name, initials, color))'

export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('tasks')
    .select(SELECT_WITH_ASSIGNEES)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) {
    // Se task_assignees ainda não existe (migration pendente), tenta sem o join
    if (error.message?.includes('task_assignees')) {
      let q2 = supabase
        .from('tasks')
        .select('*, clients(id, name)')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (clientId) q2 = q2.eq('client_id', clientId)
      const { data: d2, error: e2 } = await q2
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      return NextResponse.json((d2 ?? []).map(t => ({ ...t, assignees: [] })))
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json((data ?? []).map(flattenAssignees))
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  const insert: Record<string, unknown> = {
    title: body.title,
    description: body.description || null,
    client_id: body.client_id || null,
    is_global: body.is_global ?? false,
    status: body.status || 'pendente',
    priority: body.priority || 'media',
    due_date: body.due_date || null,
  }

  const { data: task, error } = await supabase.from('tasks').insert(insert).select('*, clients(id, name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const assigneeIds: string[] = Array.isArray(body.assignee_ids) ? body.assignee_ids.filter(Boolean) : []
  if (assigneeIds.length > 0) {
    const { error: aErr } = await supabase
      .from('task_assignees')
      .insert(assigneeIds.map(member_id => ({ task_id: task.id, member_id })))
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })
  }

  const { data: full } = await supabase.from('tasks').select(SELECT_WITH_ASSIGNEES).eq('id', task.id).single()
  return NextResponse.json(full ? flattenAssignees(full) : { ...task, assignees: [] }, { status: 201 })
}
