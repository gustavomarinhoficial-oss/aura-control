import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { randomUUID } from 'crypto'
import { uniqueSlug } from '@/lib/shareSlug'

// GET: retorna o token e o nome-na-URL (slug) do cliente, gerando o que ainda não existir
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: client, error } = await supabase.from('clients').select('name, share_token, share_slug').eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let token = client.share_token
  let slug = client.share_slug as string | null
  const patch: Record<string, string> = {}
  if (!token) { token = randomUUID(); patch.share_token = token }
  if (!slug) { slug = await uniqueSlug(supabase, client.name, id); patch.share_slug = slug }
  if (Object.keys(patch).length > 0) {
    const { error: updErr } = await supabase.from('clients').update(patch).eq('id', id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({ token, slug })
}

// POST: gera um link novo, invalidando o anterior (token novo e novo sufixo no nome)
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: client } = await supabase.from('clients').select('name').eq('id', id).single()
  const token = randomUUID()
  const slug = await uniqueSlug(supabase, client?.name ?? 'cliente', id)
  const { error } = await supabase.from('clients').update({ share_token: token, share_slug: slug }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ token, slug })
}
