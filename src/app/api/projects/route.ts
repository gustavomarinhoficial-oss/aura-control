import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*, clients(id, name)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { data, error } = await supabase.from('projects').insert({
    client_id: body.client_id || null,
    title: body.title,
    description: body.description || null,
    status: body.status || 'afazer',
    deadline: body.deadline || null,
    owner: body.owner || null,
    responsaveis: body.responsaveis ?? [],
    checklist: body.checklist ?? [],
  }).select('*, clients(id, name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
