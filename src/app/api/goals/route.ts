import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('goals')
    .select('*, clients(id, name)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createServiceClient()
  const body = await request.json()

  const now = new Date()
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const { data, error } = await supabase
    .from('goals')
    .insert({
      period: body.period ?? defaultPeriod,
      type: (body.type === 'mrr' || body.type === 'clientes') ? body.type : 'mrr',
      target_value: body.target_value,
      title: body.title ?? null,
      client_id: body.client_id ?? null,
      deadline: body.deadline ?? null,
      current_value: body.current_value ?? 0,
      unit: body.unit ?? null,
    })
    .select('*, clients(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
