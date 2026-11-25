import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { bookingRoute, loadBusy } from '@/lib/booking/server'

// GET /api/booking/busy?from&to&members=a,b — só os horários ocupados (sem título), para a prévia do link
export async function GET(request: Request) {
  return bookingRoute(async () => {
    const q = new URL(request.url).searchParams
    const [from, to] = [q.get('from') ?? '', q.get('to') ?? '']
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return NextResponse.json({ error: 'Período inválido' }, { status: 400 })
    return NextResponse.json(await loadBusy(createServiceClient(), (q.get('members') ?? '').split(',').filter(Boolean), from, to))
  })
}
