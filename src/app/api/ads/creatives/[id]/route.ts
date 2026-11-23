import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { CREATIVE_COLS, isUuid, parseCreative, syncCampaignApproval, unusedMedia } from '@/lib/ads/server'
import { adsRoute, dbError } from '@/lib/ads/route'
import { deleteImages } from '@/lib/mcp/r2'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  return adsRoute(async () => {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Criativo não encontrado' }, { status: 404 })
    const body = await request.json().catch(() => ({}))
    delete body.campaign_id; delete body.client_id
    const update = parseCreative(body, true)
    if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
    const db = createServiceClient()
    const { data: before } = await db.from('ad_creatives').select('media_urls, cover_url').eq('id', id).maybeSingle()
    if (!before) return NextResponse.json({ error: 'Criativo não encontrado' }, { status: 404 })
    const { data, error } = await db.from('ad_creatives').update({ ...update, updated_at: new Date().toISOString() }).eq('id', id).select(CREATIVE_COLS).single()
    dbError(error)
    if (!data) return NextResponse.json({ error: 'Criativo não encontrado' }, { status: 404 })
    // arquivos que saíram do criativo e não são usados em mais nada saem do armazenamento
    const removed = [...(before.media_urls ?? []), ...(before.cover_url ? [before.cover_url] : [])]
      .filter(u => !(data.media_urls as string[]).includes(u) && u !== data.cover_url)
    await deleteImages(await unusedMedia(db, removed))
    if (update.approval_status === 'aprovado') await syncCampaignApproval(db, data.campaign_id)
    return NextResponse.json(data)
  })
}

export async function DELETE(_req: Request, { params }: Params) {
  return adsRoute(async () => {
    const { id } = await params
    if (!isUuid(id)) return NextResponse.json({ error: 'Criativo não encontrado' }, { status: 404 })
    const db = createServiceClient()
    const { data: before } = await db.from('ad_creatives').select('media_urls, cover_url').eq('id', id).maybeSingle()
    if (!before) return NextResponse.json({ error: 'Criativo não encontrado' }, { status: 404 })
    const { error } = await db.from('ad_creatives').delete().eq('id', id)
    dbError(error)
    await deleteImages(await unusedMedia(db, [...(before.media_urls ?? []), ...(before.cover_url ? [before.cover_url] : [])]))
    return NextResponse.json({ ok: true })
  })
}
