import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { LINK_COLS, bookingRoute, parseLink } from '@/lib/booking/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return bookingRoute(async () => {
    const update = { ...parseLink(await request.json().catch(() => ({})), true), updated_at: new Date().toISOString() }
    const { data, error } = await createServiceClient().from('booking_links').update(update).eq('id', id).select(LINK_COLS).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 })
    return NextResponse.json(data)
  })
}

// As captações já marcadas continuam na agenda; só o link deixa de existir
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return bookingRoute(async () => {
    const { error } = await createServiceClient().from('booking_links').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  })
}
