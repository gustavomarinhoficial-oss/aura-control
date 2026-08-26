import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase.from('cash_settings').select('*').eq('id', SETTINGS_ID).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? { id: SETTINGS_ID, reserve_target: 0 })
}

export async function PATCH(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  const { data, error } = await supabase
    .from('cash_settings')
    .update({ reserve_target: Number(body.reserve_target) || 0, updated_at: new Date().toISOString() })
    .eq('id', SETTINGS_ID)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
