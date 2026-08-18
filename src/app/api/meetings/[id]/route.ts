import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { flattenAttendees } from '@/lib/utils/meetings'

const SELECT_WITH_ATTENDEES = '*, clients(id, name), meeting_attendees(members(id, name, initials, color))'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const body = await request.json()

  const update: Record<string, unknown> = {}
  if (body.title !== undefined) update.title = body.title
  if (body.client_id !== undefined) update.client_id = body.client_id || null
  if (body.meeting_date !== undefined) update.meeting_date = body.meeting_date
  if (body.start_time !== undefined) update.start_time = body.start_time || null
  if (body.location !== undefined) update.location = body.location || null
  if (body.notes !== undefined) update.notes = body.notes || null
  if (body.status !== undefined) update.status = body.status

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from('meetings').update(update).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (body.attendee_ids !== undefined) {
    const attendeeIds: string[] = Array.isArray(body.attendee_ids) ? body.attendee_ids.filter(Boolean) : []
    const { error: delErr } = await supabase.from('meeting_attendees').delete().eq('meeting_id', id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    if (attendeeIds.length > 0) {
      const { error: insErr } = await supabase
        .from('meeting_attendees')
        .insert(attendeeIds.map(member_id => ({ meeting_id: id, member_id })))
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  const { data, error } = await supabase.from('meetings').select(SELECT_WITH_ATTENDEES).eq('id', id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(flattenAttendees(data))
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('meetings').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
