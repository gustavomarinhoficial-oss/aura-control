import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { effectiveUnlockedMonth } from '@/lib/utils/contentUnlock'

// GET /api/public/content?token=X
// Retorna só os posts do cliente dono do token — nunca outros clientes,
// nunca dados internos (notas, responsável, métricas). Posts de meses
// futuros ainda não liberados ficam de fora (ver effectiveUnlockedMonth).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: client } = await supabase.from('clients').select('id, name, content_unlocked_month, content_approval_enabled, project_sharing_enabled').eq('share_token', token).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })

  const { data: allPosts, error } = await supabase
    .from('content_posts')
    .select('id, title, caption, platform, content_type, status, scheduled_date, scheduled_time, published_at, media_url, media_urls, rejection_reason, rejection_images, caption_edited_by_client, created_at')
    .eq('client_id', client.id)
    .order('scheduled_date', { ascending: true, nullsFirst: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const unlockedMonth = effectiveUnlockedMonth(client.content_unlocked_month)
  const posts = (allPosts ?? []).filter(p => !p.scheduled_date || p.scheduled_date.slice(0, 7) <= unlockedMonth)
  const hiddenCount = (allPosts?.length ?? 0) - posts.length

  return NextResponse.json({
    client: { id: client.id, name: client.name },
    posts,
    unlockedMonth,
    hiddenCount,
    canReview: client.content_approval_enabled === true,
    canViewSchedule: client.project_sharing_enabled === true,
  })
}
