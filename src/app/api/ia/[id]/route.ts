import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServiceClient()
  const { id } = await params
  const body = await request.json()

  const allowed = ['title', 'description', 'category', 'content', 'link', 'tags', 'author', 'featured', 'uses_count', 'file_path', 'file_name']
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  const { data, error } = await supabase
    .from('ai_resources')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServiceClient()
  const { id } = await params

  // Remove arquivo do storage se existir
  const { data: resource } = await supabase.from('ai_resources').select('file_path').eq('id', id).single()
  if (resource?.file_path) {
    await supabase.storage.from('ia-files').remove([resource.file_path])
  }

  const { error } = await supabase.from('ai_resources').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServiceClient()
  const { id } = await params

  const { data: resource } = await supabase.from('ai_resources').select('file_path, file_name').eq('id', id).single()
  if (!resource?.file_path) return NextResponse.json({ error: 'Sem arquivo' }, { status: 404 })

  const { data } = await supabase.storage.from('ia-files').createSignedUrl(resource.file_path, 3600)
  return NextResponse.json({ url: data?.signedUrl ?? null, name: resource.file_name })
}
