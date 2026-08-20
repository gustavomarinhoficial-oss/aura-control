import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ALLOWED_STATUSES = ['aprovado', 'reprovado']

const PUBLIC_SELECT = 'id, title, caption, platform, status, scheduled_date, published_at, media_url, media_urls, rejection_reason, created_at'

// PATCH /api/public/content/[id]  { token, status, reason? }
// Só permite aprovar/reprovar, e só o post pertencer mesmo ao cliente do token.
// Reprovar exige motivo (não vazio) — fica salvo pra equipe ver no interno.
// Nenhum outro campo (título, legenda, cliente etc) pode ser alterado por aqui.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const token = body.token as string | undefined
  const status = body.status as string | undefined
  const reason = (body.reason as string | undefined)?.trim()

  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }
  if (status === 'reprovado' && !reason) {
    return NextResponse.json({ error: 'Informe o motivo da reprovação' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: client } = await supabase.from('clients').select('id').eq('share_token', token).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })

  const { data: post } = await supabase.from('content_posts').select('id, client_id').eq('id', id).maybeSingle()
  if (!post || post.client_id !== client.id) {
    return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })
  }

  const { data: updated, error } = await supabase
    .from('content_posts')
    .update({
      status,
      rejection_reason: status === 'reprovado' ? reason : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(PUBLIC_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(updated)
}
