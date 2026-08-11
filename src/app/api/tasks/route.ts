import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('tasks')
    .select('*, clients(id, name), members(id, name, initials, color)')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) {
    // Se members ainda nÃ£o existe (migration pendente), tenta sem o join
    if (error.message?.includes('members')) {
      let q2 = supabase
        .from('tasks')
        .select('*, clients(id, name)')
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (clientId) q2 = q2.eq('client_id', clientId)
      const { data: d2, error: e2 } = await q2
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      return NextResponse.json(d2)
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
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
  if (body.assignee_id !== undefined) insert.assignee_id = body.assignee_id || null

  const { data, error } = await supabase
    .from('tasks')
    .insert(insert)
    .select('*, clients(id, name), members(id, name, initials, color)')
    .single()

  if (error) {
    if (error.message?.includes('members') || error.message?.includes('assignee')) {
      const { data: d2, error: e2 } = await supabase.from('tasks').insert(insert).select('*, clients(id, name)').single()
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      return NextResponse.json(d2, { status: 201 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
