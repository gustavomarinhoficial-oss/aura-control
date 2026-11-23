import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { CAMPAIGN_COLS, isUuid, parseCampaign } from '@/lib/ads/server'
import { countCreatives, type AdCreative } from '@/lib/ads/constants'
import { adsRoute, dbError } from '@/lib/ads/route'

// GET /api/ads/campaigns?client_id=X → campanhas (de um cliente ou de todos) com a contagem de criativos por status
export async function GET(request: Request) {
  return adsRoute(async () => {
    const clientId = new URL(request.url).searchParams.get('client_id')
    const db = createServiceClient()
    let q = db.from('ad_campaigns').select(`${CAMPAIGN_COLS}, clients(id, name)`).order('created_at', { ascending: false })
    if (clientId) {
      if (!isUuid(clientId)) return NextResponse.json({ error: 'client_id inválido' }, { status: 400 })
      q = q.eq('client_id', clientId)
    }
    const { data, error } = await q
    dbError(error)
    const ids = (data ?? []).map(c => c.id)
    const { data: cr, error: crErr } = ids.length
      ? await db.from('ad_creatives').select('campaign_id, approval_status').in('campaign_id', ids)
      : { data: [], error: null }
    dbError(crErr)
    const byCampaign = new Map<string, Pick<AdCreative, 'approval_status'>[]>()
    for (const c of cr ?? []) byCampaign.set(c.campaign_id, [...(byCampaign.get(c.campaign_id) ?? []), c as Pick<AdCreative, 'approval_status'>])
    return NextResponse.json((data ?? []).map(c => ({ ...c, counts: countCreatives(byCampaign.get(c.id) ?? []) })))
  })
}

// POST /api/ads/campaigns { client_id, name, objective, budget_type, budget_amount, start_date, end_date, schedule, audience, status, notes }
export async function POST(request: Request) {
  return adsRoute(async () => {
    const body = await request.json().catch(() => ({}))
    if (!isUuid(body.client_id)) return NextResponse.json({ error: 'Escolha o cliente.' }, { status: 400 })
    const row = parseCampaign(body, false)
    const db = createServiceClient()
    const { data: client } = await db.from('clients').select('id').eq('id', body.client_id).maybeSingle()
    if (!client) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })
    const { data, error } = await db.from('ad_campaigns').insert({ ...row, client_id: body.client_id }).select(CAMPAIGN_COLS).single()
    dbError(error)
    return NextResponse.json(data)
  })
}
