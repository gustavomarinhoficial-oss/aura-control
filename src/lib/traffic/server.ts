import type { SupabaseClient } from '@supabase/supabase-js'
import { prevMonthStr, type TrafficBundle, type TrafficReport } from './metrics'

// Carrega o relatorio do mes pedido + o mes anterior (pra comparar) + ate 6
// meses de historico (pro grafico de evolucao) + a lista de meses com dados.
export async function loadTrafficBundle(supabase: SupabaseClient, clientId: string, month: string): Promise<TrafficBundle> {
  const { data } = await supabase
    .from('traffic_reports')
    .select('*')
    .eq('client_id', clientId)
    .order('month', { ascending: true })

  const reports = (data ?? []) as TrafficReport[]
  const prevMonth = prevMonthStr(month)
  return {
    report: reports.find(r => r.month === month) ?? null,
    previous: reports.find(r => r.month === prevMonth) ?? null,
    history: reports.filter(r => r.month <= month).slice(-6),
    months: reports.map(r => r.month).sort().reverse(),
  }
}
