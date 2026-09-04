import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { flattenAttendees } from '@/lib/utils/meetings'

const SELECT_WITH_ATTENDEES = '*, clients(id, name), leads(id, company_name), meeting_attendees(members(id, name, initials, color))'

function todayBR(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export async function GET(request: Request) {
  const supabase = createServiceClient()
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const onlyToday = searchParams.get('today') === 'true'

  let query = supabase
    .from('meetings')
    .select(SELECT_WITH_ATTENDEES)
    .order('meeting_date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false })

  if (clientId) query = query.eq('client_id', clientId)
  if (onlyToday) query = query.eq('meeting_date', todayBR())

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(flattenAttendees))
}

export async function POST(request: Request) {
  const supabase = createServiceClient()
  const body = await request.json()

  const insert: Record<string, unknown> = {
    title: body.title,
    client_id: body.client_id || null,
    lead_id: body.lead_id || null,
    meeting_date: body.meeting_date,
    start_time: body.start_time || null,
    location: body.location || null,
    notes: body.notes || null,
    status: body.status || 'agendada',
  }

  const { data: meeting, error } = await supabase.from('meetings').insert(insert).select('*, clients(id, name), leads(id, company_name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const attendeeIds: string[] = Array.isArray(body.attendee_ids) ? body.attendee_ids.filter(Boolean) : []
  if (attendeeIds.length > 0) {
    const { error: aErr } = await supabase
      .from('meeting_attendees')
      .insert(attendeeIds.map(member_id => ({ meeting_id: meeting.id, member_id })))
    if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })
  }

  const { data: full } = await supabase.from('meetings').select(SELECT_WITH_ATTENDEES).eq('id', meeting.id).single()
  return NextResponse.json(full ? flattenAttendees(full) : { ...meeting, attendees: [] }, { status: 201 })
}
