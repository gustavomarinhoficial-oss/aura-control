import type { SupabaseClient } from '@supabase/supabase-js'
import { MAX_LOOKBACK_DAYS, MAX_RANGE_DAYS, fetchCustomRange, metaConfigured } from './meta'
import { addDays, daysInclusive, todayStr, type TrafficReport } from './metrics'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// Período livre só existe pra cliente ligado à Meta (os números vêm de lá, na hora).
export function customAvailable(adAccountId: string | null | undefined): boolean {
  return !!adAccountId && metaConfigured()
}

// Valida as datas escolhidas, busca na Meta e monta a resposta usada pelo painel
// e pela página do cliente (mesmo formato nos dois).
export async function buildCustomPayload(
  supabase: SupabaseClient,
  clientId: string,
  adAccountId: string | null | undefined,
  from: string | null,
  to: string | null,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!customAvailable(adAccountId)) return { status: 400, body: { error: 'Período livre indisponível' } }
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return { status: 400, body: { error: 'Período inválido' } }
  }

  const today = todayStr()
  const until = to > today ? today : to
  const earliest = addDays(today, -MAX_LOOKBACK_DAYS)
  const since = from < earliest ? earliest : from
  if (since > until) return { status: 400, body: { error: 'Período inválido' } }
  if (daysInclusive(since, until) > MAX_RANGE_DAYS) {
    return { status: 400, body: { error: 'Escolha no máximo 13 meses de uma vez.' } }
  }

  const { data: stored } = await supabase.from('traffic_reports').select('*').eq('client_id', clientId)
  try {
    const result = await fetchCustomRange(adAccountId as string, since, until, (stored ?? []) as TrafficReport[])
    const periods = (stored ?? [])
      .map(r => ({ start: r.period_start as string, end: r.period_end as string }))
      .sort((a, b) => b.start.localeCompare(a.start))
    return {
      status: 200,
      body: {
        mode: 'custom', canCustom: true, days: daysInclusive(since, until), granularity: result.granularity,
        report: result.report, previous: result.previous, history: result.timeline, periods,
      },
    }
  } catch {
    return { status: 502, body: { error: 'Não consegui buscar os números agora. Tente de novo em instantes.' } }
  }
}
