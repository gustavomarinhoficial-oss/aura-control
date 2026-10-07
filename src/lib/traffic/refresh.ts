import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, todayStr, type TrafficBundle } from './metrics'
import { metaConfigured, syncReportFromMeta } from './meta'
import { loadTrafficBundle } from './server'

// A Vercel (plano Hobby) só deixa rodar rotina 1x por dia. Pra o relatório não
// ficar velho o resto do dia, quem abre a página dispara a atualização com a
// Meta quando os números têm mais de STALE_MINUTES.
const STALE_MINUTES = 30
// Evita martelar a Meta se ela estiver falhando (token vencido, por exemplo).
const RETRY_AFTER_MS = 5 * 60_000
const lastAttempt = new Map<string, number>()

export async function refreshIfStale(
  supabase: SupabaseClient,
  clientId: string,
  adAccountId: string | null | undefined,
  bundle: TrafficBundle,
): Promise<TrafficBundle> {
  const report = bundle.report
  if (!report || !adAccountId || !metaConfigured()) return bundle

  // Só período em andamento (ou fechado há até 3 dias, quando a Meta ainda ajusta atribuição).
  const today = todayStr()
  if (today < report.period_start || today > addDays(report.period_end, 3)) return bundle

  const age = Date.now() - new Date(report.updated_at ?? 0).getTime()
  if (age < STALE_MINUTES * 60_000) return bundle

  const key = `${clientId}:${report.period_start}`
  const last = lastAttempt.get(key) ?? 0
  if (Date.now() - last < RETRY_AFTER_MS) return bundle
  lastAttempt.set(key, Date.now())

  try {
    await syncReportFromMeta(supabase, clientId, adAccountId, report)
    return await loadTrafficBundle(supabase, clientId, report.period_start)
  } catch {
    return bundle
  }
}
