import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getRole, canAccessFdmc } from '@/lib/roles'

// FDMC Hub é privado (só Gustavo e Gabriel) — o proxy já bloqueia /api/fdmc/*
// pra outros papéis, mas checa de novo aqui direto no dado sensível.
async function requireFdmcAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const role = getRole(user.user_metadata)
  if (!canAccessFdmc(role)) return null
  return user
}

export async function GET() {
  if (!(await requireFdmcAccess())) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('fdmc_entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  if (!(await requireFdmcAccess())) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const supabase = createServiceClient()
  const body = await request.json()

  if (!body.description || !body.amount || !body.entry_date || !['receita', 'despesa'].includes(body.type)) {
    return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('fdmc_entries')
    .insert({
      type: body.type,
      description: body.description,
      amount: Number(body.amount),
      entry_date: body.entry_date,
      notes: body.notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
