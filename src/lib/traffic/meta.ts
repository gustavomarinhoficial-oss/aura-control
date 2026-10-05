import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, todayStr, type TrafficReport } from './metrics'
import { buildReportUpdate, type DailyRow, type MetaInsightRow } from './merge'

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? 'v23.0'}`

export class MetaError extends Error {
  code: string
  constructor(message: string, code = 'meta') {
    super(message)
    this.code = code
  }
}

export function metaConfigured(): boolean {
  return !!process.env.META_ADS_TOKEN
}

function describe(err: { message?: string; code?: number }): string {
  if (err.code === 190) return 'O token da Meta é inválido ou expirou — gere um novo no usuário do sistema.'
  if (err.code === 200 || err.code === 10 || err.code === 294) {
    return 'O token não tem permissão pra ler essa conta de anúncios. Confira se a conta foi adicionada ao usuário do sistema com "Ver desempenho".'
  }
  if (err.code === 100) return 'A Meta não encontrou essa conta de anúncios (ID errado ou sem acesso).'
  return err.message ?? 'Erro ao falar com a Meta.'
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const token = process.env.META_ADS_TOKEN
  if (!token) throw new MetaError('Falta configurar o META_ADS_TOKEN (token de leitura da Meta) na Vercel.', 'no_token')

  const url = new URL(`${GRAPH}/${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const rows: T[] = []
  let next: string | null = url.toString()
  for (let page = 0; next && page < 20; page++) {
    const res: Response = await fetch(next, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    if (json.error) throw new MetaError(describe(json.error), String(json.error.code ?? 'meta'))
    rows.push(...((json.data ?? []) as T[]))
    next = json.paging?.next ?? null
  }
  return rows
}

// Puxa da Meta os números de um período e grava no relatório (mantendo o que
// foi escrito à mão). Só mexe em período que já começou.
export async function syncReportFromMeta(supabase: SupabaseClient, clientId: string, adAccountId: string, report: TrafficReport) {
  const today = todayStr()
  if (today < report.period_start) throw new MetaError('Esse período ainda não começou.', 'future')

  const closed = report.period_end < today
  const until = closed ? report.period_end : today
  const act = `act_${adAccountId.replace(/^act_/, '').trim()}`
  const fields = 'spend,impressions,reach,inline_link_clicks'

  const [account, campaigns, daily] = await Promise.all([
    graphGet<MetaInsightRow>(`${act}/insights`, {
      level: 'account', fields, time_range: JSON.stringify({ since: report.period_start, until }),
    }),
    graphGet<MetaInsightRow>(`${act}/insights`, {
      level: 'campaign', fields: `campaign_id,campaign_name,${fields}`, time_range: JSON.stringify({ since: report.period_start, until }), limit: '500',
    }),
    // Dia a dia, a partir de 45 dias antes do período, pra achar o dia real em que cada campanha começou.
    graphGet<DailyRow>(`${act}/insights`, {
      level: 'campaign', fields: 'campaign_id,spend', time_increment: '1',
      time_range: JSON.stringify({ since: addDays(report.period_start, -45), until }), limit: '1000',
    }),
  ])

  const update = buildReportUpdate({
    existing: report,
    account: account[0] ?? null,
    campaigns,
    daily,
    liveSince: closed ? report.period_end : addDays(today, -1),
  })

  const { error } = await supabase
    .from('traffic_reports')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('period_start', report.period_start)
  if (error) throw new MetaError(error.message, 'db')

  return { campaigns: update.campaigns.length, spend: update.spend, reach: update.reach, link_clicks: update.link_clicks }
}
