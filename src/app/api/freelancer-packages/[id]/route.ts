import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// PATCH { action: 'add_video' | 'remove_video' | 'launch_expense' | 'update' , ... }
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const supabase = createServiceClient()

  const { data: pkg } = await supabase.from('freelancer_packages').select('*').eq('id', id).single()
  if (!pkg) return NextResponse.json({ error: 'Pacote não encontrado' }, { status: 404 })

  if (body.action === 'add_video') {
    if (pkg.status !== 'aberto') return NextResponse.json({ error: 'Esse pacote já foi fechado' }, { status: 400 })
    const { error } = await supabase.from('freelancer_package_videos').insert({
      package_id: id,
      delivered_at: body.delivered_at || new Date().toISOString().split('T')[0],
      note: body.note ? String(body.note).slice(0, 200) : null,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'remove_video') {
    await supabase.from('freelancer_package_videos').delete().eq('id', String(body.video_id)).eq('package_id', id)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'update') {
    const patch: Record<string, unknown> = {}
    if (body.total_videos != null && Number.isInteger(Number(body.total_videos)) && Number(body.total_videos) > 0) patch.total_videos = Number(body.total_videos)
    if (body.amount != null && Number.isFinite(Number(body.amount))) patch.amount = Number(body.amount)
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
    const { error } = await supabase.from('freelancer_packages').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Lança a despesa do pacote (uma vez) e fecha o pacote.
  if (body.action === 'launch_expense') {
    if (pkg.status === 'fechado') return NextResponse.json({ error: 'A despesa desse pacote já foi lançada' }, { status: 400 })
    const { count } = await supabase.from('freelancer_package_videos').select('id', { count: 'exact', head: true }).eq('package_id', id)
    const today = new Date().toISOString().split('T')[0]
    const { data: exp, error } = await supabase.from('expenses').insert({
      description: `${pkg.freelancer_name}: pacote de ${pkg.total_videos} vídeos`,
      amount: Number(pkg.amount),
      category: 'freelancer',
      due_date: body.due_date || today,
      recurrent: false,
      notes: `${count ?? 0} vídeo(s) entregue(s) no pacote`,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from('freelancer_packages').update({ status: 'fechado', expense_id: exp.id, closed_at: new Date().toISOString() }).eq('id', id)
    return NextResponse.json({ ok: true, expense_id: exp.id })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('freelancer_packages').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
