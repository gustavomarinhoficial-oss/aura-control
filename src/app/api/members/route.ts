import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServiceClient()
  const { data, error } = await supabase.from('members').select('*').order('name')
  if (error) return NextResponse.json([]) // tabela pode não existir ainda
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createServiceClient()
  const body = await request.json()
  const { data, error } = await supabase
    .from('members')
    .insert({ name: body.name, initials: body.initials, color: body.color ?? '#7c3aed' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
