import { createServiceClient } from '@/lib/supabase/server'
import { effectiveUnlockedMonth } from '@/lib/utils/contentUnlock'
import { ToolError } from './errors'
import { storeImage, storeMedia, createUploadUrl, deleteImages, isOurUrl, MAX_IMAGES, type ImageInput, type MediaKind } from './r2'

const BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://hub.owlcreative.club').replace(/\/$/, '')

// ── formatos e status (nomes do conector <-> nomes do Hub) ───────────────────
const FORMATS: Record<string, string> = { feed: 'feed', carrossel: 'carrossel', story: 'stories', stories: 'stories', reels: 'reels' }
const FORMAT_OUT: Record<string, string> = { feed: 'feed', carrossel: 'carrossel', stories: 'story', reels: 'reels', video: 'video' }

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'rascunho',
  em_criacao: 'em criação',
  aguardando_aprovacao: 'aguardando aprovação do cliente',
  ajustado: 'ajustado',
  aprovado: 'aprovado pelo cliente',
  agendado: 'agendado',
  publicado: 'publicado',
  reprovado: 'reprovado pelo cliente (pediu ajuste)',
}
const STATUS_ALIAS: Record<string, string> = {
  aguardando: 'aguardando_aprovacao', aguardando_aprovacao: 'aguardando_aprovacao', 'aguardando aprovação': 'aguardando_aprovacao',
  aprovado: 'aprovado', reprovado: 'reprovado', ajuste: 'reprovado', rascunho: 'rascunho', agendado: 'agendado', publicado: 'publicado',
  ajustado: 'ajustado', em_criacao: 'em_criacao',
}

const fail = (msg: string): never => { throw new ToolError(msg) }

const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().startsWith(v)
const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
const str = (v: unknown, name: string, max: number): string => {
  if (typeof v !== 'string' || !v.trim()) return fail(`Informe "${name}".`)
  if (v.length > max) return fail(`"${name}" passou de ${max} caracteres.`)
  return v.trim()
}

type DB = ReturnType<typeof createServiceClient>
type ClientRow = { id: string; name: string; status: string; share_slug: string | null; share_token: string | null; content_approval_enabled: boolean | null; content_unlocked_month: string | null }
const CLIENT_COLS = 'id, name, status, share_slug, share_token, content_approval_enabled, content_unlocked_month'

function publicLink(c: Pick<ClientRow, 'share_slug' | 'share_token'>): string | null {
  if (c.share_slug) return `${BASE_URL}/${c.share_slug}`
  if (c.share_token) return `${BASE_URL}/publico/${c.share_token}`
  return null
}

async function getClient(db: DB, id: unknown): Promise<ClientRow> {
  if (!isUuid(id)) return fail('"cliente_id" inválido. Use um id retornado por listar_clientes.')
  const { data } = await db.from('clients').select(CLIENT_COLS).eq('id', id).maybeSingle()
  if (!data) return fail('Cliente não encontrado. Use listar_clientes para ver os ids.')
  return data as ClientRow
}

// O cliente só vê posts do mês liberado e só aprova se a aprovação estiver ligada pra ele
function clientVisibility(c: ClientRow, scheduledDate: string | null) {
  const notes: string[] = []
  const unlocked = effectiveUnlockedMonth(c.content_unlocked_month)
  const link = publicLink(c)
  if (!link) notes.push('O cliente ainda não tem link público. Gere o link na página do cliente, no Hub.')
  if (!c.content_approval_enabled) notes.push('A aprovação pelo link está desligada para este cliente. Ligue em "Aprovação de conteúdo" na página do cliente.')
  if (scheduledDate && scheduledDate.slice(0, 7) > unlocked) notes.push(`O mês ${scheduledDate.slice(0, 7)} ainda não está liberado no link do cliente (liberado até ${unlocked}). Ele libera sozinho nos últimos dias do mês anterior ou pelo botão na Central de Conteúdo.`)
  return { visivel_para_cliente: notes.length === 0, avisos: notes }
}

interface PostRow {
  id: string; client_id: string; title: string; caption: string | null; content_type: string | null; platform: string; status: string
  scheduled_date: string | null; scheduled_time: string | null; media_url: string | null; media_urls: string[] | null
  rejection_reason: string | null; rejection_images: string[] | null; caption_edited_by_client: boolean | null
  source: string | null; source_at: string | null; created_at: string; updated_at: string | null; cover_url: string | null
}
const POST_COLS = 'id, client_id, title, caption, content_type, platform, status, scheduled_date, scheduled_time, media_url, media_urls, rejection_reason, rejection_images, caption_edited_by_client, source, source_at, created_at, updated_at, cover_url'

const isVideoUrl = (u: string) => /\.(mp4|mov)$/i.test(u.split('?')[0])

function images(p: Pick<PostRow, 'media_url' | 'media_urls'>): string[] {
  return p.media_urls?.length ? p.media_urls : p.media_url ? [p.media_url] : []
}

function shapePost(p: PostRow) {
  return {
    id: p.id,
    cliente_id: p.client_id,
    titulo: p.title,
    data_publicacao: p.scheduled_date,
    horario: p.scheduled_time ? p.scheduled_time.slice(0, 5) : null,
    formato: p.content_type ? (FORMAT_OUT[p.content_type] ?? p.content_type) : null,
    plataforma: p.platform,
    legenda: p.caption,
    status: p.status,
    status_descricao: STATUS_LABEL[p.status] ?? p.status,
    imagens: images(p),
    midia: images(p).map(u => ({ url: u, tipo: isVideoUrl(u) ? 'video' : 'imagem' })),
    capa: p.cover_url,
    comentario_do_cliente: p.rejection_reason,
    imagens_do_cliente: p.rejection_images ?? [],
    legenda_ajustada_pelo_cliente: !!p.caption_edited_by_client,
    origem: p.source,
    origem_em: p.source_at,
    criado_em: p.created_at,
    atualizado_em: p.updated_at,
  }
}

async function getPost(db: DB, id: unknown): Promise<PostRow> {
  if (!isUuid(id)) return fail('"post_id" inválido. Use um id retornado por criar_post ou listar_posts.')
  const { data } = await db.from('content_posts').select(POST_COLS).eq('id', id).maybeSingle()
  if (!data) return fail('Post não encontrado.')
  return data as PostRow
}

async function storeAll(list: unknown): Promise<{ urls: string[]; kinds: MediaKind[]; created: string[] }> {
  if (!Array.isArray(list) || list.length === 0) return fail('Envie pelo menos uma mídia em "imagens" (imagem ou vídeo).')
  if (list.length > MAX_IMAGES) return fail(`No máximo ${MAX_IMAGES} arquivos por post.`)
  const urls: string[] = []
  const kinds: MediaKind[] = []
  const created: string[] = [] // gravadas agora a partir de base64 (as de "url" já existiam)
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (!item || typeof item !== 'object') return fail(`Mídia ${i + 1}: formato inválido (esperado objeto com url, ou nome_arquivo + conteudo_base64 + mime).`)
    try {
      const m = await storeMedia(item as ImageInput, `Mídia ${i + 1}`)
      urls.push(m.url); kinds.push(m.kind)
      if (!(item as ImageInput).url) created.push(m.url)
    } catch (e) {
      await deleteImages(created) // não deixa sobra do que já foi salvo nesta chamada
      throw e
    }
  }
  return { urls, kinds, created }
}

// Vídeo só em story e reels, e sozinho no post (1 arquivo)
function checkMediaRules(contentType: string | null, kinds: MediaKind[]): void {
  if (!kinds.includes('video')) return
  if (contentType !== 'stories' && contentType !== 'reels') return fail('Vídeo só pode ser usado em post do formato story ou reels.')
  if (kinds.length !== 1) return fail('Post com vídeo leva 1 arquivo só (o vídeo). Para ter capa, use o campo "capa".')
}

// Capa opcional do vídeo: sempre uma imagem
async function storeCover(v: unknown): Promise<string> {
  if (!v || typeof v !== 'object') return fail('"capa" deve ser um objeto com url (de uma imagem já enviada) ou conteudo_base64 + mime.')
  const m = await storeMedia(v as ImageInput, 'Capa')
  if (m.kind !== 'image') { await deleteImages([m.url]); return fail('A capa precisa ser uma imagem (JPEG ou PNG), não um vídeo.') }
  return m.url
}

function parseFormat(v: unknown): string {
  const key = typeof v === 'string' ? v.toLowerCase().trim() : ''
  return FORMATS[key] ?? fail('"formato" inválido. Use: feed, carrossel, story ou reels.')
}

// ── tools ────────────────────────────────────────────────────────────────────
export interface Tool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  run: (args: Record<string, unknown>) => Promise<unknown>
}

const imageItemSchema = {
  type: 'object',
  description: 'Uma mídia. Imagem: conteudo_base64 (+ mime) ou url. Vídeo (só story/reels): url devolvida por gerar_url_upload depois do PUT do arquivo.',
  properties: {
    nome_arquivo: { type: 'string', description: 'Nome do arquivo, ex.: post-1.jpg' },
    conteudo_base64: { type: 'string', description: 'Conteúdo da imagem em base64 (sem o prefixo data:). JPEG ou PNG, até 5 MB.' },
    mime: { type: 'string', enum: ['image/jpeg', 'image/png'], description: 'Tipo da imagem.' },
    url: { type: 'string', description: 'url_publica devolvida por gerar_url_upload (imagem ou vídeo já enviado), enviar_imagem ou pelo upload por arquivo.' },
  },
}

export const TOOLS: Tool[] = [
  {
    name: 'listar_clientes',
    description: 'Lista os clientes da OWL com id, nome, status, o slug do link público do hub do cliente e o link completo. Use o id retornado nas outras ferramentas.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    async run() {
      const db = createServiceClient()
      const { data, error } = await db.from('clients').select(CLIENT_COLS).order('name')
      if (error) return fail(`Erro ao listar clientes: ${error.message}`)
      return {
        clientes: ((data ?? []) as ClientRow[]).map(c => ({
          id: c.id,
          nome: c.name,
          status: c.status,
          slug: c.share_slug,
          link_publico: publicLink(c),
          aprovacao_pelo_link_ligada: !!c.content_approval_enabled,
        })),
      }
    },
  },
  {
    name: 'listar_posts',
    description: 'Lista os posts do calendário editorial de um cliente, com data, formato, legenda, status, comentário do cliente e URLs das mídias (imagens/vídeo) e da capa. Filtros opcionais por período e status.',
    inputSchema: {
      type: 'object',
      properties: {
        cliente_id: { type: 'string', description: 'Id do cliente (de listar_clientes).' },
        de: { type: 'string', description: 'Data inicial (AAAA-MM-DD), opcional.' },
        ate: { type: 'string', description: 'Data final (AAAA-MM-DD), opcional.' },
        status: { type: 'string', enum: ['rascunho', 'em_criacao', 'aguardando_aprovacao', 'ajustado', 'aprovado', 'agendado', 'publicado', 'reprovado'], description: 'Filtrar por status, opcional.' },
      },
      required: ['cliente_id'],
      additionalProperties: false,
    },
    async run(a) {
      const db = createServiceClient()
      const client = await getClient(db, a.cliente_id)
      if (a.de !== undefined && !isDate(a.de)) return fail('"de" deve estar no formato AAAA-MM-DD.')
      if (a.ate !== undefined && !isDate(a.ate)) return fail('"ate" deve estar no formato AAAA-MM-DD.')
      let q = db.from('content_posts').select(POST_COLS).eq('client_id', client.id).order('scheduled_date', { ascending: true, nullsFirst: false }).limit(300)
      if (a.de) q = q.gte('scheduled_date', a.de as string)
      if (a.ate) q = q.lte('scheduled_date', a.ate as string)
      if (a.status !== undefined) {
        const st = STATUS_ALIAS[String(a.status).toLowerCase()]
        if (!st) return fail('"status" inválido.')
        q = q.eq('status', st)
      }
      const { data, error } = await q
      if (error) return fail(`Erro ao listar posts: ${error.message}`)
      return { cliente: client.name, total: data?.length ?? 0, posts: ((data ?? []) as PostRow[]).map(shapePost) }
    },
  },
  {
    name: 'gerar_url_upload',
    description: 'Gera uma URL para enviar um arquivo GRANDE (vídeo de reels/story até 500 MB, ou imagem até 25 MB) direto para o armazenamento do Hub, sem passar pelo limite de ~4 MB das outras chamadas. Passos: (1) chame esta ferramenta; (2) faça um PUT do arquivo em "url_upload" com o header Content-Type igual ao "mime" informado (ex.: curl -X PUT -H "Content-Type: video/mp4" --upload-file video.mp4 "<url_upload>"); (3) use a "url_publica" em criar_post/atualizar_post, no campo imagens[].url. A url_upload vale por 30 minutos. Vídeo só pode ser usado em post do formato story ou reels.',
    inputSchema: {
      type: 'object',
      properties: {
        cliente_id: { type: 'string', description: 'Id do cliente dono do post (de listar_clientes).' },
        nome_arquivo: { type: 'string', description: 'Nome do arquivo, ex.: reels-promo.mp4' },
        mime: { type: 'string', enum: ['video/mp4', 'video/quicktime', 'image/jpeg', 'image/png'], description: 'Tipo do arquivo. O PUT precisa usar exatamente este Content-Type.' },
        tamanho: { type: 'number', description: 'Tamanho do arquivo em bytes.' },
      },
      required: ['cliente_id', 'nome_arquivo', 'mime', 'tamanho'],
      additionalProperties: false,
    },
    async run(a) {
      const db = createServiceClient()
      const client = await getClient(db, a.cliente_id)
      str(a.nome_arquivo, 'nome_arquivo', 200)
      if (typeof a.mime !== 'string') return fail('Informe "mime" (video/mp4, video/quicktime, image/jpeg ou image/png).')
      const up = await createUploadUrl(a.mime, Number(a.tamanho))
      return {
        cliente: client.name,
        tipo: up.tipo,
        url_upload: up.url_upload,
        metodo: 'PUT',
        header_obrigatorio: { 'Content-Type': up.content_type },
        url_publica: up.url_publica,
        expira_em_minutos: up.expira_em_minutos,
        exemplo_curl: `curl -X PUT -H "Content-Type: ${up.content_type}" --upload-file "${String(a.nome_arquivo).replace(/"/g, '')}" "<url_upload>"`,
        proximo_passo: 'Depois do PUT (resposta 200), use url_publica em criar_post ou atualizar_post, em imagens[].url.',
      }
    },
  },
  {
    name: 'enviar_imagem',
    description: 'Envia UMA imagem para o armazenamento do Hub e devolve a URL. Use quando o carrossel for pesado: o limite de cada chamada é cerca de 4 MB, então envie as imagens uma por uma aqui e depois passe só as URLs em criar_post (campo "url").',
    inputSchema: {
      type: 'object',
      properties: imageItemSchema.properties,
      required: ['conteudo_base64'],
      additionalProperties: false,
    },
    async run(a) {
      const url = await storeImage(a as ImageInput, 'Imagem')
      return { url }
    },
  },
  {
    name: 'criar_post',
    description: 'Cria um post no calendário editorial do cliente já como "aguardando aprovação do cliente" (ele aprova ou pede ajuste pelo link do hub). Salva as mídias no armazenamento do Hub. Mídia = imagem (base64 ou url) ou, em story/reels, UM vídeo (url de gerar_url_upload), com "capa" opcional. Só chame depois do Gustavo aprovar a arte. Retorna o id do post e o link do hub do cliente.',
    inputSchema: {
      type: 'object',
      properties: {
        cliente_id: { type: 'string', description: 'Id do cliente (de listar_clientes).' },
        data_publicacao: { type: 'string', description: 'Dia da publicação, AAAA-MM-DD.' },
        formato: { type: 'string', enum: ['feed', 'carrossel', 'story', 'reels'], description: 'Formato do post.' },
        titulo: { type: 'string', description: 'Título interno do post.' },
        legenda: { type: 'string', description: 'Legenda completa do post.' },
        imagens: { type: 'array', items: imageItemSchema, description: 'Mídias em ordem. Carrossel = várias imagens; feed = uma imagem; story/reels = uma imagem OU um vídeo (url de gerar_url_upload).' },
        capa: { ...imageItemSchema, description: 'Capa opcional (imagem JPEG/PNG), pensada para vídeo de story/reels. Use url ou conteudo_base64 + mime.' },
        horario: { type: 'string', description: 'Horário de publicação HH:MM, opcional.' },
      },
      required: ['cliente_id', 'data_publicacao', 'formato', 'titulo', 'legenda', 'imagens'],
      additionalProperties: false,
    },
    async run(a) {
      const db = createServiceClient()
      const client = await getClient(db, a.cliente_id)
      if (!isDate(a.data_publicacao)) return fail('"data_publicacao" deve estar no formato AAAA-MM-DD (data válida).')
      const content_type = parseFormat(a.formato)
      const title = str(a.titulo, 'titulo', 200)
      const caption = str(a.legenda, 'legenda', 5000)
      if (a.horario !== undefined && !isTime(a.horario)) return fail('"horario" deve estar no formato HH:MM.')
      const media = await storeAll(a.imagens)
      const urls = media.urls
      let coverUrl: string | null = null
      let coverCreated = false
      try {
        if (content_type === 'carrossel' && urls.length < 2) return fail('Carrossel precisa de pelo menos 2 imagens.')
        checkMediaRules(content_type, media.kinds)
        if (a.capa !== undefined && a.capa !== null) {
          coverUrl = await storeCover(a.capa)
          coverCreated = !(a.capa as ImageInput).url
        }
      } catch (e) {
        await deleteImages(media.created)
        throw e
      }

      const now = new Date().toISOString()
      const { data, error } = await db.from('content_posts').insert({
        client_id: client.id,
        title,
        caption,
        platform: 'instagram',
        content_type,
        status: 'aguardando_aprovacao',
        scheduled_date: a.data_publicacao,
        scheduled_time: a.horario ?? null,
        media_url: urls[0],
        media_urls: urls,
        cover_url: coverUrl,
        source: 'claude',
        source_at: now,
      }).select(POST_COLS).single()
      if (error || !data) {
        await deleteImages([...media.created, ...(coverCreated && coverUrl ? [coverUrl] : [])])
        return fail(`Erro ao criar o post: ${error?.message ?? 'desconhecido'}. Se for sobre as colunas "source" ou "cover_url", rode o SQL das migrations 054 e 055.`)
      }
      const vis = clientVisibility(client, a.data_publicacao)
      return {
        post_id: data.id,
        status: 'aguardando_aprovacao',
        cliente: client.name,
        link_hub_do_cliente: publicLink(client),
        link_central_de_conteudo: `${BASE_URL}/conteudo`,
        ...vis,
        post: shapePost(data as PostRow),
      }
    },
  },
  {
    name: 'atualizar_post',
    description: 'Ajusta um post existente: troca legenda, título, data, horário, formato, a capa e/ou substitui TODA a lista de mídias (imagens ou o vídeo). Por padrão o post volta para "aguardando aprovação do cliente" (use reenviar_para_aprovacao=false para não mudar o status). Não mexe em posts já publicados.',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: { type: 'string', description: 'Id do post.' },
        titulo: { type: 'string' },
        legenda: { type: 'string' },
        data_publicacao: { type: 'string', description: 'AAAA-MM-DD' },
        horario: { type: 'string', description: 'HH:MM' },
        formato: { type: 'string', enum: ['feed', 'carrossel', 'story', 'reels'] },
        imagens: { type: 'array', items: imageItemSchema, description: 'Nova lista COMPLETA de mídias (substitui a anterior). Vídeo só em story/reels.' },
        capa: { ...imageItemSchema, description: 'Nova capa (imagem JPEG/PNG), opcional.' },
        reenviar_para_aprovacao: { type: 'boolean', description: 'Padrão true: volta o status para aguardando aprovação.' },
      },
      required: ['post_id'],
      additionalProperties: false,
    },
    async run(a) {
      const db = createServiceClient()
      const post = await getPost(db, a.post_id)
      if (post.status === 'publicado') return fail('Este post já foi publicado; não dá para alterar.')

      const update: Record<string, unknown> = {}
      if (a.titulo !== undefined) update.title = str(a.titulo, 'titulo', 200)
      if (a.legenda !== undefined) { update.caption = str(a.legenda, 'legenda', 5000); update.caption_edited_by_client = false }
      if (a.data_publicacao !== undefined) { if (!isDate(a.data_publicacao)) return fail('"data_publicacao" deve estar no formato AAAA-MM-DD.'); update.scheduled_date = a.data_publicacao }
      if (a.horario !== undefined) { if (!isTime(a.horario)) return fail('"horario" deve estar no formato HH:MM.'); update.scheduled_time = a.horario }
      if (a.formato !== undefined) update.content_type = parseFormat(a.formato)

      let oldImages: string[] = []
      let newUrls: string[] | null = null
      let created: string[] = []
      let newCover: string | null = null
      let coverCreated = false
      const finalType = (update.content_type as string | undefined) ?? post.content_type
      try {
        if (a.imagens !== undefined) {
          const media = await storeAll(a.imagens)
          newUrls = media.urls
          created = media.created
          if (finalType === 'carrossel' && newUrls.length < 2) return fail('Carrossel precisa de pelo menos 2 imagens.')
          checkMediaRules(finalType, media.kinds)
          oldImages = images(post)
          update.media_url = newUrls[0]
          update.media_urls = newUrls
        } else if (a.formato !== undefined) {
          // só mudou o formato: confere se a mídia que já está no post continua valendo nele
          checkMediaRules(finalType, images(post).map(u => (isVideoUrl(u) ? 'video' : 'image')))
        }
        if (a.capa !== undefined && a.capa !== null) {
          newCover = await storeCover(a.capa)
          coverCreated = !(a.capa as ImageInput).url
          update.cover_url = newCover
        }
      } catch (e) {
        await deleteImages(created)
        throw e
      }
      if (Object.keys(update).length === 0) return fail('Nada para atualizar: informe pelo menos um campo além de post_id.')

      const resubmit = a.reenviar_para_aprovacao !== false
      if (resubmit) update.status = 'aguardando_aprovacao'
      update.updated_at = new Date().toISOString()

      const { data, error } = await db.from('content_posts').update(update).eq('id', post.id).select(POST_COLS).single()
      if (error || !data) {
        await deleteImages([...created, ...(coverCreated && newCover ? [newCover] : [])])
        return fail(`Erro ao atualizar o post: ${error?.message ?? 'desconhecido'}`)
      }
      // mídias e capa trocadas saem do armazenamento (as que continuam ficam)
      if (newUrls) await deleteImages(oldImages.filter(u => !newUrls!.includes(u)))
      if (newCover && post.cover_url && post.cover_url !== newCover) await deleteImages([post.cover_url])

      const { data: c } = await db.from('clients').select(CLIENT_COLS).eq('id', post.client_id).single()
      return {
        post_id: post.id,
        status: (data as PostRow).status,
        status_anterior: post.status,
        ...(c ? clientVisibility(c as ClientRow, (data as PostRow).scheduled_date) : {}),
        post: shapePost(data as PostRow),
      }
    },
  },
  {
    name: 'ver_status',
    description: 'Mostra o status atual de um post (aguardando aprovação, aprovado, reprovado...) e o retorno do cliente: o comentário/motivo do pedido de ajuste, os prints que ele anexou e se ele ajustou a legenda. O Hub guarda o último retorno do cliente, não um histórico completo.',
    inputSchema: {
      type: 'object',
      properties: { post_id: { type: 'string', description: 'Id do post.' } },
      required: ['post_id'],
      additionalProperties: false,
    },
    async run(a) {
      const db = createServiceClient()
      const post = await getPost(db, a.post_id)
      const { data: c } = await db.from('clients').select('name, share_slug, share_token').eq('id', post.client_id).single()
      return {
        cliente: c?.name ?? null,
        link_hub_do_cliente: c ? publicLink(c as ClientRow) : null,
        status: post.status,
        status_descricao: STATUS_LABEL[post.status] ?? post.status,
        comentario_do_cliente: post.rejection_reason,
        imagens_do_cliente: post.rejection_images ?? [],
        legenda_ajustada_pelo_cliente: !!post.caption_edited_by_client,
        legenda_atual: post.caption,
        atualizado_em: post.updated_at,
        post: shapePost(post),
      }
    },
  },
  {
    name: 'excluir_post',
    description: 'Exclui um post (e as imagens dele). Só funciona enquanto o post NÃO foi aprovado: posts aprovados, agendados ou publicados não podem ser excluídos por aqui.',
    inputSchema: {
      type: 'object',
      properties: { post_id: { type: 'string', description: 'Id do post.' } },
      required: ['post_id'],
      additionalProperties: false,
    },
    async run(a) {
      const db = createServiceClient()
      const post = await getPost(db, a.post_id)
      if (['aprovado', 'agendado', 'publicado'].includes(post.status)) {
        return fail(`Este post está "${STATUS_LABEL[post.status]}" e não pode ser excluído pelo conector. Exclua pelo Hub se for mesmo necessário.`)
      }
      const { error } = await db.from('content_posts').delete().eq('id', post.id)
      if (error) return fail(`Erro ao excluir: ${error.message}`)
      await deleteImages([...images(post), ...(post.cover_url ? [post.cover_url] : [])].filter(isOurUrl))
      return { excluido: true, post_id: post.id, titulo: post.title }
    },
  },
]

