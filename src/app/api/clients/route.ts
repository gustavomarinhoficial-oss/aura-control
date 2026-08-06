import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('clients')
    .select('*, services(id, amount, type, active)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createServiceClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('clients')
    .insert({
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      status: body.status || 'ativo',
      started_at: body.started_at,
      notes: body.notes || null,
      billing_day: body.billing_day || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-create a project for the new client
  await supabase.from('projects').insert({
    client_id: data.id,
    title: `Projeto — ${data.name}`,
    status: 'afazer',
    responsaveis: [],
    checklist: [],
  })

  return NextResponse.json(data, { status: 201 })
}
