import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { canAccessFinance } from '@/lib/finance/access'
import { parseAsset, createAssetExpenses } from '@/lib/finance/assets'

const FINANCIAL = ['total_amount', 'payment_method', 'installments', 'first_installment_date', 'purchase_date'] as const

// PATCH → edita o bem. Mudou valor/forma de pagamento: refaz os lançamentos, desde que nenhuma parcela já tenha sido paga.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canAccessFinance('owl'))) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const { id } = await params
  const db = createServiceClient()
  const { data: current } = await db.from('company_assets').select('*').eq('id', id).maybeSingle()
  if (!current) return NextResponse.json({ error: 'Bem não encontrado' }, { status: 404 })

  const parsed = parseAsset({ ...current, ...(await request.json().catch(() => ({}))) })
  if (typeof parsed === 'string') return NextResponse.json({ error: parsed }, { status: 400 })
  const { paid_upfront, ...row } = parsed
  void paid_upfront

  const norm = (v: unknown) => (v === null || v === undefined ? null : String(v))
  const financialChanged = FINANCIAL.some(k => norm(row[k]) !== norm(current[k] === null ? null : k === 'total_amount' ? Number(current[k]) : current[k]))
  const cardChanged = norm(row.card) !== norm(current.card)
  const nameChanged = row.name !== current.name

  if (financialChanged) {
    const { data: paid } = await db.from('expenses').select('id').eq('asset_id', id).not('paid_at', 'is', null).limit(1)
    if (paid?.length) {
      return NextResponse.json({ error: 'Já tem parcela paga deste bem: o valor e a forma de pagamento não podem mais mudar por aqui. Ajuste as parcelas no Financeiro.' }, { status: 409 })
    }
  }

  const { data, error } = await db.from('company_assets').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (financialChanged) {
    await db.from('expenses').delete().eq('asset_id', id)
    const expError = await createAssetExpenses(id, parsed)
    if (expError) return NextResponse.json({ error: `Bem salvo, mas não consegui refazer os lançamentos: ${expError}` }, { status: 500 })
  } else if (cardChanged || nameChanged) {
    // só nome/cartão: atualiza a descrição e a observação dos lançamentos ainda não pagos
    const notes = [row.card ? `Cartão: ${row.card}` : null, 'Patrimônio'].filter(Boolean).join(' · ')
    await db.from('expenses').update({ description: row.name, notes }).eq('asset_id', id).is('paid_at', null)
  }
  return NextResponse.json(data)
}

// DELETE → tira o bem. Parcelas ainda não pagas saem do Financeiro; as pagas ficam (histórico do que saiu do caixa).
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await canAccessFinance('owl'))) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const { id } = await params
  const db = createServiceClient()
  await db.from('expenses').delete().eq('asset_id', id).is('paid_at', null)
  const { error } = await db.from('company_assets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
