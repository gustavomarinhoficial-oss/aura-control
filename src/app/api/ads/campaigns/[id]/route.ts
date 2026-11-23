import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { CAMPAIGN_COLS, CREATIVE_COLS, isUuid, parseCampaign, unusedMedia } from '@/lib/ads/server'
import { adsRoute, dbError } from '@/lib/ads/route'
import { deleteImages } from '@/lib/mcp/r2'

type Params = { params: Promise<{ id: string }> }

// GET → campanha + criativos + dados do cliente (nome, link público, aprovação ligada)
export async function GET(_req: Request, { params }: Params) {
  return adsRoute(async () => {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
    const db = createServiceClient()
    const { data: campaign, error } = await db.from('ad_campaigns').select(CAMPAIGN_COLS).eq('id', id).maybeSingle()
    dbError(error)
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
    const [{ data: creatives, error: crErr }, { data: client }] = await Promise.all([
      db.from('ad_creatives').select(CREATIVE_COLS).eq('campaign_id', id).order('position').order('created_at'),
      db.from('clients').select('id, name, logo_url, share_slug, share_token, content_approval_enabled').eq('id', campaign.client_id).single(),
    ])
    dbError(crErr)
    return NextResponse.json({ campaign, creatives: creatives ?? [], client })
  })
}

export async function PATCH(request: Request, { params }: Params) {
  return adsRoute(async () => {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
    const body = await request.json().catch(() => ({}))
    delete body.client_id // campanha não muda de cliente
    const update = parseCampaign(body, true)
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
    const db = createServiceClient()
    const { data, error } = await db.from('ad_campaigns').update({ ...update, updated_at: new Date().toISOString() }).eq('id', id).select(CAMPAIGN_COLS).maybeSingle()
    dbError(error)
    if (!data) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
    return NextResponse.json(data)
  })
}

// DELETE → apaga a campanha, os criativos dela e as mídias que ninguém mais usa
export async function DELETE(_req: Request, { params }: Params) {
  return adsRoute(async () => {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
    const db = createServiceClient()
    const { data: creatives } = await db.from('ad_creatives').select('media_urls, cover_url').eq('campaign_id', id)
    const { error } = await db.from('ad_campaigns').delete().eq('id', id)
    dbError(error)
    const urls = (creatives ?? []).flatMap(c => [...(c.media_urls ?? []), ...(c.cover_url ? [c.cover_url] : [])])
    await deleteImages(await unusedMedia(db, urls))
    return NextResponse.json({ ok: true })
  })
}
