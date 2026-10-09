import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Versão "sem dinheiro" dos pacotes de freelancer, pra equipe (ex.: social media)
// registrar os vídeos entregues sem ver valores do financeiro.
export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('freelancer_packages')
    .select('id, freelancer_name, total_videos, created_at, videos:freelancer_package_videos(id)')
    .eq('status', 'aberto')
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(p => ({
    id: p.id,
    freelancer_name: p.freelancer_name,
    total_videos: p.total_videos,
    delivered: (p.videos ?? []).length,
  })))
}

// POST { package_id, delta: 1 | -1 } → soma um vídeo entregue (ou desfaz o último)
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const id = String(body.package_id ?? '')
  const supabase = createServiceClient()

  const { data: pkg } = await supabase.from('freelancer_packages').select('id, status').eq('id', id).maybeSingle()
  if (!pkg || pkg.status !== 'aberto') return NextResponse.json({ error: 'Pacote não encontrado ou já fechado' }, { status: 404 })

  if (body.delta === -1) {
    const { data: last } = await supabase.from('freelancer_package_videos').select('id').eq('package_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (last) await supabase.from('freelancer_package_videos').delete().eq('id', last.id)
    return NextResponse.json({ ok: true })
  }

  const { error } = await supabase.from('freelancer_package_videos').insert({ package_id: id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
