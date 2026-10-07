import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadTrafficBundle } from '@/lib/traffic/server'
import { refreshIfStale } from '@/lib/traffic/refresh'
import { MAX_LOOKBACK_DAYS, MAX_RANGE_DAYS, fetchCustomRange, metaConfigured } from '@/lib/traffic/meta'
import { addDays, daysInclusive, todayStr, type TrafficReport } from '@/lib/traffic/metrics'

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

  // Período livre só existe pra cliente ligado à Meta (os números vêm de lá, na hora).
  const canCustom = !!client.meta_ad_account_id && metaConfigured()
  const info = { id: client.id, name: client.name }

  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (from || to) {
    if (!canCustom) return NextResponse.json({ error: 'Período livre indisponível' }, { status: 400 })
    if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
      return NextResponse.json({ error: 'Período inválido' }, { status: 400 })
    }
    const today = todayStr()
    const until = to > today ? today : to
    const earliest = addDays(today, -MAX_LOOKBACK_DAYS)
    const since = from < earliest ? earliest : from
    if (since > until) return NextResponse.json({ error: 'Período inválido' }, { status: 400 })
    if (daysInclusive(since, until) > MAX_RANGE_DAYS) {
      return NextResponse.json({ error: 'Escolha no máximo 13 meses de uma vez.' }, { status: 400 })
    }

    const { data: stored } = await supabase.from('traffic_reports').select('*').eq('client_id', client.id)
    try {
      const result = await fetchCustomRange(client.meta_ad_account_id as string, since, until, (stored ?? []) as TrafficReport[])
      const periods = (stored ?? [])
        .map(r => ({ start: r.period_start as string, end: r.period_end as string }))
        .sort((a, b) => b.start.localeCompare(a.start))
      return NextResponse.json(
        {
          client: info, mode: 'custom', canCustom, days: daysInclusive(since, until), granularity: result.granularity,
          report: result.report, previous: result.previous, history: result.timeline, periods,
        },
        // Evita martelar a Meta se várias pessoas abrirem o mesmo período.
        { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } },
      )
    } catch {
      return NextResponse.json({ error: 'Não consegui buscar os números agora. Tente de novo em instantes.' }, { status: 502 })
    }
  }

  const start = searchParams.get('start')
  const first = await loadTrafficBundle(supabase, client.id, start && DATE_RE.test(start) ? start : null)
  // Números velhos (mais de 30 min) do período em andamento: atualiza com a Meta antes de responder.
  const bundle = await refreshIfStale(supabase, client.id, client.meta_ad_account_id, first)

  return NextResponse.json({ client: info, mode: 'period', canCustom, ...bundle })
}
