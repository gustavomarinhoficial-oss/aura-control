import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadTrafficBundle } from '@/lib/traffic/server'
import { refreshIfStale } from '@/lib/traffic/refresh'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// GET ?start=YYYY-MM-DD  → período que começa nesse dia (sem start: o que está rodando hoje)
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  if (start && !DATE_RE.test(start)) return NextResponse.json({ error: 'Data inválida' }, { status: 400 })

  const supabase = createServiceClient()
  const first = await loadTrafficBundle(supabase, id, start)
  // Painel sempre mostra números frescos: se estão velhos, atualiza com a Meta antes de responder.
  const { data: client } = await supabase.from('clients').select('meta_ad_account_id').eq('id', id).single()
  const bundle = await refreshIfStale(supabase, id, client?.meta_ad_account_id, first)
  return NextResponse.json(bundle)
}

const isoDate = (v: unknown) => (typeof v === 'string' && DATE_RE.test(v) ? v : null)

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()

  const periodStart = isoDate(body.period_start)
  const periodEnd = isoDate(body.period_end)
  if (!periodStart || !periodEnd) return NextResponse.json({ error: 'Informe o início e o fim do período' }, { status: 400 })
  if (periodEnd < periodStart) return NextResponse.json({ error: 'O fim do período não pode ser antes do início' }, { status: 400 })

  const campaigns = (Array.isArray(body.campaigns) ? body.campaigns : [])
    .filter((c: { name?: string }) => c && typeof c.name === 'string' && c.name.trim())
    .map((c: Record<string, unknown>) => ({
      ...(typeof c.id === 'string' && c.id ? { id: c.id } : {}),
      name: String(c.name).trim(),
      start_date: isoDate(c.start_date),
      end_date: isoDate(c.end_date),
      note: typeof c.note === 'string' && c.note.trim() ? c.note.trim() : null,
      spend: num(c.spend),
      impressions: Math.round(num(c.impressions)),
      reach: Math.round(num(c.reach)),
      link_clicks: Math.round(num(c.link_clicks)),
      results: Math.round(num(c.results)),
    }))

  const payload = {
    client_id: id,
    period_start: periodStart,
    period_end: periodEnd,
    spend: num(body.spend),
    impressions: Math.round(num(body.impressions)),
    reach: Math.round(num(body.reach)),
    link_clicks: Math.round(num(body.link_clicks)),
    results: Math.round(num(body.results)),
    result_label: (typeof body.result_label === 'string' && body.result_label.trim()) || 'Resultados',
    campaigns,
    analysis: typeof body.analysis === 'string' && body.analysis.trim() ? body.analysis.trim() : null,
    updated_at: new Date().toISOString(),
  }

  const supabase = createServiceClient()
  const originalStart = isoDate(body.original_start)

  // Editando um período existente (inclusive mudando a data de início): atualiza a mesma linha.
  const query = originalStart
    ? supabase.from('traffic_reports').update(payload).eq('client_id', id).eq('period_start', originalStart)
    : supabase.from('traffic_reports').upsert(payload, { onConflict: 'client_id,period_start' })

  const { data, error } = await query.select().single()
  if (error) {
    const clash = error.code === '23505'
    return NextResponse.json({ error: clash ? 'Já existe um período começando nesse dia' : error.message }, { status: clash ? 409 : 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start')
  if (!start || !DATE_RE.test(start)) return NextResponse.json({ error: 'Data inválida' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase.from('traffic_reports').delete().eq('client_id', id).eq('period_start', start)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
