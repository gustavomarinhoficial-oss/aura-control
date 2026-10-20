import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { canAccessFinance } from '@/lib/finance/access'

// Caixa disponível (conta corrente, sem aplicar), informado na mão. ?workspace=owl|fdmc
const allowed = canAccessFinance

export async function GET(request: Request) {
  const workspace = new URL(request.url).searchParams.get('workspace') ?? 'owl'
  if (!(await allowed(workspace))) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { data, error } = await createServiceClient().from('available_cash').select('*').eq('workspace', workspace).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? { workspace, amount: 0, note: null, updated_at: null })
}

// PUT { workspace, amount, note? }
export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}))
  const workspace = String(body.workspace ?? 'owl')
  if (!(await allowed(workspace))) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const amount = Number(body.amount)
  if (!Number.isFinite(amount)) return NextResponse.json({ error: 'Informe um valor válido' }, { status: 400 })

  const { data, error } = await createServiceClient()
    .from('available_cash')
    .upsert({ workspace, amount, note: body.note ? String(body.note).slice(0, 200) : null, updated_at: new Date().toISOString() }, { onConflict: 'workspace' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
