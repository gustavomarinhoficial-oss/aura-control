import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { canAccessFinance } from '@/lib/finance/access'
import { computeCashFlow } from '@/lib/finance/cashFlow'

// GET ?workspace=owl|fdmc&month=YYYY-MM → fluxo de caixa do mês (veio do anterior, entrou, saiu, aplicado, saldo final)
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams
  const workspace = sp.get('workspace') === 'fdmc' ? 'fdmc' : 'owl'
  const month = sp.get('month') ?? ''
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'Mês inválido' }, { status: 400 })
  if (!(await canAccessFinance(workspace))) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  return NextResponse.json(await computeCashFlow(workspace, month))
}

// PUT { workspace, opening_balance, flow_start_month } → ponto de partida (saldo inicial e mês em que começa a contar)
export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}))
  const workspace = body.workspace === 'fdmc' ? 'fdmc' : 'owl'
  if (!(await canAccessFinance(workspace))) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const opening = Number(body.opening_balance ?? 0)
  if (!Number.isFinite(opening)) return NextResponse.json({ error: 'Saldo inicial inválido' }, { status: 400 })
  const start = body.flow_start_month ? String(body.flow_start_month) : null
  if (start && !/^\d{4}-\d{2}$/.test(start)) return NextResponse.json({ error: 'Mês inválido' }, { status: 400 })

  const { error } = await createServiceClient()
    .from('available_cash')
    .update({ opening_balance: opening, flow_start_month: start })
    .eq('workspace', workspace)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
