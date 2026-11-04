import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

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
  const supabase = createServiceClient()
  const body = await request.json()

  // Dia de vencimento mudou? Guarda o anterior pra reajustar as cobranças já geradas
  let oldBillingDay: number | null | undefined
  if (body.billing_day !== undefined) {
    const { data: cur } = await supabase.from('clients').select('billing_day').eq('id', id).single()
    oldBillingDay = cur?.billing_day ?? null
  }

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
    .update({
      name: body.name, email: body.email, phone: body.phone, status: body.status, started_at: body.started_at, notes: body.notes,
      billing_day: body.billing_day !== undefined ? (body.billing_day || null) : undefined,
      content_unlocked_month: body.content_unlocked_month !== undefined ? (body.content_unlocked_month || null) : undefined,
      monthly_content_quota: body.monthly_content_quota !== undefined ? (body.monthly_content_quota || null) : undefined,
      contract_end: body.contract_end !== undefined ? (body.contract_end || null) : undefined,
      logo_url: body.logo_url !== undefined ? (body.logo_url || null) : undefined,
      project_sharing_enabled: body.project_sharing_enabled,
      content_approval_enabled: body.content_approval_enabled,
      traffic_sharing_enabled: body.traffic_sharing_enabled,
      meta_ad_account_id: body.meta_ad_account_id !== undefined ? (String(body.meta_ad_account_id ?? '').replace(/^act_/, '').trim() || null) : undefined,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // O dia de vencimento do cliente manda: as cobranças recorrentes que ainda não foram pagas
  // (deste mês em diante) passam a vencer no novo dia, pra o Financeiro bater com o painel do cliente.
  const newDay = body.billing_day ? Number(body.billing_day) : null
  if (newDay && newDay >= 1 && newDay <= 28 && newDay !== oldBillingDay) {
    const monthStart = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 8) + '01'
    const { data: pending } = await supabase
      .from('charges')
      .select('id, due_date, services(type)')
      .eq('client_id', id)
      .is('paid_at', null)
      .not('service_id', 'is', null)
      .gte('due_date', monthStart)
    for (const ch of (pending ?? []) as unknown as { id: string; due_date: string; services: { type: string } | null }[]) {
      if (ch.services?.type !== 'recorrente') continue
      const due = `${ch.due_date.slice(0, 8)}${String(newDay).padStart(2, '0')}`
      if (due !== ch.due_date) await supabase.from('charges').update({ due_date: due }).eq('id', ch.id)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  // Apaga registros relacionados antes do cliente
  await supabase.from('charges').delete().eq('client_id', id)
  await supabase.from('tasks').update({ client_id: null }).eq('client_id', id)
  await supabase.from('services').delete().eq('client_id', id)
  await supabase.from('client_status_history').delete().eq('client_id', id)

  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
