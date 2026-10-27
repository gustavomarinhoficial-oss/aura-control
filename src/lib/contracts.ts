// Fim de contrato do cliente: a data informada no cadastro do cliente; se estiver vazia,
// usa o fim mais distante entre os serviços ativos. Sem nenhuma data = contrato sem fim.

export type ContractLevel = 'none' | 'ok' | 'soon' | 'last_month' | 'ended'

export interface ContractInfo {
  end: string | null
  daysLeft: number | null
  level: ContractLevel
}

export const LAST_MONTH_DAYS = 30 // "último mês": faltam 30 dias ou menos
export const SOON_DAYS = 60       // "renovar em breve": começar a conversa de renovação

export function todayBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export function effectiveContractEnd(
  client: { contract_end?: string | null },
  services?: { active: boolean; contract_end?: string | null }[] | null,
): string | null {
  if (client.contract_end) return client.contract_end
  const ends = (services ?? []).filter(s => s.active && s.contract_end).map(s => s.contract_end as string)
  return ends.length ? ends.sort().at(-1)! : null
}

export function contractInfo(end: string | null, today: string = todayBR()): ContractInfo {
  if (!end) return { end: null, daysLeft: null, level: 'none' }
  const daysLeft = Math.round((new Date(end + 'T12:00:00Z').getTime() - new Date(today + 'T12:00:00Z').getTime()) / 86400000)
  const level: ContractLevel = daysLeft < 0 ? 'ended' : daysLeft <= LAST_MONTH_DAYS ? 'last_month' : daysLeft <= SOON_DAYS ? 'soon' : 'ok'
  return { end, daysLeft, level }
}

// Precisa de atenção (aparece no aviso do topo)
export const needsAttention = (i: ContractInfo) => i.level === 'ended' || i.level === 'last_month' || i.level === 'soon'

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

export function contractLabel(i: ContractInfo): string {
  if (!i.end || i.daysLeft === null) return 'Sem fim definido'
  if (i.level === 'ended') return `Contrato venceu há ${Math.abs(i.daysLeft)} dia${Math.abs(i.daysLeft) === 1 ? '' : 's'}`
  if (i.daysLeft === 0) return 'Último dia do contrato: hoje'
  if (i.level === 'last_month') return `Último mês · acaba ${fmt(i.end)} (${i.daysLeft} dia${i.daysLeft === 1 ? '' : 's'})`
  if (i.level === 'soon') return `Renovar em breve · acaba ${fmt(i.end)}`
  return `Contrato até ${fmt(i.end)}/${i.end.slice(0, 4)}`
}

export const CONTRACT_COLOR: Record<ContractLevel, string> = {
  ended: '#ef4444',
  last_month: '#ef4444',
  soon: '#f59e0b',
  ok: '#a3a3a3',
  none: '#a3a3a3',
}
