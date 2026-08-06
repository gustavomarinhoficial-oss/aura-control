import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createServiceClient()
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // formato: YYYY-MM

  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('charges')
    .select('*, clients(name, phone), services(active, contract_end)')
    .order('due_date', { ascending: false })

  if (month) {
    const start = `${month}-01`
    const [year, m] = month.split('-').map(Number)
    const end = new Date(year, m, 0).toISOString().split('T')[0]
    query = query.gte('due_date', start).lte('due_date', end)
  }

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createServiceClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('charges')
    .insert({
      client_id: body.client_id,
      service_id: body.service_id || null,
      description: body.description,
      amount: body.amount,
      due_date: body.due_date,
      status: 'pendente',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
