import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function DELETE() {
  const supabase = await createServiceClient()
  const today = new Date().toISOString().split('T')[0]

  const { error, count } = await supabase
    .from('charges')
    .delete({ count: 'exact' })
    .is('paid_at', null)
    .lt('due_date', today)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deleted: count ?? 0 })
}
