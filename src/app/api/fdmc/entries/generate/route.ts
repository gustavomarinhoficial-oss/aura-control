import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireFdmcAccess } from '@/lib/fdmc/auth'

const BUFFER_MONTHS = 3

function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().split('T')[0]
}

// Mantém 3 meses de parcelas à frente pra cada lançamento recorrente ativo.
export async function POST() {
  if (!(await requireFdmcAccess())) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const supabase = createServiceClient()
  const limit = addMonths(new Date().toISOString().split('T')[0], BUFFER_MONTHS)

  const { data: rows } = await supabase
    .from('fdmc_entries')
    .select('type, description, amount, category, entry_date, notes, recurrence_group, recurrence_end_date')
    .eq('recurrent', true)
    .not('recurrence_group', 'is', null)
    .order('entry_date', { ascending: false })
  if (!rows?.length) return NextResponse.json({ generated: 0 })

  const latest = new Map<string, (typeof rows)[number]>()
  for (const r of rows) if (!latest.has(r.recurrence_group as string)) latest.set(r.recurrence_group as string, r)

  const toInsert: Record<string, unknown>[] = []
  for (const [group, l] of latest) {
    let date = addMonths(l.entry_date, 1)
    while (date <= limit) {
      if (l.recurrence_end_date && date >= l.recurrence_end_date) break
      toInsert.push({
        type: l.type, description: l.description, amount: l.amount, category: l.category, notes: l.notes,
        entry_date: date, recurrent: true, recurrence_group: group, recurrence_end_date: l.recurrence_end_date,
      })
      date = addMonths(date, 1)
    }
  }
  if (toInsert.length) {
    await supabase.from('fdmc_entries').upsert(toInsert, { onConflict: 'recurrence_group,entry_date', ignoreDuplicates: true })
  }
  return NextResponse.json({ generated: toInsert.length })
}
