import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadTrafficBundle } from '@/lib/traffic/server'
import { buildCustomPayload, customAvailable } from '@/lib/traffic/custom'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const maxDuration = 30

// GET /api/public/traffic?token=X
//   &start=YYYY-MM-DD            → um período publicado (sem start: o que está rodando hoje)
//   &from=YYYY-MM-DD&to=...      → período livre escolhido por quem abriu a página (busca na Meta na hora)
// Devolve só os números de tráfego do cliente dono do token, e só se o
// compartilhamento estiver ligado pra ele. Nunca dados internos.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, traffic_sharing_enabled, meta_ad_account_id')
    .eq('share_token', token)
    .maybeSingle()
  if (!client) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  if (client.traffic_sharing_enabled !== true) {
    return NextResponse.json({ error: 'Relatório indisponível' }, { status: 403 })
  }

  const canCustom = customAvailable(client.meta_ad_account_id)
  const info = { id: client.id, name: client.name }

  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (from || to) {
    const { status, body } = await buildCustomPayload(supabase, client.id, client.meta_ad_account_id, from, to)
    return NextResponse.json(
      status === 200 ? { client: info, ...body } : body,
      // Evita martelar a Meta se várias pessoas abrirem o mesmo período.
      { status, headers: status === 200 ? { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } : undefined },
    )
  }

  const start = searchParams.get('start')
  const bundle = await loadTrafficBundle(supabase, client.id, start && DATE_RE.test(start) ? start : null)

  return NextResponse.json({ client: info, mode: 'period', canCustom, ...bundle })
}
