import { NextResponse } from 'next/server'
import { createServiceClient, requireUser, unauthorized } from '@/lib/supabase/server'

const EMPTY_EXTRAS = {
  responsavel: '', objectives: '', social_media: [], links: [], passwords: [],
  mission: '', positioning: '', target_audience: '', competitors: '',
  tone_of_voice: '', avoid_topics: '', brand_colors: '', brand_manual_url: '',
  products_services: '', recurring_promos: '', responsible_contacts: [],
  content_pillars: '', content_goal: '', instagram_notes: '',
  default_content_mix: {},
}

// Segunda camada de checagem além do proxy — esta rota carrega senhas/acessos
// dos clientes, então confere sessão de novo aqui dentro (defesa em profundidade).
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireUser())) return unauthorized()
  const { id } = await params
  const supabase = createServiceClient()
  const { data } = await supabase.from('client_extras').select('*').eq('client_id', id).single()
  return NextResponse.json(data ?? { client_id: id, ...EMPTY_EXTRAS })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireUser())) return unauthorized()
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  const payload = {
    client_id: id,
    responsavel: body.responsavel ?? '',
    objectives: body.objectives ?? '',
    social_media: body.social_media ?? [],
    links: body.links ?? [],
    passwords: body.passwords ?? [],
    mission: body.mission ?? '',
    positioning: body.positioning ?? '',
    target_audience: body.target_audience ?? '',
    competitors: body.competitors ?? '',
    tone_of_voice: body.tone_of_voice ?? '',
    avoid_topics: body.avoid_topics ?? '',
    brand_colors: body.brand_colors ?? '',
    brand_manual_url: body.brand_manual_url ?? '',
    products_services: body.products_services ?? '',
    recurring_promos: body.recurring_promos ?? '',
    responsible_contacts: body.responsible_contacts ?? [],
    content_pillars: body.content_pillars ?? '',
    content_goal: body.content_goal ?? '',
    instagram_notes: body.instagram_notes ?? '',
    default_content_mix: body.default_content_mix ?? {},
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('client_extras')
    .upsert(payload, { onConflict: 'client_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
