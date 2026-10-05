import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { loadTrafficBundle } from '@/lib/traffic/server'

// GET /api/public/traffic?token=X&start=YYYY-MM-DD
// Devolve só os números de tráfego do cliente dono do token, e só se o
// compartilhamento estiver ligado pra ele. Nunca dados internos. Sem "start",
// abre no período que está rodando hoje (ou no mais recente).
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

  const start = searchParams.get('start')
  const bundle = await loadTrafficBundle(supabase, client.id, start && /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : null)

  return NextResponse.json({ client: { id: client.id, name: client.name }, ...bundle })
}
