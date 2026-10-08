import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { missingRequired, sanitizeAnswers } from '@/lib/onboarding/form'
import { applyOnboarding } from '@/lib/onboarding/apply'

export const maxDuration = 30

async function clientByToken(token: string | null | undefined) {
  if (!token) return null
  const supabase = createServiceClient()
  const { data } = await supabase.from('clients').select('id, name').eq('onboarding_token', token).maybeSingle()
  return data ? { supabase, client: data as { id: string; name: string } } : null
}

// GET ?token=X → o que já foi respondido (rascunho ou enviado)
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  const ctx = await clientByToken(token)
  if (!ctx) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })

  const { data: row } = await ctx.supabase.from('client_onboarding').select('*').eq('client_id', ctx.client.id).maybeSingle()
  return NextResponse.json({
    client: { name: ctx.client.name },
    status: row?.status ?? 'rascunho',
    step: row?.current_step ?? 0,
    answers: row?.answers ?? {},
    submittedAt: row?.submitted_at ?? null,
  })
}

// PUT { token, answers, step } → salva o rascunho (chamado a cada alteração)
export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}))
  const ctx = await clientByToken(body.token)
  if (!ctx) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })

  const answers = sanitizeAnswers(body.answers, ctx.client.id)
  const step = Number.isInteger(body.step) && body.step >= 0 ? body.step : 0

  const { error } = await ctx.supabase.from('client_onboarding').upsert(
    { client_id: ctx.client.id, answers, current_step: step, updated_at: new Date().toISOString() },
    { onConflict: 'client_id' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// POST { token, answers } → envia o formulário: valida o essencial, guarda e aplica no Hub
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const ctx = await clientByToken(body.token)
  if (!ctx) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })

  const answers = sanitizeAnswers(body.answers, ctx.client.id)
  const missing = missingRequired(answers)
  if (missing.length > 0) {
    return NextResponse.json(
      { error: 'Faltam campos obrigatórios', missing: missing.map(m => ({ section: m.section.title, label: m.field.label })) },
      { status: 400 },
    )
  }

  const now = new Date().toISOString()
  const { error } = await ctx.supabase.from('client_onboarding').upsert(
    { client_id: ctx.client.id, answers, status: 'enviado', submitted_at: now, updated_at: now },
    { onConflict: 'client_id' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aplicar no Hub é automático; se falhar, as respostas já estão salvas e dá pra reaplicar na ficha.
  let applied = false
  try {
    await applyOnboarding(ctx.supabase, ctx.client.id, answers)
    await ctx.supabase.from('client_onboarding').update({ applied_at: new Date().toISOString() }).eq('client_id', ctx.client.id)
    applied = true
  } catch {
    applied = false
  }

  return NextResponse.json({ ok: true, applied })
}
