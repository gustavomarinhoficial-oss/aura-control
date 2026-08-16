import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getClientWeeklyReport } from '@/lib/weeklyReport/generate'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const weekStart = searchParams.get('week_start')
  const force = searchParams.get('force') === 'true'

  const supabase = createServiceClient()

  // Pedido de um relatório específico de cliente que ainda não existe: gera na hora
  if (clientId && (force || weekStart === null)) {
    try {
      const fresh = await getClientWeeklyReport(clientId, force)
      if (fresh && (!weekStart || fresh.week_start === weekStart)) {
        // segue pra listar o histórico completo abaixo, já com o mais recente atualizado
      }
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro' }, { status: 500 })
    }
  }

  let query = supabase.from('weekly_reports').select('*, clients(id, name)').order('week_start', { ascending: false }).limit(20)
  query = clientId ? query.eq('client_id', clientId) : query.is('client_id', null)
  if (weekStart) query = query.eq('week_start', weekStart)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
