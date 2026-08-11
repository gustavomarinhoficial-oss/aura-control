import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const { data } = await supabase.from('client_extras').select('*').eq('client_id', id).single()
  return NextResponse.json(data ?? { client_id: id, responsavel: '', objectives: '', social_media: [], links: [], passwords: [] })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  const payload = {
    client_id: id,
    responsavel: body.responsavel ?? '',
    objectives: body.objectives ?? '',
    social_media: body.social_media ?? [],
    links: body.links ?? [],
    passwords: body.passwords ?? [],
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('client_extras')
    .upsert(payload, { onConflict: 'client_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
