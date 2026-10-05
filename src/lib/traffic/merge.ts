import type { TrafficCampaign, TrafficReport } from './metrics'

// Linha devolvida pela Marketing API (insights). Os números chegam como texto.
export interface MetaInsightRow {
  campaign_id?: string
  campaign_name?: string
  spend?: string
  impressions?: string
  reach?: string
  inline_link_clicks?: string
  date_start?: string
  date_stop?: string
}

const num = (v?: string) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

const MONTHS = 'janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro'

// Tira os "rótulos internos" do nome da campanha na Meta ([OWL], (Setembro/26),
// (NÃO FINALIZADA)) pra mostrar um nome limpo pro cliente.
export function cleanCampaignName(raw: string): string {
  const cleaned = raw
    .replace(/^\s*\[[^\]]*\]\s*/, '')
    .replace(new RegExp('\\s*\\((?:' + MONTHS + ')\\/\\d{2,4}\\)\\s*$', 'i'), '')
    .replace(/\s*\(n[aã]o finalizada\)\s*/i, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return cleaned || raw.trim()
}

export interface DailyRow { campaign_id: string; spend: string; date_start: string }

// Une os números da Meta com o relatório que já existe, sem apagar o que foi
// escrito à mão (nome da campanha, observação, resultado, análise).
//  - liveSince: dia a partir do qual uma campanha que ainda gastou conta como "no ar"
//    (ontem, se o período está rodando; o último dia, se já fechou).
export function buildReportUpdate(opts: {
  existing: TrafficReport | null
  account: MetaInsightRow | null
  campaigns: MetaInsightRow[]
  daily: DailyRow[]
  liveSince: string
  // false = descarta campanhas guardadas que a Meta não devolveu (usado em períodos personalizados)
  keepUnseen?: boolean
}): Pick<TrafficReport, 'spend' | 'impressions' | 'reach' | 'link_clicks' | 'campaigns'> {
  const { existing, account, campaigns, daily, liveSince, keepUnseen = true } = opts

  // Primeiro e último dia com gasto de cada campanha.
  const span = new Map<string, { first: string; last: string }>()
  for (const d of daily) {
    if (num(d.spend) <= 0) continue
    const cur = span.get(d.campaign_id)
    if (!cur) span.set(d.campaign_id, { first: d.date_start, last: d.date_start })
    else {
      if (d.date_start < cur.first) cur.first = d.date_start
      if (d.date_start > cur.last) cur.last = d.date_start
    }
  }

  const previous = existing?.campaigns ?? []
  const seen = new Set<string>()
  const merged: TrafficCampaign[] = []

  for (const row of campaigns) {
    const id = row.campaign_id
    if (!id) continue
    const spend = num(row.spend)
    const impressions = num(row.impressions)
    if (spend <= 0 && impressions <= 0) continue
    seen.add(id)

    const old = previous.find(c => c.id === id)
    const s = span.get(id)
    merged.push({
      id,
      name: old?.name ?? cleanCampaignName(row.campaign_name ?? id),
      note: old?.note ?? null,
      start_date: s?.first ?? old?.start_date ?? null,
      end_date: s ? (s.last < liveSince ? s.last : null) : old?.end_date ?? null,
      spend,
      impressions,
      reach: num(row.reach),
      link_clicks: num(row.inline_link_clicks),
      results: old?.results ?? 0,
    })
  }

  // Campanhas lançadas à mão (ou que a Meta não devolveu agora) ficam como estão.
  if (keepUnseen) {
    for (const old of previous) {
      if (!old.id || !seen.has(old.id)) merged.push(old)
    }
  }

  return {
    spend: account ? num(account.spend) : existing?.spend ?? 0,
    impressions: account ? num(account.impressions) : existing?.impressions ?? 0,
    reach: account ? num(account.reach) : existing?.reach ?? 0,
    link_clicks: account ? num(account.inline_link_clicks) : existing?.link_clicks ?? 0,
    campaigns: merged,
  }
}
