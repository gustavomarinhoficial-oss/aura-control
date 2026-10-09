import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET → pacotes (abertos primeiro) com os vídeos já registrados
export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('freelancer_packages')
    .select('*, videos:freelancer_package_videos(id, delivered_at, note, created_at)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const list = (data ?? []).map(p => ({
    ...p,
    videos: [...(p.videos ?? [])].sort((a: { created_at: string }, b: { created_at: string }) => a.created_at.localeCompare(b.created_at)),
  }))
  return NextResponse.json(list)
}

// POST { freelancer_name, total_videos, amount } → novo pacote
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const name = String(body.freelancer_name ?? '').trim()
  const total = Number(body.total_videos)
  const amount = Number(body.amount)
  if (!name) return NextResponse.json({ error: 'Informe o nome do freelancer' }, { status: 400 })
  if (!Number.isInteger(total) || total < 1) return NextResponse.json({ error: 'Informe a quantidade de vídeos' }, { status: 400 })
  if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: 'Informe o valor do pacote' }, { status: 400 })

  const supabase = createServiceClient()
  const { data, error } = await supabase.from('freelancer_packages').insert({ freelancer_name: name, total_videos: total, amount }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
