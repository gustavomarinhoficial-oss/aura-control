import { NextResponse } from 'next/server'
import { syncGoogle } from '@/lib/google/sync'

// Roda a cada minuto (agendador do Supabase). Não precisa de segredo: só confere os dois lados,
// uma vez por vez, e não devolve nada da agenda.
export const maxDuration = 60

async function run() {
  const { skipped, error } = await syncGoogle()
  return NextResponse.json({ ok: !error, skipped })
}

export async function GET() { return run() }
export async function POST() { return run() }
