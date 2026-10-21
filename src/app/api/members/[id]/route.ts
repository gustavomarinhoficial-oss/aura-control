import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServiceClient()
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const update: Record<string, unknown> = {}
  if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim()
  if (typeof body.initials === 'string' && body.initials.trim()) update.initials = body.initials.trim()
  if (typeof body.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.color)) update.color = body.color
  if (body.avatar_url !== undefined) update.avatar_url = typeof body.avatar_url === 'string' && body.avatar_url ? body.avatar_url : null
  if (Object.keys(update).length === 0) return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
  const { data, error } = await supabase.from('members').update(update).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = createServiceClient()
  const { id } = await params
  const { error } = await supabase.from('members').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
