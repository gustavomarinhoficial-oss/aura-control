'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Pencil, Plus, Trash2, Link2, Check, AlertTriangle, MessageSquare } from 'lucide-react'
import { AdPreview } from '@/components/domain/ads/AdPreview'
import { CampaignForm } from '@/components/domain/ads/CampaignForm'
import { CreativeForm } from '@/components/domain/ads/CreativeForm'
import {
  OBJECTIVES, CAMPAIGN_STATUS, APPROVAL_STATUS, BUDGET_TYPES, countCreatives, formatBudget, formatPeriod,
  type AdCampaign, type AdCreative, type CampaignStatus,
} from '@/lib/ads/constants'

interface ClientInfo { id: string; name: string; logo_url?: string | null; share_slug: string | null; share_token: string | null; content_approval_enabled: boolean | null }

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [campaign, setCampaign] = useState<AdCampaign | null>(null)
  const [creatives, setCreatives] = useState<AdCreative[]>([])
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingCampaign, setEditingCampaign] = useState(false)
  const [creativeModal, setCreativeModal] = useState<{ initial?: AdCreative } | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/ads/campaigns/${id}`).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    if (!res?.ok) { setError(data?.error ?? 'Erro ao carregar'); setLoading(false); return }
    setCampaign(data.campaign); setCreatives(data.creatives); setClient(data.client); setError(''); setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
  if (error || !campaign) {
    return (
      <div className="space-y-4">
        <Link href="/criativos" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><ArrowLeft size={13} /> Criativos de Tráfego</Link>
        <p className="text-sm text-[#fca5a5]">{error || 'Campanha não encontrada'}</p>
      </div>
    )
  }

  const st = CAMPAIGN_STATUS[campaign.status]
  const k = countCreatives(creatives)
  const publicUrl = client?.share_slug ? `${window.location.origin}/${client.share_slug}` : client?.share_token ? `${window.location.origin}/publico/${client.share_token}` : null

  async function changeStatus(status: CampaignStatus) {
    setBusy(true)
    const res = await fetch(`/api/ads/campaigns/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (res.ok) setCampaign(await res.json())
    setBusy(false)
  }

  async function removeCampaign() {
    if (!confirm(`Apagar a campanha "${campaign!.name}" e os ${creatives.length} criativo(s) dela? Não dá para desfazer.`)) return
    setBusy(true)
    const res = await fetch(`/api/ads/campaigns/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/criativos')
    else setBusy(false)
  }

  async function removeCreative(c: AdCreative) {
    if (!confirm(`Apagar o criativo "${c.name}"?`)) return
    const res = await fetch(`/api/ads/creatives/${c.id}`, { method: 'DELETE' })
    if (res.ok) setCreatives(list => list.filter(x => x.id !== c.id))
  }

  function copyLink() {
    if (!publicUrl) return
    navigator.clipboard.writeText(publicUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div className="space-y-6">
      <Link href="/criativos" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit"><ArrowLeft size={13} /> Criativos de Tráfego</Link>

      {/* cabeçalho da campanha */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{client?.name}</p>
            <h1 className="text-lg font-semibold tracking-tight">{campaign.name}</h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={campaign.status} disabled={busy} onChange={e => changeStatus(e.target.value as CampaignStatus)}
              className="text-xs font-medium rounded-lg px-2.5 py-1.5 border focus:outline-none" style={{ background: st.color + '1a', color: st.color, borderColor: st.color + '55' }}>
              {Object.entries(CAMPAIGN_STATUS).map(([key, v]) => <option key={key} value={key} style={{ background: '#1a1a1a', color: '#efefef' }}>{v.label}</option>)}
            </select>
            <button onClick={() => setEditingCampaign(true)} className="text-xs px-2.5 py-1.5 rounded-lg border border-[#2a2a2a] hover:border-[#efefef] flex items-center gap-1.5"><Pencil size={12} /> Editar</button>
            <button onClick={removeCampaign} disabled={busy} className="text-xs px-2.5 py-1.5 rounded-lg border border-[#2a2a2a] text-muted-foreground hover:text-[#ef4444] hover:border-[#ef4444]/40"><Trash2 size={12} /></button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Info label="Objetivo" value={OBJECTIVES[campaign.objective]} />
          <Info label={BUDGET_TYPES[campaign.budget_type]} value={formatBudget(campaign.budget_type, campaign.budget_amount)} />
          <Info label="Período" value={formatPeriod(campaign.start_date, campaign.end_date)} />
          <Info label="Criativos" value={k.total === 0 ? 'nenhum' : `${k.aprovado}/${k.total} aprovados${k.aguardando ? ` · ${k.aguardando} pendente(s)` : ''}${k.ajuste ? ` · ${k.ajuste} ajuste(s)` : ''}`} />
          {campaign.schedule && <Info label="Dias e horários" value={campaign.schedule} wide />}
          {campaign.audience && <Info label="Público" value={campaign.audience} wide />}
          {campaign.notes && <Info label="Observação interna" value={campaign.notes} wide />}
        </div>

        {/* onde o cliente vê */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {campaign.status === 'rascunho' ? (
            <span className="flex items-center gap-1.5 text-[#f59e0b]"><AlertTriangle size={12} /> Em rascunho: o cliente ainda não vê esta campanha.</span>
          ) : !publicUrl ? (
            <span className="flex items-center gap-1.5 text-[#f59e0b]"><AlertTriangle size={12} /> O cliente ainda não tem link público (gere na página do cliente).</span>
          ) : (
            <>
              <span className="text-muted-foreground">O cliente vê na aba <span className="text-foreground">Anúncios</span> do link dele.</span>
              <button onClick={copyLink} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#2a2a2a] hover:border-[#efefef]">
                {copied ? <Check size={12} className="text-[#22c55e]" /> : <Link2 size={12} />}{copied ? 'Link copiado' : 'Copiar link do cliente'}
              </button>
            </>
          )}
          {client && !client.content_approval_enabled && campaign.status !== 'rascunho' && (
            <span className="flex items-center gap-1.5 text-[#f59e0b]"><AlertTriangle size={12} /> A aprovação pelo link está desligada para este cliente: ele vê, mas não aprova.</span>
          )}
        </div>
      </div>

      {/* criativos */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Criativos</h2>
        <button onClick={() => setCreativeModal({})} className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg bg-[#efefef] text-[#111]"><Plus size={14} /> Novo criativo</button>
      </div>

      {creatives.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl h-40 flex items-center justify-center text-sm text-muted-foreground">Nenhum criativo nesta campanha ainda.</div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {creatives.map(c => {
            const a = APPROVAL_STATUS[c.approval_status]
            return (
              <div key={c.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: a.color + '22', color: a.color }}>{a.label}</span>
                    <button onClick={() => setCreativeModal({ initial: c })} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[#2a2a2a]" title="Editar"><Pencil size={12} /></button>
                    <button onClick={() => removeCreative(c)} className="p-1.5 rounded-lg text-muted-foreground hover:text-[#ef4444] hover:bg-[#ef4444]/5" title="Apagar"><Trash2 size={12} /></button>
                  </div>
                </div>
                <AdPreview creative={c} clientName={client?.name ?? ''} logoUrl={client?.logo_url} />
                {c.client_comment && (
                  <div className="text-xs bg-[#fb923c]/10 border border-[#fb923c]/25 text-[#fdba74] rounded-lg px-3 py-2 whitespace-pre-wrap flex gap-2">
                    <MessageSquare size={12} className="shrink-0 mt-0.5" />
                    <span><span className="font-semibold">Cliente{c.reviewed_at ? ` (${fmtDateTime(c.reviewed_at)})` : ''}:</span> {c.client_comment}</span>
                  </div>
                )}
                {c.approved_at && c.approval_status === 'aprovado' && (
                  <p className="text-[11px] text-[#22c55e]">Aprovado em {fmtDateTime(c.approved_at)}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editingCampaign && (
        <CampaignForm clients={client ? [client] : []} initial={campaign} onClose={() => setEditingCampaign(false)} onSaved={c => { setCampaign(c); setEditingCampaign(false) }} />
      )}
      {creativeModal && (
        <CreativeForm
          campaignId={campaign.id}
          clientName={client?.name ?? ''}
          logoUrl={client?.logo_url}
          initial={creativeModal.initial}
          onClose={() => setCreativeModal(null)}
          onSaved={() => { setCreativeModal(null); load() }}
        />
      )}
    </div>
  )
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm whitespace-pre-wrap">{value}</p>
    </div>
  )
}
