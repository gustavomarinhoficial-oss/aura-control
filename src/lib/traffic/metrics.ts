export interface TrafficCampaign {
  id?: string
  name: string
  start_date?: string | null
  end_date?: string | null
  note?: string | null
  spend: number
  impressions: number
  reach: number
  link_clicks: number
  results: number
}

export interface TrafficReport {
  id?: string
  client_id?: string
  period_start: string
  period_end: string
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

export interface TrafficPeriod { start: string; end: string }

export interface TrafficBundle {
  report: TrafficReport | null
  previous: TrafficReport | null
  history: TrafficReport[]
  periods: TrafficPeriod[]
  // true quando dá pra escolher qualquer período (cliente ligado à Meta)
  canCustom?: boolean
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

// ── datas (sempre "YYYY-MM-DD", fuso de São Paulo pro "hoje") ────────────────
export function todayStr(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function parseIso(iso: string): Date {
  return new Date(iso + 'T12:00:00')
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(iso: string, n: number): string {
  const d = parseIso(iso)
  d.setDate(d.getDate() + n)
  return toIso(d)
}

// Mesmo dia do mês seguinte, menos 1 dia (ex: 15/09 → 14/10). Ciclo de 1 mês.
export function endOfCycle(startIso: string): string {
  const d = parseIso(startIso)
  d.setMonth(d.getMonth() + 1)
  d.setDate(d.getDate() - 1)
  return toIso(d)
}

export function daysInclusive(startIso: string, endIso: string): number {
  return Math.round((parseIso(endIso).getTime() - parseIso(startIso).getTime()) / 86400000) + 1
}

export function fmtDayMonth(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function fmtDayMonthYear(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function periodLabel(start: string, end: string): string {
  return `${fmtDayMonthYear(start)} a ${fmtDayMonthYear(end)}`
}

export function periodChip(start: string, end: string): string {
  return `${fmtDayMonth(start)} – ${fmtDayMonth(end)}`
}

export function periodStatus(start: string, end: string, today = todayStr()): 'future' | 'running' | 'closed' {
  if (today < start) return 'future'
  if (today <= end) return 'running'
  return 'closed'
}

export const fmtInt = (n: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Math.round(n))
export const fmtBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
export const fmtDec = (n: number, digits = 1) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)
