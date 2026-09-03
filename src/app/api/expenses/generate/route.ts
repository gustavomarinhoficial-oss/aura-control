import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

const BUFFER_MONTHS = 3

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().split('T')[0]
}

// Adota despesas recorrentes antigas (criadas antes do recurrence_group existir)
// agrupando por descrição, pra que também passem a ter os meses futuros gerados.
async function backfillLegacyGroups(supabase: ReturnType<typeof createServiceClient>) {
  const { data: legacy } = await supabase
    .from('expenses')
    .select('id, description')
    .eq('recurrent', true)
    .is('recurrence_group', null)

  if (!legacy?.length) return

  const groupByDescription = new Map<string, string>()
  for (const row of legacy) {
    const key = row.description.trim()
    if (!groupByDescription.has(key)) groupByDescription.set(key, randomUUID())
    await supabase.from('expenses').update({ recurrence_group: groupByDescription.get(key) }).eq('id', row.id)
  }
}

// Mantém sempre 3 meses de parcelas à frente pra cada despesa recorrente ativa,
// gerando uma de cada vez conforme o tempo passa (mesmo padrão de /api/charges/generate).
export async function POST() {
  const supabase = createServiceClient()
  const today = new Date().toISOString().split('T')[0]
  const futureLimit = addMonths(today, BUFFER_MONTHS)

  await backfillLegacyGroups(supabase)

  const { data: rows, error } = await supabase
    .from('expenses')
    .select('description, amount, category, due_date, recurrent, recurrence_group, recurrence_end_date, notes')
    .eq('recurrent', true)
    .not('recurrence_group', 'is', null)
    .order('due_date', { ascending: false })

  if (error || !rows?.length) return NextResponse.json({ generated: 0 })

  const latestByGroup = new Map<string, typeof rows[number]>()
  for (const row of rows) {
    const key = row.recurrence_group as string
    if (!latestByGroup.has(key)) latestByGroup.set(key, row)
  }

  let totalGenerated = 0
  const newExpenses: { description: string; amount: number; category: string; due_date: string; recurrent: boolean; recurrence_group: string; recurrence_end_date: string | null; notes: string | null }[] = []

  for (const [group, latest] of latestByGroup) {
    if (latest.due_date >= futureLimit) continue

    let dueDate = addMonths(latest.due_date, 1)
    while (dueDate <= futureLimit) {
      if (latest.recurrence_end_date && dueDate >= latest.recurrence_end_date) break
      newExpenses.push({
        description: latest.description,
        amount: latest.amount,
        category: latest.category,
        due_date: dueDate,
        recurrent: true,
        recurrence_group: group,
        recurrence_end_date: latest.recurrence_end_date,
        notes: latest.notes,
      })
      dueDate = addMonths(dueDate, 1)
    }
  }

  if (newExpenses.length > 0) {
    // upsert com ignoreDuplicates: se essa rota rodar duas vezes quase junto
    // (mesma causa da BMF/Petnico duplicadas), a segunda chamada não cria de
    // novo a parcela que a primeira já gerou pro mesmo grupo+vencimento.
    await supabase.from('expenses').upsert(newExpenses, { onConflict: 'recurrence_group,due_date', ignoreDuplicates: true })
    totalGenerated = newExpenses.length
  }

  return NextResponse.json({ generated: totalGenerated })
}
