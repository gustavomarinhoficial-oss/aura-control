import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

const SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

export async function GET() {
  const supabase = await createServiceClient()
  const { data, error } = await supabase.from('alert_settings').select('*').eq('id', SETTINGS_ID).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: Request) {
  const supabase = await createServiceClient()
  const body = await request.json()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const allowed = ['email_enabled','email_addresses','whatsapp_enabled','whatsapp_numbers','frequency_hours','days_ahead','time_start','time_end']
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const { data, error } = await supabase.from('alert_settings').update(update).eq('id', SETTINGS_ID).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
