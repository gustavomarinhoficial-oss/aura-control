'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ChevronLeft, ChevronRight, Pencil, Share2, Check, ExternalLink, Copy, X, Plus, Trash2,
  ClipboardPaste, AlertCircle, BarChart3, Eye, EyeOff,
} from 'lucide-react'
import { TrafficDashboard } from '@/components/domain/traffic/TrafficDashboard'
import {
  todayStr, addDays, endOfCycle, periodLabel, periodStatus, fmtInt,
  type TrafficBundle, type TrafficCampaign, type TrafficReport,
} from '@/lib/traffic/metrics'
import { parseAdsExport, parseNum } from '@/lib/traffic/import'

interface Client { id: string; name: string; status: string; priority?: number | null; traffic_sharing_enabled?: boolean | null }

const EMPTY_BUNDLE: TrafficBundle = { report: null, previous: null, history: [], periods: [] }

export default function TrafegoPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')
  const [selectedStart, setSelectedStart] = useState<string | null>(null)
  const [bundle, setBundle] = useState<TrafficBundle>(EMPTY_BUNDLE)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const client = clients.find(c => c.id === clientId)

  useEffect(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then((d: Client[]) => {
        const list = (Array.isArray(d) ? d : [])
          .filter(c => c.status === 'ativo')
          .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
        setClients(list)
        if (list[0]) setClientId(list[0].id)
        else setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const loadReport = useCallback(async (id: string, start: string | null) => {
    const qs = start ? `?start=${start}` : ''
    const res = await fetch(`/api/clients/${id}/traffic${qs}`).then(r => r.json()).catch(() => null)
    setBundle(res && !res.error ? res : EMPTY_BUNDLE)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (clientId) loadReport(clientId, selectedStart)
  }, [clientId, selectedStart, loadReport])

  useEffect(() => {
    if (!clientId) return
    fetch(`/api/clients/${clientId}/share-link`)
      .then(r => r.json())
      .then(d => setToken(d.token ?? null))
      .catch(() => setToken(null))
  }, [clientId])

  async function toggleSharing() {
    if (!client) return
    const next = !client.traffic_sharing_enabled
    setClients(cs => cs.map(c => c.id === client.id ? { ...c, traffic_sharing_enabled: next } : c))
    await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traffic_sharing_enabled: next }),
    })
  }

  const publicUrl = token && typeof window !== 'undefined' ? `${window.location.origin}/publico/${token}/trafego` : ''

  function copyLink() {
    navigator.clipboard.writeText(publicUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function selectClient(id: string) {
    setLoading(true)
    setSelectedStart(null)
    setClientId(id)
  }

  const currentStart = bundle.report?.period_start ?? null
  const periodIdx = bundle.periods.findIndex(p => p.start === currentStart)

  // periods vem do mais novo pro mais antigo: "anterior" = índice maior.
  function goPeriod(delta: -1 | 1) {
    const target = bundle.periods[periodIdx + delta]
    if (target) setSelectedStart(target.start)
  }

  // Sugere o próximo período: começa no dia seguinte ao fim do último e dura um ciclo de 1 mês.
  const lastEnd = bundle.periods[0]?.end ?? null
  const newDefaults = (() => {
    const start = lastEnd ? addDays(lastEnd, 1) : todayStr()
    return { start, end: endOfCycle(start) }
  })()

  const sharing = !!client?.traffic_sharing_enabled
  const status = bundle.report ? periodStatus(bundle.report.period_start, bundle.report.period_end) : null

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tráfego pago</h1>
          <p className="text-sm text-muted-foreground mt-1">Números das campanhas e a página que o cliente vê</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={clientId}
            onChange={e => selectClient(e.target.value)}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors max-w-[220px]"
          >
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
            <button
              onClick={() => goPeriod(1)}
              disabled={periodIdx < 0 || periodIdx >= bundle.periods.length - 1}
              title="Período anterior"
              className="p-2 hover:bg-[#222222] rounded-l-lg transition-colors disabled:opacity-30"
            ><ChevronLeft size={14} /></button>
            <span className="text-xs px-3 min-w-[190px] text-center flex items-center justify-center gap-1.5">
              {status === 'running' && <span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24]" title="Em andamento" />}
              {bundle.report ? periodLabel(bundle.report.period_start, bundle.report.period_end) : 'Sem períodos'}
            </span>
            <button
              onClick={() => goPeriod(-1)}
              disabled={periodIdx <= 0}
              title="Próximo período"
              className="p-2 hover:bg-[#222222] rounded-r-lg transition-colors disabled:opacity-30"
            ><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {client && (
        <div className="flex items-center gap-2 flex-wrap">
          {bundle.report && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111] text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Pencil size={14} /> Editar este período
            </button>
          )}
          <button
            onClick={() => setCreating(true)}
            className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              bundle.report
                ? 'border border-[#2a2a2a] hover:bg-[#1a1a1a] text-muted-foreground hover:text-foreground'
                : 'bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111]'
            }`}
          >
            <Plus size={14} /> Novo período
          </button>
          <button
            onClick={toggleSharing}
            title={sharing ? 'O cliente consegue abrir o relatório — clique pra desativar' : 'O cliente não consegue abrir o relatório — clique pra liberar'}
            className={`flex items-center gap-2 border text-sm px-4 py-2 rounded-lg transition-colors font-medium ${
              sharing
                ? 'border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20'
                : 'border-[#2a2a2a] text-muted-foreground hover:bg-[#1a1a1a] hover:text-foreground'
            }`}
          >
            {sharing ? <Eye size={14} /> : <EyeOff size={14} />}
            Compartilhamento {sharing ? 'ativado' : 'desativado'}
          </button>
          {sharing && publicUrl && (
            <>
              <button
                onClick={copyLink}
                className="flex items-center gap-2 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-sm px-4 py-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check size={14} className="text-[#22c55e]" /> : <Copy size={14} />}
                {copied ? 'Link copiado' : 'Copiar link'}
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-sm px-4 py-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
              >
                <ExternalLink size={14} /> Abrir
              </a>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-[#efefef] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !client ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
          <BarChart3 size={28} className="text-muted-foreground" strokeWidth={1} />
          <p className="text-sm font-medium">Nenhum cliente ativo</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
            <Share2 size={12} />
            <span>É assim que {client.name} vê o relatório{sharing ? '' : ' (quando você liberar o compartilhamento)'}.</span>
          </div>
          <div className="rounded-2xl bg-[#0d0d0d] border border-[#1f1f1f] p-4 sm:p-6">
            <TrafficDashboard key={`${clientId}-${bundle.report?.period_start ?? 'x'}-${bundle.report?.updated_at ?? 'x'}`} report={bundle.report} previous={bundle.previous} history={bundle.history} />
          </div>
        </div>
      )}

      {(editing || creating) && client && (
        <ReportModal
          clientId={client.id}
          initial={editing ? bundle.report : null}
          defaults={newDefaults}
          onClose={() => { setEditing(false); setCreating(false) }}
          onSaved={(start: string) => {
            setEditing(false)
            setCreating(false)
            if (start === selectedStart) loadReport(client.id, start)
            else setSelectedStart(start)
          }}
        />
      )}
    </div>
  )
}

// ── Modal de lançamento dos números do mês ───────────────────────────────────
type CampaignForm = {
  id: string; name: string; spend: string; impressions: string; reach: string; link_clicks: string; results: string
  start_date: string; end_date: string; note: string
}

const toStr = (n: number) => (n ? String(n).replace('.', ',') : '')
const toForm = (c: TrafficCampaign): CampaignForm => ({
  id: c.id ?? '', name: c.name, spend: toStr(c.spend), impressions: toStr(c.impressions), reach: toStr(c.reach),
  link_clicks: toStr(c.link_clicks), results: toStr(c.results),
  start_date: c.start_date ?? '', end_date: c.end_date ?? '', note: c.note ?? '',
})

const inputCls = 'w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors placeholder:text-muted-foreground/50'

function ReportModal({ clientId, initial, defaults, onClose, onSaved }: {
  clientId: string
  initial: TrafficReport | null
  defaults: { start: string; end: string }
  onClose: () => void
  onSaved: (periodStart: string) => void
}) {
  const [periodStart, setPeriodStart] = useState(initial?.period_start ?? defaults.start)
  const [periodEnd, setPeriodEnd] = useState(initial?.period_end ?? defaults.end)
  const [totals, setTotals] = useState({
    spend: toStr(initial?.spend ?? 0),
    impressions: toStr(initial?.impressions ?? 0),
    reach: toStr(initial?.reach ?? 0),
    link_clicks: toStr(initial?.link_clicks ?? 0),
    results: toStr(initial?.results ?? 0),
  })
  const [resultLabel, setResultLabel] = useState(initial?.result_label ?? 'Resultados')
  const [campaigns, setCampaigns] = useState<CampaignForm[]>((initial?.campaigns ?? []).map(toForm))
  const [analysis, setAnalysis] = useState(initial?.analysis ?? '')
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [importNote, setImportNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function importPaste() {
    const parsed = parseAdsExport(pasteText)
    if (!parsed) {
      setImportNote('Não consegui ler esse conteúdo. Cole a tabela inteira (com a linha de cabeçalho) exportada do Gerenciador de Anúncios.')
      return
    }
    setCampaigns(parsed.campaigns.map(toForm))
    setTotals({
      spend: toStr(parsed.totals.spend),
      impressions: toStr(parsed.totals.impressions),
      reach: toStr(parsed.totals.reach),
      link_clicks: toStr(parsed.totals.link_clicks),
      results: toStr(parsed.totals.results),
    })
    setImportNote(
      `${parsed.campaigns.length} campanha${parsed.campaigns.length !== 1 ? 's' : ''} importada${parsed.campaigns.length !== 1 ? 's' : ''}.` +
      (parsed.hasTotalRow ? '' : ' O alcance foi somado entre campanhas e pode estar maior que o real — se tiver o alcance total da conta, ajuste abaixo.')
    )
    setPasteOpen(false)
    setPasteText('')
  }

  function setCampaign(i: number, patch: Partial<CampaignForm>) {
    setCampaigns(cs => cs.map((c, j) => j === i ? { ...c, ...patch } : c))
  }

  async function save() {
    setError('')
    if (!periodStart || !periodEnd) { setError('Informe o início e o fim do período'); return }
    if (periodEnd < periodStart) { setError('O fim do período não pode ser antes do início'); return }
    setSaving(true)
    const res = await fetch(`/api/clients/${clientId}/traffic`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_start: periodStart,
        period_end: periodEnd,
        original_start: initial?.period_start ?? null,
        spend: parseNum(totals.spend),
        impressions: parseNum(totals.impressions),
        reach: parseNum(totals.reach),
        link_clicks: parseNum(totals.link_clicks),
        results: parseNum(totals.results),
        result_label: resultLabel,
        analysis,
        campaigns: campaigns.map(c => ({
          id: c.id, start_date: c.start_date, end_date: c.end_date, note: c.note,
          name: c.name, spend: parseNum(c.spend), impressions: parseNum(c.impressions),
          reach: parseNum(c.reach), link_clicks: parseNum(c.link_clicks), results: parseNum(c.results),
        })),
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Erro ao salvar')
      setSaving(false)
      return
    }
    onSaved(periodStart)
  }

  async function remove() {
    if (!initial) return
    if (!confirm(`Apagar os números do período ${periodLabel(initial.period_start, initial.period_end)}? O cliente deixa de ver esse período.`)) return
    setSaving(true)
    await fetch(`/api/clients/${clientId}/traffic?start=${initial.period_start}`, { method: 'DELETE' })
    onSaved('')
  }

  const totalFields: Array<{ key: keyof typeof totals; label: string; placeholder: string }> = [
    { key: 'spend', label: 'Valor investido (R$)', placeholder: '0,00' },
    { key: 'impressions', label: 'Impressões', placeholder: '0' },
    { key: 'reach', label: 'Alcance (pessoas)', placeholder: '0' },
    { key: 'link_clicks', label: 'Cliques no link', placeholder: '0' },
    { key: 'results', label: 'Resultados', placeholder: '0' },
  ]

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{initial ? 'Editar período' : 'Novo período'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1.5">Início do período</label>
            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1.5">Fim do período</label>
            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <button
            onClick={() => setPasteOpen(o => !o)}
            className="flex items-center gap-2 text-xs text-[#efefef] hover:underline"
          >
            <ClipboardPaste size={13} /> Colar do Gerenciador de Anúncios (CSV ou tabela)
          </button>
          {pasteOpen && (
            <div className="mt-2 space-y-2">
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                rows={5}
                placeholder="Exporte o relatório de campanhas (colunas: Nome da campanha, Valor usado, Impressões, Alcance, Cliques no link, Resultados) e cole aqui."
                className={`${inputCls} resize-none font-mono text-xs`}
              />
              <button onClick={importPaste} className="bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111] text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                Importar
              </button>
            </div>
          )}
          {importNote && <p className="mt-2 text-xs text-muted-foreground flex items-start gap-1.5"><AlertCircle size={12} className="mt-0.5 shrink-0" />{importNote}</p>}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {totalFields.map(f => (
            <div key={f.key}>
              <label className="block text-[10px] text-muted-foreground mb-1.5">{f.label}</label>
              <input
                value={totals[f.key]}
                onChange={e => setTotals(t => ({ ...t, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                inputMode="decimal"
                className={inputCls}
              />
            </div>
          ))}
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1.5">O que são os &quot;resultados&quot;?</label>
            <input value={resultLabel} onChange={e => setResultLabel(e.target.value)} placeholder="Ex: Conversas iniciadas" className={inputCls} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] text-muted-foreground">Campanhas (opcional)</label>
            <button
              onClick={() => setCampaigns(cs => [...cs, { id: '', name: '', spend: '', impressions: '', reach: '', link_clicks: '', results: '', start_date: '', end_date: '', note: '' }])}
              className="flex items-center gap-1 text-xs text-[#efefef]"
            >
              <Plus size={12} /> Adicionar
            </button>
          </div>
          {campaigns.length === 0 && <p className="text-xs text-muted-foreground/60">Sem detalhamento por campanha — o cliente vê só os totais do mês.</p>}
          <div className="space-y-2">
            {campaigns.map((c, i) => (
              <div key={i} className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input value={c.name} onChange={e => setCampaign(i, { name: e.target.value })} placeholder="Nome da campanha" className={`${inputCls} flex-1`} />
                  <button onClick={() => setCampaigns(cs => cs.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-[#ef4444] transition-colors p-1">
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {([
                    ['spend', 'Valor R$'], ['impressions', 'Impressões'], ['reach', 'Alcance'], ['link_clicks', 'Cliques'], ['results', 'Resultados'],
                  ] as const).map(([k, label]) => (
                    <div key={k}>
                      <label className="block text-[9px] text-muted-foreground mb-1">{label}</label>
                      <input value={c[k]} onChange={e => setCampaign(i, { [k]: e.target.value })} inputMode="decimal" className={`${inputCls} px-2 py-1.5 text-xs`} />
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] text-muted-foreground mb-1">Começou a rodar em</label>
                    <input type="date" value={c.start_date} onChange={e => setCampaign(i, { start_date: e.target.value })} className={`${inputCls} px-2 py-1.5 text-xs`} />
                  </div>
                  <div>
                    <label className="block text-[9px] text-muted-foreground mb-1">Encerrou em (vazio = no ar)</label>
                    <input type="date" value={c.end_date} onChange={e => setCampaign(i, { end_date: e.target.value })} className={`${inputCls} px-2 py-1.5 text-xs`} />
                  </div>
                </div>
                <input
                  value={c.note}
                  onChange={e => setCampaign(i, { note: e.target.value })}
                  placeholder="Observação pro cliente (ex: foco ajustado, substituída pela nova versão em 28/09)"
                  className={`${inputCls} px-2 py-1.5 text-xs`}
                />
              </div>
            ))}
          </div>
          {campaigns.length > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Soma das campanhas: {fmtInt(campaigns.reduce((s, c) => s + parseNum(c.link_clicks), 0))} cliques · {fmtInt(campaigns.reduce((s, c) => s + parseNum(c.impressions), 0))} impressões
            </p>
          )}
        </div>

        <div>
          <label className="block text-[10px] text-muted-foreground mb-1.5">Análise do mês (aparece pro cliente)</label>
          <textarea
            value={analysis}
            onChange={e => setAnalysis(e.target.value)}
            rows={4}
            placeholder="Conte em poucas linhas o que os números significam, o que funcionou e os próximos passos..."
            className={`${inputCls} resize-none`}
          />
        </div>

        {error && <p className="text-xs text-[#ef4444]">{error}</p>}

        <div className="flex gap-3">
          {initial && (
            <button onClick={remove} disabled={saving} className="border border-[#ef4444]/30 text-[#ef4444]/80 hover:bg-[#ef4444]/10 text-sm px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50">
              Apagar mês
            </button>
          )}
          <button onClick={onClose} className="flex-1 border border-[#2a2a2a] text-sm py-2.5 rounded-lg hover:bg-[#222222] transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111] text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
