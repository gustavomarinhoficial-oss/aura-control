import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireFdmcAccess } from '@/lib/fdmc/auth'

// Últimos 6 meses: receita (paga), despesas (sem pró-labore), pró-labore e lucro
export async function GET() {
  if (!(await requireFdmcAccess())) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const supabase = createServiceClient()
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    }
  })
  const from = `${months[0].key}-01`
  const last = months[5]
  const to = new Date(last.year, last.month, 0).toISOString().split('T')[0]

  const { data } = await supabase.from('fdmc_entries').select('type, amount, category, entry_date, paid_at').gte('entry_date', from).lte('entry_date', to)
  const rows = data ?? []

  return NextResponse.json(months.map(({ key, label }) => {
    const inMonth = rows.filter(r => r.entry_date.startsWith(key))
    const revenue = inMonth.filter(r => r.type === 'receita' && r.paid_at).reduce((s, r) => s + Number(r.amount), 0)
    const expenses = inMonth.filter(r => r.type === 'despesa' && r.category !== 'prolabore' && r.category !== 'aplicacao').reduce((s, r) => s + Number(r.amount), 0)
    const prolabore = inMonth.filter(r => r.type === 'despesa' && r.category === 'prolabore').reduce((s, r) => s + Number(r.amount), 0)
    return { label, key, revenue, expenses, prolabore, profit: revenue - expenses }
  }))
}
