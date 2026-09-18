import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createServiceClient, requireUser, unauthorized } from '@/lib/supabase/server'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = 'openai/gpt-oss-120b'

const TYPE_LABELS: Record<string, string> = { reels: 'Reels', feed: 'Estático', carrossel: 'Carrossel' }
const VALID_TYPES = ['reels', 'feed', 'carrossel']
// A IA às vezes escreve variações em vez da chave exata pedida no prompt — normaliza antes de validar.
const TYPE_ALIASES: Record<string, string> = {
  estatico: 'feed', estático: 'feed', post: 'feed', foto: 'feed', imagem: 'feed',
  reel: 'reels', video: 'reels', vídeo: 'reels',
  carousel: 'carrossel', carrosel: 'carrossel',
}
function normalizeContentType(raw: string | undefined): string {
  const v = (raw ?? '').trim().toLowerCase()
  return VALID_TYPES.includes(v) ? v : (TYPE_ALIASES[v] ?? v)
}

function describeError(err: unknown): string {
  if (err instanceof Groq.RateLimitError) {
    const retryAfter = err.headers?.get?.('retry-after')
    const wait = retryAfter ? ` Tenta de novo em ~${retryAfter}s.` : ' Tenta de novo daqui a pouco.'
    return `Bati no limite gratuito de uso da Groq por agora (é o plano free da API).${wait}`
  }
  if (err instanceof Groq.APIError) {
    return `A Groq não respondeu direito agora (erro ${err.status ?? ''}). Tenta de novo em instantes.`
  }
  return err instanceof Error ? err.message : 'Erro inesperado ao gerar o calendário'
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireUser())) return unauthorized()
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  const month = body.month as string
  const counts = (body.counts ?? {}) as { reels?: number; feed?: number; carrossel?: number }
  const focus = ((body.focus as string) || '').trim()
  const avoid = ((body.avoid as string) || '').trim()

  const total = (counts.reels || 0) + (counts.feed || 0) + (counts.carrossel || 0)
  if (!/^\d{4}-\d{2}$/.test(month || '') || total <= 0) {
    return NextResponse.json({ error: 'Informe o mês e ao menos 1 post pra gerar.' }, { status: 400 })
  }

  const [{ data: client }, { data: extras }, { data: recentPosts }] = await Promise.all([
    supabase.from('clients').select('name').eq('id', id).single(),
    supabase.from('client_extras').select('*').eq('client_id', id).single(),
    supabase.from('content_posts')
      .select('title, content_type, scheduled_date')
      .eq('client_id', id)
      .order('scheduled_date', { ascending: false, nullsFirst: false })
      .limit(40),
  ])

  if (!client) return NextResponse.json({ error: 'Cliente não encontrado.' }, { status: 404 })

  const brandBrief = extras ? `
Missão: ${extras.mission || '-'}
Posicionamento: ${extras.positioning || '-'}
Público-alvo: ${extras.target_audience || '-'}
Concorrentes: ${extras.competitors || '-'}
Tom de voz: ${extras.tone_of_voice || '-'}
O que evitar sempre (regra permanente da marca): ${extras.avoid_topics || '-'}
Produtos/Serviços: ${extras.products_services || '-'}
Promoções recorrentes: ${extras.recurring_promos || '-'}
Pilares de conteúdo: ${extras.content_pillars || '-'}
Objetivo de conteúdo: ${extras.content_goal || '-'}
Notas de Instagram: ${extras.instagram_notes || '-'}
`.trim() : 'Nenhum dado de marca cadastrado ainda no Hub — gere ideias genéricas de agência, mas avise que o resultado ficaria melhor com o Hub preenchido.'

  const recentTitles = (recentPosts ?? [])
    .map(p => `- ${p.title} (${TYPE_LABELS[p.content_type ?? ''] ?? p.content_type ?? 'sem tipo'})`)
    .join('\n') || 'Nenhum post recente.'

  const formatList = (['reels', 'feed', 'carrossel'] as const)
    .filter(k => (counts[k] || 0) > 0)
    .map(k => `${counts[k]}x content_type="${k}" (${TYPE_LABELS[k]})`)
    .join(', ')

  const prompt = `Você é estrategista de conteúdo de uma agência de marketing. Gere um ESQUELETO de calendário editorial para o cliente "${client.name}", mês de referência ${month}.

Perfil da marca:
${brandBrief}

Posts recentes desse cliente (não repita os mesmos temas):
${recentTitles}

Foco deste mês: ${focus || 'não informado'}
O que evitar neste mês especificamente: ${avoid || 'não informado'}

Gere exatamente ${total} ideias de post, sendo: ${formatList}.
Cada ideia deve ser específica e não-genérica pra essa marca, coerente com o tom de voz e os pilares de conteúdo dela.

IMPORTANTE: o campo "content_type" de cada post deve ser exatamente uma destas três strings, sempre em minúsculo, sem acento: "reels", "feed" ou "carrossel". Use "feed" para o formato Estático/Post — nunca escreva "estatico", "estático", "post" ou "foto".

Responda APENAS com um JSON válido neste formato exato:
{"posts": [{"title": "título curto do post", "content_type": "reels", "ideia": "explicação de 1-2 frases do racional/ângulo dessa pauta"}]}`

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    let parsed: { posts?: Array<{ title?: string; content_type?: string; ideia?: string }> }
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'A IA retornou um formato inesperado. Tenta gerar de novo.' }, { status: 502 })
    }

    const posts = (parsed.posts ?? [])
      .map(p => ({ ...p, content_type: normalizeContentType(p.content_type) }))
      .filter((p): p is { title: string; content_type: string; ideia?: string } => !!p.title && VALID_TYPES.includes(p.content_type))
      .slice(0, total)

    if (posts.length === 0) {
      return NextResponse.json({ error: 'A IA não retornou nenhuma ideia válida. Tenta gerar de novo.' }, { status: 502 })
    }

    const [year, mon] = month.split('-').map(Number)
    const daysInMonth = new Date(year, mon, 0).getDate()
    const step = daysInMonth / posts.length

    const rows = posts.map((p, i) => {
      const day = Math.min(daysInMonth, Math.max(1, Math.round(i * step) + 1))
      return {
        client_id: id,
        title: p.title,
        platform: 'instagram',
        content_type: p.content_type,
        status: 'rascunho',
        scheduled_date: `${month}-${String(day).padStart(2, '0')}`,
        notes: p.ideia || null,
        result: {},
        media_urls: [],
      }
    })

    const { data: inserted, error } = await supabase.from('content_posts').insert(rows).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ created: inserted?.length ?? 0 })
  } catch (err) {
    return NextResponse.json({ error: describeError(err) }, { status: 502 })
  }
}
