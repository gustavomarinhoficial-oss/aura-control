// Criativos de Tráfego — nomes, rótulos e regras simples usados no Hub, no link público e no conector.
// Este arquivo roda no navegador também: não importe nada de servidor aqui.

export const OBJECTIVES = {
  mensagens: 'Mensagens no WhatsApp',
  alcance: 'Alcance',
  engajamento: 'Engajamento',
  trafego: 'Tráfego',
} as const
export type Objective = keyof typeof OBJECTIVES

export const CAMPAIGN_STATUS = {
  rascunho: { label: 'Rascunho', color: '#6b7280' },
  aguardando_aprovacao: { label: 'Aguardando aprovação', color: '#f59e0b' },
  aprovada: { label: 'Aprovada', color: '#22c55e' },
  no_ar: { label: 'No ar', color: '#38bdf8' },
  pausada: { label: 'Pausada', color: '#a78bfa' },
  encerrada: { label: 'Encerrada', color: '#4b5563' },
} as const
export type CampaignStatus = keyof typeof CAMPAIGN_STATUS

export const APPROVAL_STATUS = {
  aguardando: { label: 'Aguardando', color: '#f59e0b' },
  aprovado: { label: 'Aprovado', color: '#22c55e' },
  ajuste: { label: 'Ajuste pedido', color: '#fb923c' },
  reprovado: { label: 'Reprovado', color: '#ef4444' },
} as const
export type ApprovalStatus = keyof typeof APPROVAL_STATUS

export const PLACEMENTS = {
  feed: 'Feed',
  stories_reels: 'Stories/Reels',
  ambos: 'Feed + Stories/Reels',
} as const
export type Placement = keyof typeof PLACEMENTS

// Botões do Meta Ads (mesmos textos que aparecem no anúncio)
export const CTAS = {
  enviar_mensagem: 'Enviar mensagem',
  saiba_mais: 'Saiba mais',
  reservar: 'Reservar',
  ligar_agora: 'Ligar agora',
  ver_cardapio: 'Ver cardápio',
  pedir_agora: 'Pedir agora',
} as const
export type Cta = keyof typeof CTAS

export const DESTINATIONS = {
  whatsapp: 'WhatsApp',
  link: 'Link',
  instagram: 'Perfil do Instagram',
} as const
export type DestinationType = keyof typeof DESTINATIONS

export const BUDGET_TYPES = { total: 'Verba total', diaria: 'Verba diária' } as const
export type BudgetType = keyof typeof BUDGET_TYPES

// O cliente não vê campanhas em rascunho; aprova só enquanto a campanha não foi encerrada
export const HIDDEN_FROM_CLIENT: CampaignStatus[] = ['rascunho']
export const CLIENT_CAN_REVIEW: CampaignStatus[] = ['aguardando_aprovacao', 'aprovada', 'no_ar', 'pausada']

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// Padrão da OWL: "[OWL] Nome da Campanha (Mês/AA)". Se o nome já começa com [OWL], fica como está.
export function campaignName(base: string, startDate?: string | null): string {
  const name = base.trim()
  if (!name || /^\[owl\]/i.test(name)) return name
  const d = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? new Date(startDate + 'T12:00:00') : new Date()
  return `[OWL] ${name} (${MONTHS[d.getMonth()]}/${String(d.getFullYear()).slice(2)})`
}

export const isVideoUrl = (u: string) => /\.(mp4|mov|m4v|webm)$/i.test(u.split('?')[0])

// Link clicável do destino (WhatsApp, site ou Instagram)
export function destinationHref(type: string | null, value: string | null): string | null {
  if (!type || !value) return null
  if (type === 'whatsapp') return `https://wa.me/${value.replace(/\D/g, '')}`
  if (type === 'instagram') return `https://instagram.com/${value.replace(/^@/, '')}`
  return value
}

export function destinationLabel(type: string | null, value: string | null): string {
  if (!type || !value) return ''
  if (type === 'whatsapp') {
    const d = value.replace(/\D/g, '')
    const local = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d
    return local.length === 11 ? `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}` : local.length === 10 ? `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}` : value
  }
  if (type === 'instagram') return '@' + value.replace(/^@/, '')
  return value.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

export const formatBudget = (type: string, amount: number | null) =>
  amount == null ? '—' : `${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${type === 'diaria' ? '/dia' : ' no total'}`

export const formatPeriod = (start: string | null, end: string | null) => {
  const f = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  if (start && end) return `${f(start)} a ${f(end)}`
  if (start) return `a partir de ${f(start)}`
  if (end) return `até ${f(end)}`
  return '—'
}

export interface AdCampaign {
  id: string
  client_id: string
  name: string
  objective: Objective
  budget_type: BudgetType
  budget_amount: number | null
  start_date: string | null
  end_date: string | null
  schedule: string | null
  audience: string | null
  status: CampaignStatus
  notes?: string | null
  source?: string | null
  created_at: string
  updated_at: string
}

export interface AdCreative {
  id: string
  campaign_id: string
  client_id: string
  name: string
  media_urls: string[]
  cover_url: string | null
  placement: Placement
  primary_text: string | null
  headline: string | null
  cta: Cta
  destination_type: DestinationType | null
  destination: string | null
  approval_status: ApprovalStatus
  client_comment: string | null
  approved_at: string | null
  reviewed_at: string | null
  position: number
  source?: string | null
  created_at: string
  updated_at: string
}

export interface CreativeCounts { total: number; aprovado: number; aguardando: number; ajuste: number; reprovado: number }

export function countCreatives(list: Pick<AdCreative, 'approval_status'>[]): CreativeCounts {
  const c: CreativeCounts = { total: list.length, aprovado: 0, aguardando: 0, ajuste: 0, reprovado: 0 }
  for (const x of list) c[x.approval_status]++
  return c
}
