import type { SupabaseClient } from '@supabase/supabase-js'
import { todayStr, type TrafficBundle, type TrafficReport } from './metrics'

// Carrega o período pedido (ou, sem pedido, o que está rodando hoje; se não
// houver, o mais recente já iniciado) + o período anterior (pra comparar) +
// até 6 períodos de histórico (gráfico de evolução) + a lista de períodos.
export async function loadTrafficBundle(supabase: SupabaseClient, clientId: string, start?: string | null): Promise<TrafficBundle> {
  const { data } = await supabase
    .from('traffic_reports')
    .select('*')
    .eq('client_id', clientId)
    .order('period_start', { ascending: true })

  const reports = (data ?? []) as TrafficReport[]
  const today = todayStr()

  let idx = start ? reports.findIndex(r => r.period_start === start) : -1
  if (!start) {
    idx = reports.findIndex(r => r.period_start <= today && today <= r.period_end)
    if (idx < 0) {
      for (let i = reports.length - 1; i >= 0; i--) {
        if (reports[i].period_start <= today) { idx = i; break }
      }
    }
    if (idx < 0 && reports.length > 0) idx = reports.length - 1
  }

  return {
    report: idx >= 0 ? reports[idx] : null,
    previous: idx > 0 ? reports[idx - 1] : null,
    history: idx >= 0 ? reports.slice(Math.max(0, idx - 5), idx + 1) : [],
    periods: reports.map(r => ({ start: r.period_start, end: r.period_end })).reverse(),
  }
}
