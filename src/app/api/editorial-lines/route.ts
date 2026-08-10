import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = await createServiceClient()
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('editorial_lines')
    .select('*, clients(name)')
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createServiceClient()

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const clientId = formData.get('client_id') as string | null

  if (!file || !clientId) {
    return NextResponse.json({ error: 'Arquivo e client_id obrigatórios' }, { status: 400 })
  }

  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Apenas PDFs são aceitos' }, { status: 400 })
  }

  // Remove a linha editorial anterior, se existir
  const { data: existing } = await supabase
    .from('editorial_lines')
    .select('id, pdf_path')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (existing?.pdf_path) {
    await supabase.storage.from('editorial-pdfs').remove([existing.pdf_path])
    await supabase.from('editorial_lines').delete().eq('id', existing.id)
  }

  // Upload do novo PDF
  const ts = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const pdfPath = `${clientId}/${ts}_${safeName}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: uploadError } = await supabase.storage
    .from('editorial-pdfs')
    .upload(pdfPath, buffer, { contentType: 'application/pdf', upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  // Validade: 90 dias a partir de hoje
  const today = new Date()
  const validFrom = today.toISOString().slice(0, 10)
  const validUntil = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data, error } = await supabase.from('editorial_lines').insert({
    client_id: clientId,
    pdf_path: pdfPath,
    pdf_name: file.name,
    valid_from: validFrom,
    valid_until: validUntil,
  }).select().single()

  if (error) {
    await supabase.storage.from('editorial-pdfs').remove([pdfPath])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
