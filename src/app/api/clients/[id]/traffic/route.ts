import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadTrafficBundle } from '@/lib/traffic/server'
import { currentMonthStr } from '@/lib/traffic/metrics'

const MONTH_RE = /^\d{4}-\d{2}$/

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') ?? currentMonthStr()
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: 'Mês inválido' }, { status: 400 })

  const supabase = createServiceClient()
  const bundle = await loadTrafficBundle(supabase, id, month)
  return NextResponse.json(bundle)
}

const isoDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  if (!MONTH_RE.test(body.month ?? '')) return NextResponse.json({ error: 'Mês inválido' }, { status: 400 })

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
    month: body.month,
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
  const { data, error } = await supabase
    .from('traffic_reports')
    .upsert(payload, { onConflict: 'client_id,month' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') ?? ''
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: 'Mês inválido' }, { status: 400 })

  const supabase = createServiceClient()
  const { error } = await supabase.from('traffic_reports').delete().eq('client_id', id).eq('month', month)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
