import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadTrafficBundle } from '@/lib/traffic/server'
import { currentMonthStr } from '@/lib/traffic/metrics'

// GET /api/public/traffic?token=X&month=YYYY-MM
// Devolve só os números de tráfego do cliente dono do token, e só se o
// compartilhamento estiver ligado pra ele. Nunca dados internos.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: client } = await supabase
    .from('clients')
    .select('id, name, traffic_sharing_enabled')
    .eq('share_token', token)
    .maybeSingle()
  if (!client) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  if (client.traffic_sharing_enabled !== true) {
    return NextResponse.json({ error: 'Relatório indisponível' }, { status: 403 })
  }

  const requested = searchParams.get('month')
  const valid = !!requested && /^\d{4}-\d{2}$/.test(requested)
  let month = valid ? (requested as string) : currentMonthStr()
  let bundle = await loadTrafficBundle(supabase, client.id, month)
  // Sem mês pedido e sem números no mês atual: abre no mês mais recente que tenha dados.
  if (!valid && !bundle.report && bundle.months[0]) {
    month = bundle.months[0]
    bundle = await loadTrafficBundle(supabase, client.id, month)
  }

  return NextResponse.json({ client: { id: client.id, name: client.name }, month, ...bundle })
}
