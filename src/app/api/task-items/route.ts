import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const taskId = searchParams.get('task_id')
  if (!taskId) return NextResponse.json({ error: 'task_id required' }, { status: 400 })
  const { data, error } = await supabase
    .from('task_items')
    .select('*')
    .eq('task_id', taskId)
    .order('position')
  if (error) return NextResponse.json([]) // tabela pode nÃ£o existir ainda
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { data: existing } = await supabase
    .from('task_items')
    .select('position')
    .eq('task_id', body.task_id)
    .order('position', { ascending: false })
    .limit(1)
  const nextPos = existing && existing.length > 0 ? existing[0].position + 1 : 0
  const { data, error } = await supabase
    .from('task_items')
    .insert({ task_id: body.task_id, title: body.title, completed: false, position: nextPos })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
