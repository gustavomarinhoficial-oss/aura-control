import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('content_posts')
    .select('*, clients(id, name)')
    .order('scheduled_date', { ascending: false, nullsFirst: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('content_posts')
    .insert({
      client_id:      body.client_id,
      title:          body.title,
      caption:        body.caption || null,
      platform:       body.platform || 'instagram',
      status:         body.status || 'rascunho',
      scheduled_date: body.scheduled_date || null,
      scheduled_time: body.scheduled_time || null,
      published_at:   body.published_at || null,
      responsible:    body.responsible || null,
      result:         body.result ?? {},
      notes:          body.notes || null,
      media_url:      body.media_url || null,
      media_urls:     body.media_urls ?? [],
    })
    .select('*, clients(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
