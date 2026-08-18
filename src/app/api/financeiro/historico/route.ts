import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Returns last 6 months of revenue (paid charges) vs expenses (paid)
export async function GET() {
  const supabase = createServiceClient()
  const months: { year: number; month: number; label: string; key: string }[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
    months.push({ year: d.getFullYear(), month: d.getMonth() + 1, label, key })
  }

  const last = months[months.length - 1]
  const from = `${months[0].key}-01`
  const to = new Date(last.year, last.month, 0).toISOString().split('T')[0]

  const [chargesRes, expensesRes] = await Promise.all([
    supabase.from('charges').select('amount, paid_at').not('paid_at', 'is', null).gte('paid_at', from).lte('paid_at', to),
    supabase.from('expenses').select('amount, paid_at, due_date').gte('due_date', from).lte('due_date', to),
  ])

  const result = months.map(({ key, label }) => {
    const revenue = (chargesRes.data ?? [])
      .filter(c => c.paid_at?.startsWith(key))
      .reduce((s, c) => s + Number(c.amount), 0)
    const expenses = (expensesRes.data ?? [])
      .filter(e => e.due_date?.startsWith(key))
      .reduce((s, e) => s + Number(e.amount), 0)
    return { label, key, revenue, expenses, profit: revenue - expenses }
  })

  return NextResponse.json(result)
}
