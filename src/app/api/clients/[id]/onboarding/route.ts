import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { applyOnboarding } from '@/lib/onboarding/apply'
import type { Answers, UploadedFile } from '@/lib/onboarding/form'

const BUCKET = 'client-files'

// GET → link do formulário (cria se não existir) + respostas + links de download dos arquivos
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: client, error } = await supabase.from('clients').select('name, onboarding_token').eq('id', id).single()
  if (error || !client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 })

  let token = client.onboarding_token as string | null
  if (!token) {
    token = randomUUID()
    const { error: updErr } = await supabase.from('clients').update({ onboarding_token: token }).eq('id', id)
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  const { data: row } = await supabase.from('client_onboarding').select('*').eq('client_id', id).maybeSingle()
  const answers = (row?.answers ?? {}) as Answers

  // Links de download (válidos por 1h) dos arquivos que o cliente enviou.
  const paths = Object.values(answers)
    .filter((v): v is UploadedFile[] => Array.isArray(v) && v.length > 0 && typeof (v[0] as UploadedFile)?.path === 'string')
    .flat()
    .map(f => f.path)
  const fileUrls: Record<string, string> = {}
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600)
    for (const s of signed ?? []) if (s.path && s.signedUrl) fileUrls[s.path] = s.signedUrl
  }

  return NextResponse.json({
    clientName: client.name,
    token,
    status: row?.status ?? null,
    step: row?.current_step ?? 0,
    submittedAt: row?.submitted_at ?? null,
    appliedAt: row?.applied_at ?? null,
    updatedAt: row?.updated_at ?? null,
    answers,
    fileUrls,
  })
}

// POST { action: 'apply' | 'regenerate' }
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const supabase = createServiceClient()

  if (body.action === 'regenerate') {
    const token = randomUUID()
    const { error } = await supabase.from('clients').update({ onboarding_token: token }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ token })
  }

  if (body.action === 'apply') {
    const { data: row } = await supabase.from('client_onboarding').select('answers').eq('client_id', id).maybeSingle()
    if (!row) return NextResponse.json({ error: 'O cliente ainda não respondeu o formulário.' }, { status: 400 })
    try {
      const result = await applyOnboarding(supabase, id, row.answers as Answers)
      await supabase.from('client_onboarding').update({ applied_at: new Date().toISOString() }).eq('client_id', id)
      return NextResponse.json({ ok: true, filled: result.filled })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao aplicar' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
