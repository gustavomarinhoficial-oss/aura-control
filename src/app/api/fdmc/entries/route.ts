import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireFdmcAccess } from '@/lib/fdmc/auth'

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().split('T')[0]
}

export async function GET(request: Request) {
  if (!(await requireFdmcAccess())) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // YYYY-MM

  const supabase = createServiceClient()
  let query = supabase
    .from('fdmc_entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (month) {
    const monthStart = `${month}-01`
    query = query.gte('entry_date', monthStart).lt('entry_date', addMonths(monthStart, 1))
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  if (!(await requireFdmcAccess())) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const supabase = createServiceClient()
  const body = await request.json()

  if (!body.description || !body.amount || !body.entry_date || !['receita', 'despesa'].includes(body.type)) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('fdmc_entries')
    .insert({
      type: body.type,
      description: body.description,
      amount: Number(body.amount),
      entry_date: body.entry_date,
      notes: body.notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
