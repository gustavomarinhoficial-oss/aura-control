import { createServiceClient } from '@/lib/supabase/server'
import { contractInfo, effectiveContractEnd, needsAttention, todayBR, type ContractLevel } from '@/lib/contracts'

export interface ContractAlert {
  id: string
  name: string
  end: string
  daysLeft: number
  level: ContractLevel
}

// Clientes ativos cujo contrato acabou ou está perto de acabar (mais urgentes primeiro)
export async function loadContractAlerts(): Promise<ContractAlert[]> {
  const db = createServiceClient()
  let res = await db.from('clients').select('id, name, contract_end, services(active, contract_end)').eq('status', 'ativo')
  // antes da migration do campo, usa só o fim dos serviços
  if (res.error) res = await db.from('clients').select('id, name, services(active, contract_end)').eq('status', 'ativo') as typeof res
  const today = todayBR()
  const out: ContractAlert[] = []
  for (const c of (res.data ?? []) as unknown as { id: string; name: string; contract_end?: string | null; services?: { active: boolean; contract_end?: string | null }[] }[]) {
    const info = contractInfo(effectiveContractEnd(c, c.services), today)
    if (info.end && info.daysLeft !== null && needsAttention(info)) out.push({ id: c.id, name: c.name, end: info.end, daysLeft: info.daysLeft, level: info.level })
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft)
}

// No WhatsApp/e-mail da manhã: lembra nos marcos (60, 30, 15, 7, 3, 1 dias e no dia) e, depois de vencido, toda semana
export function shouldRemindToday(daysLeft: number): boolean {
  return [60, 30, 15, 7, 3, 1, 0].includes(daysLeft) || (daysLeft < 0 && daysLeft % 7 === 0)
}
