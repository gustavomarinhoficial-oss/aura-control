import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'client-files'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET /api/clients/[id]/files/[folder]?name=filename → URL assinada
export async function GET(request: Request, { params }: { params: Promise<{ id: string; filename: string }> }) {
  const { id, filename: folder } = await params
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name obrigatório' }, { status: 400 })

  const supabase = adminClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(`${id}/${folder}/${name}`, 3600)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}

// DELETE /api/clients/[id]/files/[folder]?name=filename
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; filename: string }> }) {
  const { id, filename: folder } = await params
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'name obrigatório' }, { status: 400 })

  const supabase = adminClient()
  const { error } = await supabase.storage.from(BUCKET).remove([`${id}/${folder}/${name}`])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
