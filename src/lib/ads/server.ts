import { Resend } from 'resend'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getRole, isFinanceRestricted } from '@/lib/roles'
import { ToolError } from '@/lib/mcp/errors'
import { isOurUrl } from '@/lib/mcp/r2'
import { OBJECTIVES, CAMPAIGN_STATUS, APPROVAL_STATUS, PLACEMENTS, CTAS, DESTINATIONS, BUDGET_TYPES, campaignName } from './constants'

// Regras de validação dos Criativos de Tráfego, usadas pela API interna e pelo conector MCP.
// Erros de validação saem como ToolError (mensagem em português, pronta pra mostrar).

type DB = ReturnType<typeof createServiceClient>

export const CAMPAIGN_COLS = 'id, client_id, name, objective, budget_type, budget_amount, start_date, end_date, schedule, audience, status, notes, source, created_at, updated_at'
export const CREATIVE_COLS = 'id, campaign_id, client_id, name, media_urls, cover_url, placement, primary_text, headline, cta, destination_type, destination, approval_status, client_comment, approved_at, reviewed_at, position, source, created_at, updated_at'
// O que o cliente vê (sem observação interna nem origem)
export const PUBLIC_CAMPAIGN_COLS = 'id, name, objective, budget_type, budget_amount, start_date, end_date, schedule, audience, status, created_at'
export const PUBLIC_CREATIVE_COLS = 'id, campaign_id, name, media_urls, cover_url, placement, primary_text, headline, cta, destination_type, destination, approval_status, client_comment, approved_at, position, created_at'

export const MAX_CREATIVE_MEDIA = 10

const fail = (msg: string): never => { throw new ToolError(msg) }
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + 'T12:00:00Z').toISOString().startsWith(v)
export const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

function text(v: unknown, label: string, max: number, required = false): string | null {
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
    if (required) fail(`Informe ${label}.`)
    return null
  }
  if (typeof v !== 'string') return fail(`${label} deve ser texto.`)
  if (v.length > max) return fail(`${label} passou de ${max} caracteres.`)
  return v.trim()
}

function oneOf<T extends Record<string, unknown>>(v: unknown, map: T, label: string): keyof T {
  const key = typeof v === 'string' ? v.toLowerCase().trim().replace(/[\s/-]+/g, '_') : ''
  if (key in map) return key as keyof T
  return fail(`${label} inválido. Use: ${Object.keys(map).join(', ')}.`)
}

// Aceita as formas que a gente fala ("stories", "reels", "os dois") além das chaves
function placementOf(v: unknown): keyof typeof PLACEMENTS {
  const k = typeof v === 'string' ? v.toLowerCase().trim() : ''
  if (['feed'].includes(k)) return 'feed'
  if (['stories', 'story', 'reels', 'stories_reels', 'stories/reels'].includes(k)) return 'stories_reels'
  if (['ambos', 'os dois', 'todos', 'feed_stories', 'feed+stories', 'feed e stories'].includes(k)) return 'ambos'
  return fail(`Formato inválido. Use: ${Object.keys(PLACEMENTS).join(', ')}.`)
}

function ctaOf(v: unknown): keyof typeof CTAS {
  const k = typeof v === 'string' ? v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim() : ''
  for (const [key, label] of Object.entries(CTAS)) {
    if (k === key || k === label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')) return key as keyof typeof CTAS
  }
  return fail(`CTA inválido. Use: ${Object.keys(CTAS).join(', ')}.`)
}

function amountOf(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\./g, '').replace(',', '.'))
  if (!Number.isFinite(n) || n < 0) return fail('Verba inválida (use um número maior ou igual a zero).')
  return Math.round(n * 100) / 100
}

// Normaliza o destino: WhatsApp só com números (com DDI 55), link com https://, Instagram sem @
export function normalizeDestination(type: string, raw: string): string {
  const v = raw.trim()
  if (type === 'whatsapp') {
    let d = v.replace(/\D/g, '')
    if (d.length === 10 || d.length === 11) d = '55' + d
    if (d.length < 12 || d.length > 13) return fail('Número de WhatsApp inválido. Use DDD + número, ex.: 21999998888.')
    return d
  }
  if (type === 'instagram') {
    const h = v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').split(/[/?#]/)[0]
    if (!/^[A-Za-z0-9._]{1,30}$/.test(h)) return fail('Perfil do Instagram inválido. Use o @ do perfil, ex.: @owlcreative.club.')
    return h
  }
  const url = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try { new URL(url) } catch { return fail('Link de destino inválido.') }
  return url
}

// Campanha: body com as colunas do banco. partial = edição (só o que veio).
export function parseCampaign(b: Record<string, unknown>, partial: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const has = (k: string) => k in b
  if (!partial || has('name')) {
    const raw = text(b.name, 'o nome da campanha', 200, true)!
    out.name = campaignName(raw, typeof b.start_date === 'string' ? b.start_date : null)
  }
  if (!partial || has('objective')) out.objective = has('objective') ? oneOf(b.objective, OBJECTIVES, 'Objetivo') : 'mensagens'
  if (!partial || has('budget_type')) out.budget_type = has('budget_type') ? oneOf(b.budget_type, BUDGET_TYPES, 'Tipo de verba') : 'total'
  if (!partial || has('budget_amount')) out.budget_amount = amountOf(b.budget_amount)
  for (const k of ['start_date', 'end_date'] as const) {
    if (!partial || has(k)) {
      const v = b[k]
      if (v === undefined || v === null || v === '') out[k] = null
      else if (!isDate(v)) fail(`${k === 'start_date' ? 'Início' : 'Fim'} deve ser uma data AAAA-MM-DD.`)
      else out[k] = v
    }
  }
  if (out.start_date && out.end_date && String(out.end_date) < String(out.start_date)) fail('O fim da campanha não pode ser antes do início.')
  if (!partial || has('schedule')) out.schedule = text(b.schedule, 'os dias e horários', 1000)
  if (!partial || has('audience')) out.audience = text(b.audience, 'o público', 2000)
  if (!partial || has('notes')) out.notes = text(b.notes, 'a observação', 2000)
  if (!partial || has('status')) out.status = has('status') ? oneOf(b.status, CAMPAIGN_STATUS, 'Status') : 'rascunho'
  return out
}

// Criativo: body com as colunas do banco. Mídias precisam ser URLs do armazenamento do Hub.
export function parseCreative(b: Record<string, unknown>, partial: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const has = (k: string) => k in b
  if (!partial || has('name')) out.name = text(b.name, 'o nome do criativo', 200, true)
  if (!partial || has('media_urls')) {
    const list = b.media_urls
    if (!Array.isArray(list) || list.length === 0) fail('Envie pelo menos uma mídia (vídeo ou imagem).')
    const urls = (list as unknown[]).map(u => (typeof u === 'string' ? u.trim() : ''))
    if (urls.length > MAX_CREATIVE_MEDIA) fail(`No máximo ${MAX_CREATIVE_MEDIA} arquivos por criativo.`)
    if (urls.some(u => !isOurUrl(u))) fail('As mídias precisam ser enviadas pelo Hub (upload) ou pelo conector (gerar_url_upload).')
    out.media_urls = urls
  }
  if (has('cover_url')) {
    const c = b.cover_url
    if (c === null || c === '') out.cover_url = null
    else if (typeof c !== 'string' || !isOurUrl(c)) fail('A capa precisa ser uma imagem enviada pelo Hub.')
    else out.cover_url = c
  }
  if (!partial || has('placement')) out.placement = has('placement') ? placementOf(b.placement) : 'ambos'
  if (!partial || has('primary_text')) out.primary_text = text(b.primary_text, 'o texto principal', 3000)
  if (!partial || has('headline')) out.headline = text(b.headline, 'o título', 255)
  if (!partial || has('cta')) out.cta = has('cta') ? ctaOf(b.cta) : 'enviar_mensagem'
  if (!partial || has('destination_type') || has('destination')) {
    const type = b.destination_type === undefined || b.destination_type === null || b.destination_type === '' ? null : oneOf(b.destination_type, DESTINATIONS, 'Tipo de destino')
    const value = text(b.destination, 'o destino', 500)
    if (type && !value) fail('Informe o destino (número, link ou perfil).')
    if (value && !type) fail('Informe o tipo de destino: whatsapp, link ou instagram.')
    out.destination_type = type
    out.destination = type && value ? normalizeDestination(String(type), value) : null
  }
  if (has('approval_status')) {
    out.approval_status = oneOf(b.approval_status, APPROVAL_STATUS, 'Status de aprovação')
    out.approved_at = out.approval_status === 'aprovado' ? new Date().toISOString() : null
  }
  if (has('position')) out.position = Number.isFinite(Number(b.position)) ? Math.trunc(Number(b.position)) : 0
  return out
}

// Quando o cliente aprova o último criativo de uma campanha que estava "aguardando aprovação", ela vira "aprovada".
export async function syncCampaignApproval(db: DB, campaignId: string): Promise<void> {
  const { data: camp } = await db.from('ad_campaigns').select('status').eq('id', campaignId).maybeSingle()
  if (!camp || camp.status !== 'aguardando_aprovacao') return
  const { data: list } = await db.from('ad_creatives').select('approval_status').eq('campaign_id', campaignId)
  if (list && list.length > 0 && list.every(c => c.approval_status === 'aprovado')) {
    await db.from('ad_campaigns').update({ status: 'aprovada', updated_at: new Date().toISOString() }).eq('id', campaignId)
  }
}

// Mídias usadas por outros criativos ou posts não podem ser apagadas do armazenamento
export async function unusedMedia(db: DB, urls: string[]): Promise<string[]> {
  const ours = Array.from(new Set(urls.filter(isOurUrl)))
  if (ours.length === 0) return []
  const [cr, cv, pm, pc] = await Promise.all([
    db.from('ad_creatives').select('media_urls').overlaps('media_urls', ours),
    db.from('ad_creatives').select('cover_url').in('cover_url', ours),
    db.from('content_posts').select('media_urls').overlaps('media_urls', ours),
    db.from('content_posts').select('cover_url').in('cover_url', ours),
  ])
  // Se alguma consulta falhar, não apaga nada (melhor sobrar arquivo do que sumir mídia em uso)
  if (cr.error || cv.error || pm.error || pc.error) return []
  const used = new Set<string>([
    ...(cr.data ?? []).flatMap(r => (r.media_urls as string[] | null) ?? []),
    ...(cv.data ?? []).map(r => r.cover_url as string),
    ...(pm.data ?? []).flatMap(r => (r.media_urls as string[] | null) ?? []),
    ...(pc.data ?? []).map(r => r.cover_url as string),
  ])
  return ours.filter(u => !used.has(u))
}

// Quem mexe nos criativos de tráfego: qualquer logado, menos Julia e Mariana (as campanhas têm verba)
export async function canManageAds(): Promise<boolean> {
  const { data: { user } } = await (await createClient()).auth.getUser()
  return !!user && !isFinanceRestricted(getRole(user.user_metadata))
}

const ALERT_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

// Avisa a equipe por e-mail quando o cliente aprova ou pede ajuste (mesma configuração dos posts). Best-effort.
export async function notifyTeamAd(clientName: string, campaign: string, creative: { name: string; approval_status: string; client_comment: string | null }) {
  try {
    if (!process.env.RESEND_API_KEY) return
    const db = createServiceClient()
    const { data: s } = await db.from('alert_settings').select('email_enabled, email_addresses').eq('id', ALERT_SETTINGS_ID).single()
    if (!s?.email_enabled || !s.email_addresses?.length) return
    const ok = creative.approval_status === 'aprovado'
    const esc = (t: string) => t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!))
    await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'alertas@aura.com.br',
      to: s.email_addresses,
      subject: `${ok ? '✅' : '✏️'} ${clientName} ${ok ? 'aprovou' : 'pediu ajuste em'} um anúncio — ${creative.name}`,
      html: `<div style="font-family:Inter,sans-serif;background:#111;color:#f0f0f0;padding:24px;border-radius:12px;max-width:600px;">
        <h2 style="color:${ok ? '#22c55e' : '#fb923c'};margin-bottom:12px;">${ok ? 'Criativo aprovado' : 'Ajuste pedido'}</h2>
        <p style="margin:6px 0;font-size:14px;"><strong>Cliente:</strong> ${esc(clientName)}</p>
        <p style="margin:6px 0;font-size:14px;"><strong>Campanha:</strong> ${esc(campaign)}</p>
        <p style="margin:6px 0;font-size:14px;"><strong>Criativo:</strong> ${esc(creative.name)}</p>
        ${creative.client_comment ? `<p style="margin:16px 0 6px;font-size:14px;"><strong>Comentário:</strong> ${esc(creative.client_comment)}</p>` : ''}
        <p style="margin-top:24px;font-size:12px;color:#666;">Ver em Criativos de Tráfego no OWL Hub</p>
      </div>`,
    })
  } catch {
    // e-mail nunca derruba a aprovação
  }
}
