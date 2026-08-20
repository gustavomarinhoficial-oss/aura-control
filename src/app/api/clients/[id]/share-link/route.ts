import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'

// GET: retorna o token de compartilhamento do cliente, gerando um se ainda não existir
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: client, error } = await supabase.from('clients').select('share_token').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let token = client.share_token
  if (!token) {
    token = randomUUID()
    const { error: updErr } = await supabase.from('clients').update({ share_token: token }).eq('id', id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({ token })
}

// POST: gera um token novo, invalidando o link anterior
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const token = randomUUID()
  const { error } = await supabase.from('clients').update({ share_token: token }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ token })
}
