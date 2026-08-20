import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/public/content?token=X
// Retorna só os posts do cliente dono do token — nunca outros clientes,
// nunca dados internos (notas, responsável, métricas).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: client } = await supabase.from('clients').select('id, name').eq('share_token', token).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })

  const { data: posts, error } = await supabase
    .from('content_posts')
    .select('id, title, caption, platform, status, scheduled_date, published_at, media_url, media_urls, created_at')
    .eq('client_id', client.id)
    .order('scheduled_date', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ client, posts: posts ?? [] })
}
