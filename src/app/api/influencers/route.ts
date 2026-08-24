import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('influencers')
    .select('*, clients(id, name)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  if (!body.name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

  const { data, error } = await supabase
    .from('influencers')
    .insert({
      name: body.name,
      niche: body.niche || null,
      instagram: body.instagram || null,
      phone: body.phone || null,
      email: body.email || null,
      client_id: body.client_id || null,
      status: body.status || 'a_contatar',
      value: body.value || null,
      responsible: body.responsible || null,
      notes: body.notes || null,
    })
    .select('*, clients(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
