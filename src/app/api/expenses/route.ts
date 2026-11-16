import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createOwlExpense } from '@/lib/finance/create'

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().split('T')[0]
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // YYYY-MM
  const supabase = createServiceClient()

  let query = supabase.from('expenses').select('*').order('due_date', { ascending: true })
  if (month) {
    const monthStart = `${month}-01`
    query = query.gte('due_date', monthStart).lt('due_date', addMonths(monthStart, 1))
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const r = await createOwlExpense(await request.json())
  return r.ok ? NextResponse.json(r.data, { status: 201 }) : NextResponse.json({ error: r.error }, { status: r.status })
}
