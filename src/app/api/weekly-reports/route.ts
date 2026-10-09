import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { getRole, isFinanceRestricted } from '@/lib/roles'
import { getClientWeeklyReport, stripFinance } from '@/lib/weeklyReport/generate'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const weekStart = searchParams.get('week_start')
  const force = searchParams.get('force') === 'true'

  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const restricted = isFinanceRestricted(getRole(user.user_metadata))

  // O relatório geral da empresa tem MRR e financeiro: não é pra quem não tem acesso ao financeiro.
  if (restricted && !clientId) return NextResponse.json({ error: 'Sem acesso' }, { status: 403 })

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
  // Julia/Mari: tira os números de dinheiro (e frases que citem valores, em relatórios antigos).
  if (restricted) {
    return NextResponse.json((data ?? []).map(r => ({ ...r, data: stripFinance(r.data), summary: scrubMoney(r.summary) })))
  }
  return NextResponse.json(data)
}

function scrubMoney(text: string): string {
  const parts = String(text ?? '').split(/(?<=[.!?])\s+/)
  return parts.filter(p => !/R\$|MRR|faturamento|cobran[çc]a|receita|recebid/i.test(p)).join(' ').trim() || 'Resumo disponível apenas com os números abaixo.'
}
