import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { googleConfigured } from '@/lib/google/client'
import { syncGoogle } from '@/lib/google/sync'

export const maxDuration = 60

// Situação da ligação com o Google Agenda
export async function GET() {
  if (!googleConfigured()) return NextResponse.json({ configured: false })
  const { data } = await createServiceClient().from('google_sync').select('last_ok_at, last_error').eq('id', 1).maybeSingle()
  return NextResponse.json({ configured: true, last_ok_at: data?.last_ok_at ?? null, last_error: data?.last_error ?? null })
}

// Sincronizar agora
export async function POST() {
  await syncGoogle()
  return GET()
}
