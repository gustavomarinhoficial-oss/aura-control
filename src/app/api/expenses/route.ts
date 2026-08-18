import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

const HORIZON_MONTHS = 6

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
    query = query.gte('due_date', `${month}-01`).lte('due_date', `${month}-31`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  const recurrent = body.recurrent ?? false
  const recurrenceGroup = recurrent ? randomUUID() : null

  const { data, error } = await supabase.from('expenses').insert({
    description: body.description,
    amount: Number(body.amount),
    category: body.category || 'outro',
    due_date: body.due_date,
    paid_at: body.paid_at || null,
    recurrent,
    recurrence_group: recurrenceGroup,
    notes: body.notes || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Gera as próximas parcelas mensais automaticamente
  if (recurrent && recurrenceGroup) {
    const future = []
    for (let i = 1; i <= HORIZON_MONTHS; i++) {
      future.push({
        description: body.description,
        amount: Number(body.amount),
        category: body.category || 'outro',
        due_date: addMonths(body.due_date, i),
        recurrent: true,
        recurrence_group: recurrenceGroup,
        notes: body.notes || null,
      })
    }
    await supabase.from('expenses').insert(future)
  }

  return NextResponse.json(data, { status: 201 })
}
