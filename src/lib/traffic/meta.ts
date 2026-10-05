import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, daysInclusive, todayStr, type TrafficCampaign, type TrafficReport } from './metrics'
import { buildReportUpdate, type DailyRow, type MetaInsightRow } from './merge'

// A Meta guarda ~37 meses de histórico de insights; ficamos um pouco abaixo.
export const MAX_LOOKBACK_DAYS = 1095
// Períodos muito longos deixam a busca dia a dia lenta demais; 13 meses cobre "ano inteiro" com folga.
export const MAX_RANGE_DAYS = 400

const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? 'v23.0'}`

// Só contam as campanhas da agência: as que têm "OWL" no nome. Campanhas antigas
// ou de outras agências na mesma conta (ex: as do Stadium de antes da OWL) ficam
// de fora, tanto da lista quanto dos totais. Dá pra trocar com META_CAMPAIGN_TAG.
const CAMPAIGN_TAG = (process.env.META_CAMPAIGN_TAG ?? 'OWL').trim()

export function isAgencyCampaign(name?: string): boolean {
  return !CAMPAIGN_TAG || (name ?? '').toLowerCase().includes(CAMPAIGN_TAG.toLowerCase())
}

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
  // Os totais da conta também só somam as campanhas da agência (alcance não dá pra somar na mão).
  if (CAMPAIGN_TAG && path.endsWith('/insights') && !params.filtering) {
    url.searchParams.set('filtering', JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: CAMPAIGN_TAG }]))
  }

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

  const ours = campaigns.filter(c => isAgencyCampaign(c.campaign_name))
  const ourIds = new Set(ours.map(c => c.campaign_id))

  const update = buildReportUpdate({
    existing: report,
    account: account[0] ?? null,
    campaigns: ours,
    daily: daily.filter(d => ourIds.has(d.campaign_id)),
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

export interface CustomRangeResult {
  report: TrafficReport
  previous: TrafficReport | null
  timeline: TrafficReport[]
  granularity: 'day' | 'month'
}

const asBucket = (row: MetaInsightRow, base: TrafficReport): TrafficReport => ({
  period_start: row.date_start ?? base.period_start,
  period_end: row.date_stop ?? base.period_end,
  spend: Number(row.spend ?? 0),
  impressions: Number(row.impressions ?? 0),
  reach: Number(row.reach ?? 0),
  link_clicks: Number(row.inline_link_clicks ?? 0),
  results: 0,
  result_label: base.result_label,
  campaigns: [],
  analysis: null,
})

// Busca na Meta, na hora, um período qualquer escolhido por quem abriu a página:
// totais, campanhas (com os nomes/observações já guardados), evolução dentro do
// período e o período anterior de mesmo tamanho (pra comparar).
export async function fetchCustomRange(adAccountId: string, since: string, until: string, stored: TrafficReport[]): Promise<CustomRangeResult> {
  const today = todayStr()
  const act = `act_${adAccountId.replace(/^act_/, '').trim()}`
  const fields = 'spend,impressions,reach,inline_link_clicks'
  const days = daysInclusive(since, until)
  const granularity: 'day' | 'month' = days > 92 ? 'month' : 'day'
  const range = JSON.stringify({ since, until })

  const prevUntil = addDays(since, -1)
  const prevSince = addDays(prevUntil, -(days - 1))
  const prevAllowed = daysInclusive(prevSince, today) <= MAX_LOOKBACK_DAYS

  const [account, campaigns, daily, timelineRows, prevRows] = await Promise.all([
    graphGet<MetaInsightRow>(`${act}/insights`, { level: 'account', fields, time_range: range }),
    graphGet<MetaInsightRow>(`${act}/insights`, { level: 'campaign', fields: `campaign_id,campaign_name,${fields}`, time_range: range, limit: '500' }),
    graphGet<DailyRow>(`${act}/insights`, { level: 'campaign', fields: 'campaign_id,spend', time_increment: '1', time_range: range, limit: '5000' }),
    graphGet<MetaInsightRow>(`${act}/insights`, { level: 'account', fields, time_increment: granularity === 'day' ? '1' : 'monthly', time_range: range, limit: '500' }),
    prevAllowed
      ? graphGet<MetaInsightRow>(`${act}/insights`, { level: 'account', fields, time_range: JSON.stringify({ since: prevSince, until: prevUntil }) }).catch(() => [] as MetaInsightRow[])
      : Promise.resolve([] as MetaInsightRow[]),
  ])

  // Nomes e observações escritos à mão ficam, em qualquer período (o mais recente vale).
  const sorted = [...stored].sort((a, b) => a.period_start.localeCompare(b.period_start))
  const byId = new Map<string, TrafficCampaign>()
  for (const r of sorted) for (const c of r.campaigns) if (c.id) byId.set(c.id, c)

  const base: TrafficReport = {
    period_start: since,
    period_end: until,
    spend: 0, impressions: 0, reach: 0, link_clicks: 0, results: 0,
    result_label: sorted[sorted.length - 1]?.result_label ?? 'Cliques no link',
    campaigns: [...byId.values()],
    analysis: null,
  }

  const ours = campaigns.filter(c => isAgencyCampaign(c.campaign_name))
  const ourIds = new Set(ours.map(c => c.campaign_id))

  const update = buildReportUpdate({
    existing: base,
    account: account[0] ?? null,
    campaigns: ours,
    daily: daily.filter(d => ourIds.has(d.campaign_id)),
    liveSince: until >= today ? addDays(today, -1) : until,
    keepUnseen: false,
  })
  // O dia de início só vale se a campanha começou dentro do período escolhido.
  const report: TrafficReport = { ...base, ...update, campaigns: update.campaigns.map(c => ({ ...c, results: 0 })) }

  const previous = prevRows[0] && Number(prevRows[0].spend ?? 0) > 0
    ? { ...asBucket(prevRows[0], base), period_start: prevSince, period_end: prevUntil }
    : null

  return { report, previous, timeline: timelineRows.map(r => asBucket(r, base)), granularity }
}
