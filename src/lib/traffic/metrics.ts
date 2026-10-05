export interface TrafficCampaign {
  name: string
  spend: number
  impressions: number
  reach: number
  link_clicks: number
  results: number
}

export interface TrafficReport {
  id?: string
  client_id?: string
  month: string
  spend: number
  impressions: number
  reach: number
  link_clicks: number
  results: number
  result_label: string
  campaigns: TrafficCampaign[]
  analysis: string | null
  updated_at?: string
}

export interface TrafficBundle {
  report: TrafficReport | null
  previous: TrafficReport | null
  history: TrafficReport[]
  months: string[]
}

export const TRAFFIC_COLORS = {
  reach: '#60a5fa',
  impressions: '#a78bfa',
  clicks: '#34d399',
  spend: '#fbbf24',
  results: '#f472b6',
}

export function computeMetrics(r: Pick<TrafficReport, 'spend' | 'impressions' | 'reach' | 'link_clicks' | 'results'>) {
  const spend = Number(r.spend)
  const impressions = Number(r.impressions)
  const reach = Number(r.reach)
  const clicks = Number(r.link_clicks)
  const results = Number(r.results)
  return {
    cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
    cpcLink: clicks > 0 ? spend / clicks : null,
    costPerResult: results > 0 ? spend / results : null,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : null,
    frequency: reach > 0 ? impressions / reach : null,
  }
}

export function pctChange(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null
  return ((cur - prev) / prev) * 100
}

export function prevMonthStr(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function currentMonthStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export function monthTitle(month: string): string {
  const l = monthLabel(month)
  return l.charAt(0).toUpperCase() + l.slice(1)
}

export function monthLabelShort(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const mon = new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  return `${mon}/${String(y).slice(2)}`
}

export const fmtInt = (n: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(n))
export const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
export const fmtDec = (n: number, digits = 1) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
