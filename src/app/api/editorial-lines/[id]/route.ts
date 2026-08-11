import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('editorial_lines')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const { data: signedUrl } = await supabase.storage
    .from('editorial-pdfs')
    .createSignedUrl(data.pdf_path, 3600)

  return NextResponse.json({ ...data, url: signedUrl?.signedUrl ?? null })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('editorial_lines')
    .select('pdf_path')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  if (data?.pdf_path) {
    await supabase.storage.from('editorial-pdfs').remove([data.pdf_path])
  }

  await supabase.from('editorial_lines').delete().eq('id', id)
  return NextResponse.json({ deleted: true })
}
