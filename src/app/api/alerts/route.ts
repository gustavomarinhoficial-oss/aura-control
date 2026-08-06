import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServiceClient()
  const today = new Date().toISOString().split('T')[0]
  const in7 = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  const [overdueRes, upcomingRes, renewalRes] = await Promise.all([
    // Cobranças atrasadas — exclui cobranças de serviços inativos (encerrados)
    supabase
      .from('charges')
      .select('id, description, amount, due_date, service_id, clients(name), services(active)')
      .is('paid_at', null)
      .lt('due_date', today)
      .order('due_date'),

    // Cobranças vencendo em 7 dias — exclui serviços inativos
    supabase
      .from('charges')
      .select('id, description, amount, due_date, service_id, clients(name), services(active)')
      .is('paid_at', null)
      .gte('due_date', today)
      .lte('due_date', in7)
      .order('due_date'),

    // Contratos encerrando em 30 dias (só se migration 003 rodou)
    supabase
      .from('services')
      .select('id, name, contract_end, clients(name)')
      .eq('active', true)
      .gte('contract_end', today)
      .lte('contract_end', in30)
      .order('contract_end'),
  ])

  // Se contract_end não existir ainda, ignora renovals

  // Filtra: só mostra como alerta se não tem serviço vinculado OU se o serviço ainda está ativo
  const filterActive = (list: typeof overdueRes.data) =>
    (list ?? []).filter((c: { service_id: string | null; services?: { active: boolean } | null }) =>
      !c.service_id || c.services?.active !== false
    )

  return NextResponse.json({
    overdue: filterActive(overdueRes.data),
    upcoming: filterActive(upcomingRes.data),
    renewals: renewalRes.error ? [] : (renewalRes.data ?? []),
  })
}
