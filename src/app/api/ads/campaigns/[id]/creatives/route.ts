import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { CREATIVE_COLS, isUuid, parseCreative } from '@/lib/ads/server'
import { adsRoute, dbError } from '@/lib/ads/route'

// POST /api/ads/campaigns/[id]/creatives → novo criativo na campanha (entra como "aguardando" aprovação)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return adsRoute(async () => {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
    const body = await request.json().catch(() => ({}))
    const row = parseCreative({ ...body, approval_status: 'aguardando' }, false)
    const db = createServiceClient()
    const { data: campaign } = await db.from('ad_campaigns').select('id, client_id').eq('id', id).maybeSingle()
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
    const { count } = await db.from('ad_creatives').select('id', { count: 'exact', head: true }).eq('campaign_id', id)
    const { data, error } = await db.from('ad_creatives')
      .insert({ ...row, campaign_id: id, client_id: campaign.client_id, position: count ?? 0 })
      .select(CREATIVE_COLS).single()
    dbError(error)
    return NextResponse.json(data)
  })
}
