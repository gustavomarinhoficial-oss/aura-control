import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadTrafficBundle } from '@/lib/traffic/server'
import { MetaError, syncReportFromMeta } from '@/lib/traffic/meta'

// POST { start?: 'YYYY-MM-DD' } — puxa da Meta os números do período (o que está
// rodando hoje, se não vier "start") e atualiza o relatório.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const start = typeof body.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.start) ? body.start : null

  const supabase = createServiceClient()
  const { data: client } = await supabase.from('clients').select('meta_ad_account_id').eq('id', id).single()
  if (!client?.meta_ad_account_id) {
    return NextResponse.json({ error: 'Esse cliente ainda não tem a conta de anúncios da Meta cadastrada.' }, { status: 400 })
  }

  const bundle = await loadTrafficBundle(supabase, id, start)
  if (!bundle.report) {
    return NextResponse.json({ error: 'Crie um período primeiro (Novo período) pra eu preencher com os números da Meta.' }, { status: 400 })
  }

  try {
    const result = await syncReportFromMeta(supabase, id, client.meta_ad_account_id, bundle.report)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const status = err instanceof MetaError && err.code === 'no_token' ? 400 : 502
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao sincronizar com a Meta.' }, { status })
  }
}
