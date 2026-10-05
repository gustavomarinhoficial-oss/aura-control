import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { metaConfigured, syncReportFromMeta } from '@/lib/traffic/meta'
import { addDays, todayStr, type TrafficReport } from '@/lib/traffic/metrics'

function checkAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

// Atualiza com a Meta, pra todo cliente com conta de anúncios cadastrada, o
// período que está rodando e, por 3 dias depois de fechar, o recém-fechado
// (a Meta ainda ajusta atribuição nesses dias).
async function run() {
  if (!metaConfigured()) return { skipped: 'META_ADS_TOKEN não configurado' }

  const supabase = createServiceClient()
  const { data: clients } = await supabase.from('clients').select('id, name, meta_ad_account_id').not('meta_ad_account_id', 'is', null)
  const today = todayStr()
  const results: Record<string, string> = {}

  for (const c of clients ?? []) {
    try {
      const { data } = await supabase.from('traffic_reports').select('*').eq('client_id', c.id)
      const due = ((data ?? []) as TrafficReport[]).filter(r => r.period_start <= today && today <= addDays(r.period_end, 3))
      if (due.length === 0) { results[c.name] = 'sem período pra atualizar'; continue }
      for (const r of due) await syncReportFromMeta(supabase, c.id, c.meta_ad_account_id as string, r)
      results[c.name] = `ok (${due.length} período${due.length > 1 ? 's' : ''})`
    } catch (err) {
      results[c.name] = err instanceof Error ? err.message : 'erro'
    }
  }
  return results
}

export async function GET(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await run())
}

export async function POST(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await run())
}
