import { createServiceClient } from '@/lib/supabase/server'
import { ToolError } from './errors'
import { storeMedia, deleteImages, type ImageInput } from './r2'
import type { Tool } from './tools'
import {
  CAMPAIGN_COLS, CREATIVE_COLS, MAX_CREATIVE_MEDIA, isUuid, parseCampaign, parseCreative, syncCampaignApproval, unusedMedia,
} from '@/lib/ads/server'
import {
  OBJECTIVES, CAMPAIGN_STATUS, APPROVAL_STATUS, PLACEMENTS, CTAS, HIDDEN_FROM_CLIENT, countCreatives, isVideoUrl,
  type AdCampaign, type AdCreative,
} from '@/lib/ads/constants'

// Criativos de Tráfego pelo conector: campanhas de anúncios (Meta Ads) e os criativos que o cliente aprova no link.
// Mesmo escopo "conteudo" das ferramentas de posts. Upload de vídeo: gerar_url_upload (já existente).

const BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://hub.owlcreative.club').replace(/\/$/, '')
const fail = (msg: string): never => { throw new ToolError(msg) }
type DB = ReturnType<typeof createServiceClient>

type ClientRow = { id: string; name: string; share_slug: string | null; share_token: string | null; content_approval_enabled: boolean | null }
const link = (c: ClientRow) => (c.share_slug ? `${BASE_URL}/${c.share_slug}` : c.share_token ? `${BASE_URL}/publico/${c.share_token}` : null)

async function getClient(db: DB, id: unknown): Promise<ClientRow> {
  if (!isUuid(id)) return fail('"cliente_id" inválido. Use um id de listar_clientes.')
  const { data } = await db.from('clients').select('id, name, share_slug, share_token, content_approval_enabled').eq('id', id).maybeSingle()
  return (data as ClientRow) ?? fail('Cliente não encontrado. Use listar_clientes.')
}

async function getCampaign(db: DB, id: unknown): Promise<AdCampaign> {
  if (!isUuid(id)) return fail('"campanha_id" inválido. Use um id de listar_campanhas_trafego ou criar_campanha_trafego.')
  const { data, error } = await db.from('ad_campaigns').select(CAMPAIGN_COLS).eq('id', id).maybeSingle()
  if (error) return fail(missingSql(error.message))
  return (data as AdCampaign) ?? fail('Campanha não encontrada.')
}

async function getCreative(db: DB, id: unknown): Promise<AdCreative> {
  if (!isUuid(id)) return fail('"criativo_id" inválido. Use um id de ver_status_criativos ou criar_criativo_trafego.')
  const { data } = await db.from('ad_creatives').select(CREATIVE_COLS).eq('id', id).maybeSingle()
  return (data as AdCreative) ?? fail('Criativo não encontrado.')
}

const missingSql = (msg: string) => /ad_campaigns|ad_creatives/.test(msg) ? 'Falta rodar o SQL da migration 059 (criativos de tráfego) no Supabase.' : `Erro no banco: ${msg}`

function visibility(c: ClientRow, campaign: Pick<AdCampaign, 'status'>) {
  const avisos: string[] = []
  if (!link(c)) avisos.push('O cliente ainda não tem link público. Gere o link na página do cliente, no Hub.')
  if (HIDDEN_FROM_CLIENT.includes(campaign.status)) avisos.push('A campanha está em rascunho: o cliente não vê. Mude o status para aguardando_aprovacao quando quiser mandar.')
  if (!c.content_approval_enabled) avisos.push('A aprovação pelo link está desligada para este cliente: ele vê os anúncios, mas não consegue aprovar. Ligue em "Aprovação de conteúdo" na página do cliente.')
  return { visivel_para_cliente: !HIDDEN_FROM_CLIENT.includes(campaign.status) && !!link(c), link_do_cliente: link(c), aba_no_link: 'Anúncios', avisos }
}

const shapeCampaign = (c: AdCampaign) => ({
  id: c.id, cliente_id: c.client_id, nome: c.name, objetivo: c.objective, objetivo_descricao: OBJECTIVES[c.objective],
  verba_tipo: c.budget_type, verba_valor: c.budget_amount, inicio: c.start_date, fim: c.end_date,
  dias_e_horarios: c.schedule, publico: c.audience, status: c.status, status_descricao: CAMPAIGN_STATUS[c.status]?.label ?? c.status,
  observacao_interna: c.notes ?? null, criada_em: c.created_at, atualizada_em: c.updated_at,
})

const shapeCreative = (c: AdCreative) => ({
  id: c.id, campanha_id: c.campaign_id, nome: c.name,
  midia: c.media_urls.map(u => ({ url: u, tipo: isVideoUrl(u) ? 'video' : 'imagem' })), capa: c.cover_url,
  formato: c.placement, formato_descricao: PLACEMENTS[c.placement], texto_principal: c.primary_text, titulo: c.headline,
  cta: c.cta, cta_texto: CTAS[c.cta], destino_tipo: c.destination_type, destino: c.destination,
  status_aprovacao: c.approval_status, status_descricao: APPROVAL_STATUS[c.approval_status]?.label ?? c.approval_status,
  comentario_do_cliente: c.client_comment, aprovado_em: c.approved_at, revisado_pelo_cliente_em: c.reviewed_at, atualizado_em: c.updated_at,
})

// Portugues do conector -> colunas do banco (só o que veio)
function campaignBody(a: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, string> = { nome: 'name', objetivo: 'objective', verba_tipo: 'budget_type', verba_valor: 'budget_amount', inicio: 'start_date', fim: 'end_date', dias_e_horarios: 'schedule', publico: 'audience', status: 'status', observacao_interna: 'notes' }
  const out: Record<string, unknown> = {}
  for (const [pt, col] of Object.entries(map)) if (pt in a) out[col] = a[pt]
  return out
}

// Mídias: url de gerar_url_upload (vídeo ou imagem) ou imagem em base64. Devolve as urls e as que foram criadas agora.
async function storeList(list: unknown): Promise<{ urls: string[]; created: string[] }> {
  if (!Array.isArray(list) || list.length === 0) return fail('Envie pelo menos uma mídia em "midia" (url de gerar_url_upload, ou imagem em base64).')
  if (list.length > MAX_CREATIVE_MEDIA) return fail(`No máximo ${MAX_CREATIVE_MEDIA} arquivos por criativo.`)
  const urls: string[] = []; const created: string[] = []
  try {
    for (let i = 0; i < list.length; i++) {
      const item = typeof list[i] === 'string' ? { url: list[i] } : list[i]
      if (!item || typeof item !== 'object') fail(`Mídia ${i + 1}: formato inválido (esperado { url } ou { conteudo_base64, mime }).`)
      const m = await storeMedia(item as ImageInput, `Mídia ${i + 1}`)
      urls.push(m.url)
      if (!(item as ImageInput).url) created.push(m.url)
    }
  } catch (e) { await deleteImages(created); throw e }
  return { urls, created }
}

async function storeCoverImg(v: unknown): Promise<{ url: string; created: boolean }> {
  if (!v || typeof v !== 'object') return fail('"capa" deve ser { url } ou { conteudo_base64, mime }.')
  const m = await storeMedia(v as ImageInput, 'Capa')
  if (m.kind !== 'image') { await deleteImages([m.url]); return fail('A capa precisa ser uma imagem.') }
  return { url: m.url, created: !(v as ImageInput).url }
}

function creativeBody(a: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, string> = { nome: 'name', formato: 'placement', texto_principal: 'primary_text', titulo: 'headline', cta: 'cta', destino_tipo: 'destination_type', destino: 'destination' }
  const out: Record<string, unknown> = {}
  for (const [pt, col] of Object.entries(map)) if (pt in a) out[col] = a[pt]
  return out
}

const mediaItem = {
  type: 'object',
  description: 'Uma mídia: { url } com a url_publica de gerar_url_upload (vídeo MP4/MOV ou imagem), ou { conteudo_base64, mime } para imagem pequena.',
  properties: {
    url: { type: 'string' },
    conteudo_base64: { type: 'string' },
    mime: { type: 'string', enum: ['image/jpeg', 'image/png'] },
    nome_arquivo: { type: 'string' },
  },
}

const campaignProps = {
  nome: { type: 'string', description: 'Nome da campanha. Padrão "[OWL] Nome da Campanha (Mês/AA)": se não começar com [OWL], o Hub monta o padrão sozinho a partir do início.' },
  objetivo: { type: 'string', enum: Object.keys(OBJECTIVES), description: 'mensagens (WhatsApp), alcance, engajamento ou trafego.' },
  verba_tipo: { type: 'string', enum: ['total', 'diaria'], description: 'Se a verba é total da campanha ou por dia.' },
  verba_valor: { type: 'number', description: 'Valor da verba em reais, ex.: 600.' },
  inicio: { type: 'string', description: 'Data de início, AAAA-MM-DD.' },
  fim: { type: 'string', description: 'Data de fim, AAAA-MM-DD.' },
  dias_e_horarios: { type: 'string', description: 'Dias e horários de veiculação (texto livre), ex.: "terça a domingo, 11h às 15h e 18h às 23h".' },
  publico: { type: 'string', description: 'Público (texto livre): região, raio, idade, interesses.' },
  status: { type: 'string', enum: Object.keys(CAMPAIGN_STATUS), description: 'rascunho (cliente não vê), aguardando_aprovacao, aprovada, no_ar, pausada, encerrada.' },
  observacao_interna: { type: 'string', description: 'Nota só para a equipe (o cliente nunca vê).' },
}

const creativeProps = {
  nome: { type: 'string', description: 'Nome do criativo, ex.: "Reels terça, escalopes".' },
  midia: { type: 'array', items: mediaItem, description: 'Arquivos do anúncio em ordem (1 vídeo, 1 imagem ou várias imagens/vídeos para carrossel). Até 10.' },
  capa: { ...mediaItem, description: 'Capa opcional do vídeo (imagem).' },
  texto_principal: { type: 'string', description: 'Texto principal do anúncio (aparece em cima da mídia).' },
  titulo: { type: 'string', description: 'Título (opcional), aparece embaixo, ao lado do botão.' },
  cta: { type: 'string', enum: Object.keys(CTAS), description: 'Botão do anúncio: enviar_mensagem, saiba_mais, reservar, ligar_agora, ver_cardapio, pedir_agora.' },
  destino_tipo: { type: 'string', enum: ['whatsapp', 'link', 'instagram'], description: 'Para onde o anúncio leva.' },
  destino: { type: 'string', description: 'Número de WhatsApp (DDD + número), link (https://...) ou @ do perfil do Instagram.' },
  formato: { type: 'string', enum: Object.keys(PLACEMENTS), description: 'feed, stories_reels ou ambos.' },
}

export const AD_TOOLS: Tool[] = [
  {
    name: 'listar_campanhas_trafego',
    description: 'Lista as campanhas de tráfego (anúncios pagos) de um cliente, com objetivo, verba, período, status e quantos criativos estão aprovados, aguardando ou com ajuste pedido.',
    inputSchema: { type: 'object', properties: { cliente_id: { type: 'string', description: 'Id do cliente (de listar_clientes).' } }, required: ['cliente_id'], additionalProperties: false },
    async run(a) {
      const db = createServiceClient()
      const client = await getClient(db, a.cliente_id)
      const { data, error } = await db.from('ad_campaigns').select(CAMPAIGN_COLS).eq('client_id', client.id).order('created_at', { ascending: false })
      if (error) return fail(missingSql(error.message))
      const ids = (data ?? []).map(c => c.id)
      const { data: cr } = ids.length ? await db.from('ad_creatives').select('campaign_id, approval_status').in('campaign_id', ids) : { data: [] }
      return {
        cliente: client.name,
        link_do_cliente: link(client),
        total: data?.length ?? 0,
        campanhas: ((data ?? []) as AdCampaign[]).map(c => {
          const k = countCreatives((cr ?? []).filter(x => x.campaign_id === c.id) as Pick<AdCreative, 'approval_status'>[])
          return { ...shapeCampaign(c), criativos: { total: k.total, aprovados: k.aprovado, aguardando: k.aguardando, ajuste_pedido: k.ajuste, reprovados: k.reprovado } }
        }),
      }
    },
  },
  {
    name: 'criar_campanha_trafego',
    description: 'Cria uma campanha de tráfego (Meta Ads) para um cliente. Por padrão já entra como "aguardando_aprovacao" e aparece na aba Anúncios do link do cliente; use status "rascunho" para esconder até estar pronta. Depois adicione os criativos com criar_criativo_trafego.',
    inputSchema: { type: 'object', properties: { cliente_id: { type: 'string', description: 'Id do cliente (de listar_clientes).' }, ...campaignProps }, required: ['cliente_id', 'nome'], additionalProperties: false },
    async run(a) {
      const db = createServiceClient()
      const client = await getClient(db, a.cliente_id)
      const row = parseCampaign({ status: 'aguardando_aprovacao', ...campaignBody(a) }, false)
      const { data, error } = await db.from('ad_campaigns').insert({ ...row, client_id: client.id, source: 'claude' }).select(CAMPAIGN_COLS).single()
      if (error || !data) return fail(missingSql(error?.message ?? 'desconhecido'))
      return { campanha_id: data.id, cliente: client.name, ...visibility(client, data as AdCampaign), campanha: shapeCampaign(data as AdCampaign) }
    },
  },
  {
    name: 'atualizar_campanha_trafego',
    description: 'Atualiza uma campanha de tráfego: nome, objetivo, verba, período, dias e horários, público, status (ex.: no_ar, pausada, encerrada) ou observação interna. Só muda os campos enviados.',
    inputSchema: { type: 'object', properties: { campanha_id: { type: 'string' }, ...campaignProps }, required: ['campanha_id'], additionalProperties: false },
    async run(a) {
      const db = createServiceClient()
      const before = await getCampaign(db, a.campanha_id)
      const body = campaignBody(a)
      // o padrão de nome usa o mês do início: se só o nome mudou, usa o início que já está salvo
      if ('name' in body && !('start_date' in body) && before.start_date) body.start_date = before.start_date
      const update = parseCampaign(body, true)
      if (Object.keys(update).length === 0) return fail('Nada para atualizar: informe pelo menos um campo além de campanha_id.')
      const { data, error } = await db.from('ad_campaigns').update({ ...update, updated_at: new Date().toISOString() }).eq('id', before.id).select(CAMPAIGN_COLS).single()
      if (error || !data) return fail(missingSql(error?.message ?? 'desconhecido'))
      const client = await getClient(db, data.client_id)
      return { campanha_id: data.id, status_anterior: before.status, ...visibility(client, data as AdCampaign), campanha: shapeCampaign(data as AdCampaign) }
    },
  },
  {
    name: 'criar_criativo_trafego',
    description: 'Adiciona um criativo (anúncio) a uma campanha de tráfego, como "aguardando" aprovação do cliente. Para vídeo (MP4/MOV, até 500 MB): chame gerar_url_upload com o cliente_id, faça o PUT do arquivo e passe a url_publica em midia[].url. O cliente vê a prévia na aba Anúncios do link e aprova ou pede ajuste.',
    inputSchema: { type: 'object', properties: { campanha_id: { type: 'string' }, ...creativeProps }, required: ['campanha_id', 'nome', 'midia', 'texto_principal', 'cta', 'formato'], additionalProperties: false },
    async run(a) {
      const db = createServiceClient()
      const campaign = await getCampaign(db, a.campanha_id)
      const media = await storeList(a.midia)
      let cover: { url: string; created: boolean } | null = null
      try {
        if (a.capa !== undefined && a.capa !== null) cover = await storeCoverImg(a.capa)
        const row = parseCreative({ ...creativeBody(a), media_urls: media.urls, ...(cover ? { cover_url: cover.url } : {}), approval_status: 'aguardando' }, false)
        const { count } = await db.from('ad_creatives').select('id', { count: 'exact', head: true }).eq('campaign_id', campaign.id)
        const { data, error } = await db.from('ad_creatives').insert({ ...row, campaign_id: campaign.id, client_id: campaign.client_id, position: count ?? 0, source: 'claude' }).select(CREATIVE_COLS).single()
        if (error || !data) fail(missingSql(error?.message ?? 'desconhecido'))
        const client = await getClient(db, campaign.client_id)
        return { criativo_id: data!.id, campanha: campaign.name, cliente: client.name, ...visibility(client, campaign), criativo: shapeCreative(data as AdCreative) }
      } catch (e) {
        await deleteImages([...media.created, ...(cover?.created ? [cover.url] : [])])
        throw e
      }
    },
  },
  {
    name: 'atualizar_criativo_trafego',
    description: 'Ajusta um criativo: nome, mídias (substitui a lista toda), capa, texto principal, título, CTA, destino ou formato. Por padrão volta para "aguardando" aprovação do cliente (use reenviar_para_aprovacao=false para manter o status).',
    inputSchema: { type: 'object', properties: { criativo_id: { type: 'string' }, ...creativeProps, reenviar_para_aprovacao: { type: 'boolean', description: 'Padrão true.' } }, required: ['criativo_id'], additionalProperties: false },
    async run(a) {
      const db = createServiceClient()
      const before = await getCreative(db, a.criativo_id)
      const body = creativeBody(a)
      // destino precisa vir em par: completa com o que já está salvo
      if ('destination' in body && !('destination_type' in body)) body.destination_type = before.destination_type
      if ('destination_type' in body && !('destination' in body)) body.destination = before.destination
      let media: { urls: string[]; created: string[] } | null = null
      let cover: { url: string; created: boolean } | null = null
      try {
        if (a.midia !== undefined) { media = await storeList(a.midia); body.media_urls = media.urls }
        if (a.capa !== undefined && a.capa !== null) { cover = await storeCoverImg(a.capa); body.cover_url = cover.url }
        const update = parseCreative(body, true)
        if (Object.keys(update).length === 0) fail('Nada para atualizar: informe pelo menos um campo além de criativo_id.')
        if (a.reenviar_para_aprovacao !== false) { update.approval_status = 'aguardando'; update.approved_at = null }
        const { data, error } = await db.from('ad_creatives').update({ ...update, updated_at: new Date().toISOString() }).eq('id', before.id).select(CREATIVE_COLS).single()
        if (error || !data) fail(missingSql(error?.message ?? 'desconhecido'))
        const after = data as AdCreative
        const removed = [...before.media_urls, ...(before.cover_url ? [before.cover_url] : [])].filter(u => !after.media_urls.includes(u) && u !== after.cover_url)
        await deleteImages(await unusedMedia(db, removed))
        return { criativo_id: after.id, status_anterior: before.approval_status, criativo: shapeCreative(after) }
      } catch (e) {
        await deleteImages([...(media?.created ?? []), ...(cover?.created ? [cover.url] : [])])
        throw e
      }
    },
  },
  {
    name: 'ver_status_criativos',
    description: 'Mostra a campanha e cada criativo com o status de aprovação (aguardando, aprovado, ajuste pedido, reprovado), o comentário do cliente e a data da aprovação.',
    inputSchema: { type: 'object', properties: { campanha_id: { type: 'string' } }, required: ['campanha_id'], additionalProperties: false },
    async run(a) {
      const db = createServiceClient()
      const campaign = await getCampaign(db, a.campanha_id)
      // garante que a campanha reflete as aprovações (ex.: aprovada quando todos foram aprovados)
      await syncCampaignApproval(db, campaign.id)
      const [{ data: fresh }, { data }] = await Promise.all([
        db.from('ad_campaigns').select(CAMPAIGN_COLS).eq('id', campaign.id).single(),
        db.from('ad_creatives').select(CREATIVE_COLS).eq('campaign_id', campaign.id).order('position').order('created_at'),
      ])
      const list = (data ?? []) as AdCreative[]
      const k = countCreatives(list)
      const client = await getClient(db, campaign.client_id)
      return {
        cliente: client.name,
        link_do_cliente: link(client),
        campanha: shapeCampaign((fresh ?? campaign) as AdCampaign),
        resumo: { total: k.total, aprovados: k.aprovado, aguardando: k.aguardando, ajuste_pedido: k.ajuste, reprovados: k.reprovado },
        criativos: list.map(shapeCreative),
      }
    },
  },
]
