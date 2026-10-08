import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fieldByKey, slugify } from '@/lib/onboarding/form'

const BUCKET = 'client-files'

async function clientByToken(token: string | null | undefined) {
  if (!token) return null
  const supabase = createServiceClient()
  const { data } = await supabase.from('clients').select('id').eq('onboarding_token', token).maybeSingle()
  return data ? { supabase, clientId: (data as { id: string }).id } : null
}

// POST { token, field, filename } → URL de envio assinada. O arquivo vai direto do
// navegador pro Storage (sem passar pelo nosso servidor) e já cai na pasta do
// cliente, com o nome do "slot" certo pra aparecer organizado no Documentos.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const ctx = await clientByToken(body.token)
  if (!ctx) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })

  const field = fieldByKey(String(body.field ?? ''))
  if (!field || field.type !== 'file') return NextResponse.json({ error: 'Campo inválido' }, { status: 400 })
  const original = String(body.filename ?? '').slice(0, 150)
  if (!original) return NextResponse.json({ error: 'Nome do arquivo obrigatório' }, { status: 400 })

  const folder = field.folder ?? 'outros'
  // O Storage só aceita caracteres ASCII na chave: tira acentos e troca o resto por _.
  const safe = original.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
  const filename = `${Date.now()}_${slugify(field.slot ?? field.key)}_${safe}`
  const path = `${ctx.clientId}/${folder}/${filename}`

  const { data, error } = await ctx.supabase.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ path: data.path, token: data.token, name: original }, { status: 201 })
}

// DELETE { token, path } → o cliente removeu um arquivo que tinha enviado
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => ({}))
  const ctx = await clientByToken(body.token)
  if (!ctx) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })

  const path = String(body.path ?? '')
  if (!path.startsWith(`${ctx.clientId}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'Arquivo inválido' }, { status: 400 })
  }
  await ctx.supabase.storage.from(BUCKET).remove([path])
  return NextResponse.json({ ok: true })
}
