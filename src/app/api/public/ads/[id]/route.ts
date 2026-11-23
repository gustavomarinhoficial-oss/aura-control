import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { findClientByShare } from '@/lib/shareSlug'
import { PUBLIC_CREATIVE_COLS, isUuid, notifyTeamAd, syncCampaignApproval } from '@/lib/ads/server'
import { CLIENT_CAN_REVIEW, type CampaignStatus } from '@/lib/ads/constants'

// PATCH /api/public/ads/[id]  { token, action: 'aprovar' | 'ajuste', comment? }
// O cliente aprova um criativo ou pede ajuste (com comentário). Só se o criativo for mesmo do
// cliente do link, se a aprovação pelo link estiver ligada e se a campanha não estiver em rascunho/encerrada.
// Nenhum outro campo pode ser alterado por aqui.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token : ''
  const action = body.action
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 2000) : ''

  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })
  if (action !== 'aprovar' && action !== 'ajuste') return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  if (action === 'ajuste' && !comment) return NextResponse.json({ error: 'Conte o que precisa ajustar' }, { status: 400 })
  if (!isUuid(id)) return NextResponse.json({ error: 'Criativo não encontrado' }, { status: 404 })

  const db = createServiceClient()
  const client = await findClientByShare<{ id: string; name: string; content_approval_enabled: boolean }>(db, token, 'id, name, content_approval_enabled')
  if (!client) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  if (!client.content_approval_enabled) return NextResponse.json({ error: 'A aprovação pelo link não está disponível' }, { status: 403 })

  const { data: creative } = await db.from('ad_creatives').select('id, client_id, campaign_id, ad_campaigns(name, status)').eq('id', id).maybeSingle()
  if (!creative || creative.client_id !== client.id) return NextResponse.json({ error: 'Criativo não encontrado' }, { status: 404 })
  const campaign = creative.ad_campaigns as unknown as { name: string; status: CampaignStatus } | null
  if (!campaign || !CLIENT_CAN_REVIEW.includes(campaign.status)) {
    return NextResponse.json({ error: 'Essa campanha não está aberta para aprovação' }, { status: 403 })
  }

  const now = new Date().toISOString()
  const { data: updated, error } = await db.from('ad_creatives').update({
    approval_status: action === 'aprovar' ? 'aprovado' : 'ajuste',
    client_comment: comment || null,
    approved_at: action === 'aprovar' ? now : null,
    reviewed_at: now,
    updated_at: now,
  }).eq('id', id).select(PUBLIC_CREATIVE_COLS).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (action === 'aprovar') await syncCampaignApproval(db, creative.campaign_id)
  // a Vercel pode congelar a função depois da resposta: espera o e-mail (best-effort) antes
  await notifyTeamAd(client.name, campaign.name, updated)
  return NextResponse.json(updated)
}
