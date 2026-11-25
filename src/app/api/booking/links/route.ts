import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { BookingError, LINK_COLS, bookingRoute, parseLink, type Booked } from '@/lib/booking/server'
import { randomSuffix, slugify } from '@/lib/shareSlug'

// Links de agendamento, cada um com o cliente e as captações já marcadas por ele
export async function GET() {
  return bookingRoute(async () => {
    const db = createServiceClient()
    const { data, error } = await db.from('booking_links').select(`${LINK_COLS}, clients(id, name, logo_url)`).order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    const { data: meetings } = await db.from('meetings')
      .select('id, title, meeting_date, start_time, end_time, location, booking_link_id')
      .not('booking_link_id', 'is', null).neq('status', 'cancelada').order('meeting_date').order('start_time')
    const booked = (meetings ?? []) as (Booked & { booking_link_id: string })[]
    return NextResponse.json((data as unknown as { id: string }[]).map(l => ({ ...l, bookings: booked.filter(b => b.booking_link_id === l.id) })))
  })
}

export async function POST(request: Request) {
  return bookingRoute(async () => {
    const db = createServiceClient()
    const insert = parseLink(await request.json().catch(() => ({})))
    let base = 'captacao'
    if (insert.client_id) {
      const { data: c } = await db.from('clients').select('name').eq('id', insert.client_id).maybeSingle()
      if (!c) throw new BookingError('Cliente não encontrado.')
      base = slugify(c.name) || base
    }
    insert.slug = `${base}-${randomSuffix(6)}`
    const { data, error } = await db.from('booking_links').insert(insert).select(LINK_COLS).single()
    if (error) throw new Error(error.message)
    return NextResponse.json(data, { status: 201 })
  })
}
