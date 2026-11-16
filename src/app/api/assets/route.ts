import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { canAccessFinance } from '@/lib/finance/access'
import { parseAsset, createAssetExpenses, INACTIVE_CONDITIONS } from '@/lib/finance/assets'

// GET → bens da empresa + quanto de cada um já foi pago no Financeiro + totais do topo
export async function GET() {
  if (!(await canAccessFinance('owl'))) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const db = createServiceClient()
  const [assetsRes, expRes] = await Promise.all([
    db.from('company_assets').select('*').order('purchase_date', { ascending: false }),
    db.from('expenses').select('asset_id, amount, paid_at').not('asset_id', 'is', null),
  ])
  if (assetsRes.error) {
    const missing = /company_assets/.test(assetsRes.error.message)
    return NextResponse.json({ error: missing ? 'Falta rodar o SQL da migration 057 (patrimônio) no Supabase.' : assetsRes.error.message }, { status: 500 })
  }
  const byAsset = new Map<string, { total: number; paid: number; count: number; paidCount: number }>()
  for (const e of expRes.data ?? []) {
    const s = byAsset.get(e.asset_id) ?? { total: 0, paid: 0, count: 0, paidCount: 0 }
    s.total += Number(e.amount); s.count++
    if (e.paid_at) { s.paid += Number(e.amount); s.paidCount++ }
    byAsset.set(e.asset_id, s)
  }
  const assets = (assetsRes.data ?? []).map(a => ({ ...a, finance: byAsset.get(a.id) ?? { total: 0, paid: 0, count: 0, paidCount: 0 } }))
  const active = assets.filter(a => !INACTIVE_CONDITIONS.includes(a.condition))
  return NextResponse.json({
    assets,
    totals: {
      value: active.reduce((s, a) => s + Number(a.total_amount), 0),
      count: active.length,
      pendingInstallments: assets.reduce((s, a) => s + (a.finance.total - a.finance.paid), 0),
    },
  })
}

// POST → cadastra o bem e já lança no Financeiro como Reinvestimento (à vista ou as N parcelas)
export async function POST(request: Request) {
  if (!(await canAccessFinance('owl'))) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const parsed = parseAsset(await request.json().catch(() => ({})))
  if (typeof parsed === 'string') return NextResponse.json({ error: parsed }, { status: 400 })
  const { paid_upfront, ...row } = parsed
  void paid_upfront
  const db = createServiceClient()
  const { data, error } = await db.from('company_assets').insert(row).select().single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Erro ao salvar' }, { status: 500 })
  const expError = await createAssetExpenses(data.id, parsed)
  if (expError) {
    await db.from('company_assets').delete().eq('id', data.id)
    return NextResponse.json({ error: `Não consegui lançar no Financeiro: ${expError}` }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
