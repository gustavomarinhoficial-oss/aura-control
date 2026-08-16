import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: conv } = await db.from('omar_conversations').select('id, user_id').eq('id', id).single()
  if (!conv || conv.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await db
    .from('omar_messages')
    .select('id, role, content, tool_calls, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createServiceClient()
  const { data: conv } = await db.from('omar_conversations').select('id, user_id').eq('id', id).single()
  if (!conv || conv.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await db.from('omar_conversations').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
