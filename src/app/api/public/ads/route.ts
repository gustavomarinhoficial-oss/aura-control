import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { findClientByShare } from '@/lib/shareSlug'
import { PUBLIC_CAMPAIGN_COLS, PUBLIC_CREATIVE_COLS } from '@/lib/ads/server'
import { HIDDEN_FROM_CLIENT } from '@/lib/ads/constants'

// GET /api/public/ads?token=X
// Campanhas de tráfego e criativos só do cliente dono do link. Rascunhos ficam de fora;
// observações internas nunca saem daqui. canReview segue a mesma chave da aprovação de posts.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  const db = createServiceClient()
  const client = await findClientByShare<{ id: string; content_approval_enabled: boolean }>(db, token, 'id, content_approval_enabled')
  if (!client) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })

  const { data: campaigns, error } = await db.from('ad_campaigns')
    .select(PUBLIC_CAMPAIGN_COLS)
    .eq('client_id', client.id)
    .not('status', 'in', `(${HIDDEN_FROM_CLIENT.join(',')})`)
    .order('created_at', { ascending: false })
  // Antes da migration 059 a área simplesmente não aparece pro cliente
  if (error) return NextResponse.json({ campaigns: [], canReview: false })

  const ids = (campaigns ?? []).map(c => c.id)
  const { data: creatives } = ids.length
    ? await db.from('ad_creatives').select(PUBLIC_CREATIVE_COLS).eq('client_id', client.id).in('campaign_id', ids).order('position').order('created_at')
    : { data: [] }

  return NextResponse.json({
    canReview: client.content_approval_enabled === true,
    campaigns: (campaigns ?? []).map(c => ({ ...c, creatives: (creatives ?? []).filter(cr => cr.campaign_id === c.id) })),
  })
}
