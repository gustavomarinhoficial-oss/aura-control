import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  const allowed = ['title', 'caption', 'platform', 'content_type', 'status', 'scheduled_date', 'scheduled_time', 'published_at', 'responsible', 'result', 'notes', 'client_id', 'media_url', 'media_urls', 'rejection_reason', 'rejection_images', 'post_link']
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) update[key] = body[key] === '' ? null : body[key]
  }
  // Time editou a legenda aqui dentro (rota interna) — já "viu" o ajuste do
  // cliente, então some com o aviso "Legenda ajustada"
  if ('caption' in body) update.caption_edited_by_client = false

  const { data, error } = await supabase
    .from('content_posts')
    .update(update)
    .eq('id', id)
    .select('*, clients(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('content_posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
