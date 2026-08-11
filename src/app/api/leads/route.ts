import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()
  const { data, error } = await supabase.from('leads').insert({
    company_name: body.company_name,
    contact_name: body.contact_name || null,
    contact_phone: body.contact_phone || null,
    contact_email: body.contact_email || null,
    instagram: body.instagram || null,
    origem: body.origem || null,
    responsavel: body.responsavel || null,
    estimated_value: body.estimated_value ? Number(body.estimated_value) : null,
    stage: body.stage || 'novo_lead',
    notes: body.notes || null,
    last_contact_at: body.last_contact_at || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
