import type { TrafficCampaign } from './metrics'

// Aceita "1.234,56", "1,234.56", "1234.56", "R$ 1.234,56", "12,5%" etc.
export function parseNum(raw: string | undefined | null): number {
  if (raw === undefined || raw === null) return 0
  let s = String(raw).trim().replace(/[^\d.,-]/g, '')
  if (!s || s === '-') return 0
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (lastComma >= 0) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (lastDot >= 0) {
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '')
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ } else inQuotes = !inQuotes
    } else if (ch === delim && !inQuotes) {
      out.push(cur); cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map(c => c.trim())
}

function detectDelimiter(headerLine: string): string {
  const candidates = ['\t', ';', ',']
  let best = ','
  let bestCount = -1
  for (const d of candidates) {
    const count = splitLine(headerLine, d).length
    if (count > bestCount) { best = d; bestCount = count }
  }
  return best
}

export interface ParsedExport {
  campaigns: TrafficCampaign[]
  totals: { spend: number; impressions: number; reach: number; link_clicks: number; results: number }
  hasTotalRow: boolean
}

// Le o export (CSV/TSV) do Gerenciador de Anuncios da Meta ou uma tabela
// colada da tela. Reconhece os cabecalhos em portugues e ingles.
export function parseAdsExport(text: string): ParsedExport | null {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return null
  const delim = detectDelimiter(lines[0])
  const headers = splitLine(lines[0], delim).map(normalize)

  const find = (pred: (h: string) => boolean) => headers.findIndex(pred)
  const idx = {
    name: find(h => h === 'nome da campanha' || h === 'campaign name' || h === 'campanha' || h === 'campaign'),
    spend: find(h => h.startsWith('valor usado') || h.startsWith('amount spent') || h === 'gasto' || h === 'investimento'),
    impressions: find(h => h.startsWith('impress')),
    reach: find(h => h.startsWith('alcance') || h === 'reach'),
    clicks: find(h => h.startsWith('cliques no link') || h.startsWith('link clicks')),
    results: find(h => h.startsWith('resultados') || h === 'results'),
  }
  if (idx.name < 0 || (idx.spend < 0 && idx.impressions < 0 && idx.clicks < 0)) return null

  const get = (cells: string[], i: number) => (i >= 0 ? parseNum(cells[i]) : 0)
  const campaigns: TrafficCampaign[] = []
  let totalRow: ParsedExport['totals'] | null = null

  for (const line of lines.slice(1)) {
    const cells = splitLine(line, delim)
    const name = (cells[idx.name] ?? '').trim()
    const row = {
      spend: get(cells, idx.spend),
      impressions: get(cells, idx.impressions),
      reach: get(cells, idx.reach),
      link_clicks: get(cells, idx.clicks),
      results: get(cells, idx.results),
    }
    const n = normalize(name)
    if (!name || n.startsWith('total') || n.startsWith('resultados de')) {
      if (n.startsWith('total') || n.startsWith('resultados de')) totalRow = row
      continue
    }
    campaigns.push({ name, ...row })
  }
  if (campaigns.length === 0) return null

  const sum = (k: keyof ParsedExport['totals']) => campaigns.reduce((s, c) => s + c[k], 0)
  const totals = totalRow ?? {
    spend: sum('spend'),
    impressions: sum('impressions'),
    reach: sum('reach'),
    link_clicks: sum('link_clicks'),
    results: sum('results'),
  }
  return { campaigns, totals, hasTotalRow: totalRow !== null }
}
