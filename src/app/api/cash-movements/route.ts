import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const ALLOWED_TYPES = ['aporte', 'retirada', 'distribuicao_socio', 'reinvestimento', 'ajuste']

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('cash_movements')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  if (!body.type || !ALLOWED_TYPES.includes(body.type)) {
    return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
  }
  if (typeof body.amount !== 'number' || body.amount === 0) {
    return NextResponse.json({ error: 'Valor é obrigatório' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('cash_movements')
    .insert({
      date: body.date || new Date().toISOString().split('T')[0],
      type: body.type,
      amount: body.amount,
      note: body.note || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aporte na reserva = dinheiro aplicado: entra no Financeiro como "Aplicação / aporte" (já paga),
  // ligada ao movimento (apagar o movimento apaga a aplicação).
  if (data.type === 'aporte' && Number(data.amount) > 0) {
    const { error: expError } = await supabase.from('expenses').insert({
      description: data.note ? `Aporte na reserva — ${data.note}` : 'Aporte na reserva',
      amount: Number(data.amount),
      category: 'aplicacao',
      due_date: data.date,
      paid_at: data.date,
      recurrent: false,
      cash_movement_id: data.id,
    })
    if (expError) {
      await supabase.from('cash_movements').delete().eq('id', data.id)
      return NextResponse.json({ error: `Não consegui ligar o aporte ao Financeiro: ${expError.message}` }, { status: 500 })
    }
  }
  return NextResponse.json(data, { status: 201 })
}
