'use client'

import { useState } from 'react'
import { Check, Edit2, Loader2, Megaphone, Wallet, CalendarDays, Clock, Users, Target } from 'lucide-react'
import { AdPreview } from './AdPreview'
import {
  OBJECTIVES, CAMPAIGN_STATUS, APPROVAL_STATUS, CLIENT_CAN_REVIEW, countCreatives, formatPeriod,
  type AdCampaign, type AdCreative,
} from '@/lib/ads/constants'

export type PublicCreative = Omit<AdCreative, 'client_id' | 'reviewed_at' | 'source' | 'updated_at'>
export type PublicCampaign = Omit<AdCampaign, 'client_id' | 'notes' | 'source' | 'updated_at'> & { creatives: PublicCreative[] }

// Aba "Anúncios" do link público: campanhas do cliente e cada criativo com a prévia,
// para aprovar ou pedir ajuste com comentário.
export function PublicAds({ token, clientName, logoUrl, campaigns, canReview, onUpdated }: {
  token: string
  clientName: string
  logoUrl?: string | null
  campaigns: PublicCampaign[]
  canReview: boolean
  onUpdated: (creative: PublicCreative) => void
}) {
  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Megaphone size={26} className="text-[#3a3a3a] mb-3" strokeWidth={1} />
        <p className="text-sm text-[#7a7a7a]">Nenhum anúncio para aprovar por enquanto.</p>
      </div>
    )
  }
  return (
    <div className="space-y-10">
      {campaigns.length > 1 && (
        <p className="text-xs text-[#7a7a7a] px-1">
          {campaigns.length} campanhas · cada bloco abaixo é um conjunto de anúncios separado, com verba e público próprios.
        </p>
      )}
      {campaigns.map((c, i) => (
        <CampaignBlock key={c.id} campaign={c} index={i} total={campaigns.length} token={token} clientName={clientName} logoUrl={logoUrl} canReview={canReview} onUpdated={onUpdated} />
      ))}
    </div>
  )
}

function CampaignBlock({ campaign, index, total, token, clientName, logoUrl, canReview, onUpdated }: {
  campaign: PublicCampaign; index: number; total: number; token: string; clientName: string; logoUrl?: string | null; canReview: boolean; onUpdated: (c: PublicCreative) => void
}) {
  const st = CAMPAIGN_STATUS[campaign.status]
  const counts = countCreatives(campaign.creatives)
  const open = CLIENT_CAN_REVIEW.includes(campaign.status)
  const daily = campaign.budget_type === 'diaria'
  // Cada campanha é uma "caixa" própria (conjunto de anúncios): cabeçalho com a verba em destaque
  // e, dentro dela, os criativos. Assim fica claro onde termina uma campanha e começa a outra.
  return (
    <section className="rounded-2xl border border-[#2e2e2e] bg-[#0b0b0b] overflow-hidden" style={{ borderTopColor: st.color, borderTopWidth: 3 }}>
      <div className="bg-[#141414] border-b border-[#262626] p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8a8a8a]">
            <Megaphone size={12} /> Campanha {total > 1 ? `${index + 1} de ${total}` : ''}
          </p>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: st.color + '22', color: st.color }}>{st.label}</span>
        </div>
        <h2 className="text-base font-semibold leading-snug -mt-1">{campaign.name}</h2>

        <div className="rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/30 px-4 py-3 flex items-center gap-3">
          <Wallet size={20} className="text-[#4ade80] shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#86efac]">{daily ? 'Verba diária' : 'Verba total da campanha'}</p>
            <p className="text-2xl font-bold text-white leading-tight">
              {campaign.budget_amount == null ? '—' : campaign.budget_amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              {daily && campaign.budget_amount != null && <span className="text-sm font-medium text-[#a8a8a8]"> /dia</span>}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs text-[#a8a8a8]">
          <Info icon={Target} label="Objetivo" value={OBJECTIVES[campaign.objective]} />
          <Info icon={CalendarDays} label="Período" value={formatPeriod(campaign.start_date, campaign.end_date)} />
          {campaign.schedule && <Info icon={Clock} label="Dias e horários" value={campaign.schedule} />}
          {campaign.audience && <Info icon={Users} label="Público" value={campaign.audience} wide />}
        </div>
        {counts.total > 0 && (
          <p className="text-[11px] text-[#7a7a7a]">
            {counts.aprovado}/{counts.total} criativo{counts.total !== 1 ? 's' : ''} aprovado{counts.aprovado !== 1 ? 's' : ''}
            {counts.aguardando > 0 && ` · ${counts.aguardando} aguardando você`}
          </p>
        )}
      </div>

      <div className="p-4 space-y-4">
        {campaign.creatives.length === 0 ? (
          <p className="text-xs text-[#7a7a7a]">Os criativos desta campanha ainda estão sendo preparados.</p>
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b6b6b]">
              Anúncios desta campanha ({campaign.creatives.length})
            </p>
            <div className="space-y-6">
              {campaign.creatives.map(cr => (
                <CreativeReview key={cr.id} creative={cr} token={token} clientName={clientName} logoUrl={logoUrl} canReview={canReview && open} onUpdated={onUpdated} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function Info({ icon: Icon, label, value, wide }: { icon: typeof Target; label: string; value: string; wide?: boolean }) {
  return (
    <div className={`flex items-start gap-2 ${wide ? 'sm:col-span-2' : ''}`}>
      <Icon size={13} className="mt-0.5 shrink-0 text-[#6b6b6b]" />
      <p className="min-w-0"><span className="text-[#6b6b6b]">{label}: </span><span className="text-[#e5e5e5] whitespace-pre-wrap">{value}</span></p>
    </div>
  )
}

function CreativeReview({ creative, token, clientName, logoUrl, canReview, onUpdated }: {
  creative: PublicCreative; token: string; clientName: string; logoUrl?: string | null; canReview: boolean; onUpdated: (c: PublicCreative) => void
}) {
  const [asking, setAsking] = useState(false)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const st = APPROVAL_STATUS[creative.approval_status]

  async function send(action: 'aprovar' | 'ajuste') {
    setSaving(true); setError('')
    const res = await fetch(`/api/public/ads/${creative.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, action, comment: action === 'ajuste' ? comment : undefined }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    setSaving(false)
    if (!res?.ok) { setError(data.error ?? 'Não foi possível enviar. Tente de novo.'); return }
    onUpdated(data)
    setAsking(false); setComment('')
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-sm font-medium truncate">{creative.name}</p>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: st.color + '22', color: st.color }}>{st.label}</span>
      </div>
      <div className="max-w-[400px] mx-auto w-full">
        <AdPreview creative={creative} clientName={clientName} logoUrl={logoUrl} />
      </div>
      {creative.client_comment && (
        <div className="text-xs bg-[#fb923c]/10 border border-[#fb923c]/25 text-[#fdba74] rounded-lg px-3 py-2 whitespace-pre-wrap">
          <span className="font-semibold">Seu comentário:</span> {creative.client_comment}
        </div>
      )}
      {canReview && !asking && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => send('aprovar')} disabled={saving || creative.approval_status === 'aprovado'}
            className="flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-xl bg-[#22c55e] text-black disabled:opacity-40">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {creative.approval_status === 'aprovado' ? 'Aprovado' : 'Aprovar'}
          </button>
          <button onClick={() => setAsking(true)} disabled={saving}
            className="flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-xl bg-[#161616] border border-[#262626] text-white disabled:opacity-40">
            <Edit2 size={14} /> Pedir ajuste
          </button>
        </div>
      )}
      {canReview && asking && (
        <div className="bg-[#161616] border border-[#262626] rounded-xl p-3 space-y-2">
          <textarea autoFocus value={comment} onChange={e => setComment(e.target.value)} rows={3}
            placeholder="O que precisa mudar? Ex.: trocar a música, mudar o texto, outro horário…"
            className="w-full bg-[#0d0d0d] border border-[#262626] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef]" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setAsking(false); setError('') }} className="text-xs px-3 py-2 text-[#9ca3af]">Cancelar</button>
            <button onClick={() => send('ajuste')} disabled={saving || !comment.trim()}
              className="text-xs font-semibold px-3 py-2 rounded-lg bg-[#efefef] text-black disabled:opacity-40 flex items-center gap-1.5">
              {saving && <Loader2 size={12} className="animate-spin" />}Enviar pedido de ajuste
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-[#ef4444] px-1">{error}</p>}
    </div>
  )
}
