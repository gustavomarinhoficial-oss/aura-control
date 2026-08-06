import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServiceClient()

  const [clientRes, servicesRes, historyRes] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase.from('services').select('*').eq('client_id', id).order('created_at', { ascending: false }),
    supabase.from('client_status_history').select('*').eq('client_id', id).order('changed_at', { ascending: false }),
  ])

  if (clientRes.error) return NextResponse.json({ error: clientRes.error.message }, { status: 404 })

  return NextResponse.json({
    ...clientRes.data,
    services: servicesRes.data ?? [],
    status_history: historyRes.data ?? [],
  })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServiceClient()
  const body = await request.json()

  if (body.status) {
    const { data: current } = await supabase.from('clients').select('status').eq('id', id).single()
    if (current && current.status !== body.status) {
      await supabase.from('client_status_history').insert({
        client_id: id,
        old_status: current.status,
        new_status: body.status,
        note: body.status_note || null,
      })
    }
  }

  const { data, error } = await supabase
    .from('clients')
    .update({ name: body.name, email: body.email, phone: body.phone, status: body.status, started_at: body.started_at, notes: body.notes, billing_day: body.billing_day !== undefined ? (body.billing_day || null) : undefined })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServiceClient()

  // Apaga registros relacionados antes do cliente
  await supabase.from('charges').delete().eq('client_id', id)
  await supabase.from('tasks').update({ client_id: null }).eq('client_id', id)
  await supabase.from('services').delete().eq('client_id', id)
  await supabase.from('client_status_history').delete().eq('client_id', id)

  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
