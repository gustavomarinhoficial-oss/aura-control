import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'
import { sendPushToMembers } from '@/lib/push/send'
import { isUuid } from '@/lib/ads/server'
import { isTime, slotRange, toMin, todayBR, formatDateLong, type BookingLink, type Busy, type Weekly } from './slots'

type DB = ReturnType<typeof createServiceClient>
export type LinkWithClient = BookingLink & { clients: { name: string } | null }

export const LINK_COLS = '*'

export class BookingError extends Error {}

// Embrulho das rotas internas: erro de validação vira 400 e tabela que falta vira mensagem clara
export async function bookingRoute(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: 400 })
    const msg = e instanceof Error ? e.message : 'Erro interno'
    const missing = /booking_link/.test(msg) && /does not exist|schema cache/.test(msg)
    return NextResponse.json({ error: missing ? 'Falta rodar o SQL do agendamento no Supabase (migrations 060 a 062).' : msg }, { status: 500 })
  }
}

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v + 'T00:00:00Z'))

function int(v: unknown, label: string, min: number, max: number): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) throw new BookingError(`${label} inválido.`)
  return n
}

function parseWeekly(v: unknown): Weekly {
  const out: Weekly = {}
  for (const [day, ranges] of Object.entries((v ?? {}) as Record<string, unknown>)) {
    if (!/^[0-6]$/.test(day) || !Array.isArray(ranges) || ranges.length === 0) continue
    out[day] = ranges.slice(0, 4).map((r): [string, string] => {
      const [a, b] = Array.isArray(r) ? r : []
      if (!isTime(a) || !isTime(b) || toMin(b) <= toMin(a)) throw new BookingError('Confira os horários da semana: o fim precisa ser depois do início.')
      return [a, b]
    })
  }
  return out
}

// Valida o que veio da tela. partial = edição (só os campos enviados)
export function parseLink(b: Record<string, unknown>, partial = false): Record<string, unknown> {
  const u: Record<string, unknown> = {}
  const has = (k: string) => !partial || k in b
  const text = (k: string, max: number) => (typeof b[k] === 'string' && (b[k] as string).trim() ? (b[k] as string).trim().slice(0, max) : null)

  if (has('title')) u.title = text('title', 120) ?? 'Captação'
  if (has('client_id')) {
    if (b.client_id && !isUuid(b.client_id)) throw new BookingError('Cliente inválido.')
    u.client_id = b.client_id || null
  }
  if (has('member_ids')) {
    const ids = Array.isArray(b.member_ids) ? b.member_ids.filter(isUuid) : []
    if (ids.length === 0) throw new BookingError('Escolha quem da equipe vai na captação.')
    u.member_ids = ids
  }
  if (has('duration_min')) u.duration_min = int(b.duration_min, 'Duração', 15, 720)
  if (has('step_min')) u.step_min = int(b.step_min, 'Intervalo entre horários', 15, 240)
  if (has('buffer_min')) u.buffer_min = int(b.buffer_min, 'Folga', 0, 240)
  if (has('notice_hours')) u.notice_hours = int(b.notice_hours, 'Antecedência', 0, 720)
  if (has('window_days')) u.window_days = int(b.window_days, 'Período', 1, 90)
  if (has('mode')) u.mode = b.mode === 'escolhidos' ? 'escolhidos' : 'semanal'
  if (has('weekly')) u.weekly = parseWeekly(b.weekly)
  if (has('slots')) {
    u.slots = (Array.isArray(b.slots) ? b.slots : [])
      .filter((s): s is string => typeof s === 'string' && isDate(s.slice(0, 10)) && s[10] === ' ' && isTime(s.slice(11)))
      .filter(s => s.slice(0, 10) >= todayBR()) // o que já passou não precisa ficar guardado
      .slice(0, 2000)
  }
  for (const k of ['start_date', 'end_date'] as const) {
    if (!has(k)) continue
    if (b[k] && !isDate(b[k])) throw new BookingError('Data inválida.')
    u[k] = b[k] || null
  }
  if (u.start_date && u.end_date && (u.end_date as string) < (u.start_date as string)) throw new BookingError('A data final precisa ser depois da inicial.')
  if (has('location')) u.location = text('location', 300)
  if (has('message')) u.message = text('message', 600)
  if (has('max_bookings')) u.max_bookings = b.max_bookings == null ? null : int(b.max_bookings, 'Limite de marcações', 1, 100)
  if (has('min_people')) u.min_people = int(b.min_people ?? 2, 'Pessoas livres', 1, 10)
  if (partial && 'active' in b) u.active = b.active === true
  return u
}

// O que ocupa a agenda da OWL (FDMC não bloqueia): toda captação, e as reuniões de quem vai ou sem participante
export async function loadBusy(db: DB, memberIds: string[], from: string, to: string): Promise<Busy[]> {
  const { data, error } = await db.from('meetings')
    .select('meeting_date, start_time, end_time, type, meeting_attendees(member_id)')
    .eq('workspace', 'owl')
    .gte('meeting_date', from).lte('meeting_date', to)
    .neq('status', 'cancelada')
    .limit(1000)
  if (error) throw new Error(error.message)
  return (data ?? [])
    .map(m => ({
      date: m.meeting_date as string, start: (m.start_time?.slice(0, 5) ?? null) as string | null, end: (m.end_time?.slice(0, 5) ?? null) as string | null,
      type: (m.type === 'captacao' ? 'captacao' : 'reuniao') as Busy['type'],
      members: ((m.meeting_attendees as { member_id: string }[] | null) ?? []).map(a => a.member_id),
    }))
    .filter(b => b.type === 'captacao' || b.members.length === 0 || b.members.some(id => memberIds.includes(id)))
}

export function linkBusy(db: DB, link: BookingLink): Promise<Busy[]> {
  const { from, to } = slotRange(link)
  return loadBusy(db, link.member_ids, from, to)
}

export async function loadLink(db: DB, slug: string): Promise<LinkWithClient | null> {
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) return null
  const { data } = await db.from('booking_links').select(`${LINK_COLS}, clients(name)`).eq('slug', slug).maybeSingle()
  return data as unknown as LinkWithClient | null
}

export interface Booked { id: string; title: string; meeting_date: string; start_time: string | null; end_time: string | null; location: string | null }

export async function linkBookings(db: DB, linkId: string): Promise<Booked[]> {
  const { data } = await db.from('meetings')
    .select('id, title, meeting_date, start_time, end_time, location')
    .eq('booking_link_id', linkId).neq('status', 'cancelada').order('meeting_date').order('start_time')
  return (data ?? []) as Booked[]
}

// Mesma conta do banco (book_capture_slot): com limite conta tudo; sem limite, até 40 futuras
export function isFull(link: Pick<BookingLink, 'max_bookings'>, booked: Booked[]): boolean {
  if (link.max_bookings !== null) return booked.length >= link.max_bookings
  return booked.filter(b => b.meeting_date >= todayBR()).length >= 40
}

const ALERT_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

// Avisa a equipe: push em quem vai + e-mail dos alertas. Nunca derruba a marcação.
export async function notifyBooking(link: BookingLink, b: { meetingId: string; who: string; date: string; time: string; end: string; location: string | null; notes: string | null }) {
  const when = `${formatDateLong(b.date)}, ${b.time} às ${b.end}`
  const email = async () => {
    if (!process.env.RESEND_API_KEY) return
    const { data: s } = await createServiceClient().from('alert_settings').select('email_enabled, email_addresses').eq('id', ALERT_SETTINGS_ID).single()
    if (!s?.email_enabled || !s.email_addresses?.length) return
    const esc = (t: string) => t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!))
    const line = (label: string, v: string | null) => v ? `<p style="margin:6px 0;font-size:14px;white-space:pre-wrap;"><strong>${label}:</strong> ${esc(v)}</p>` : ''
    await new Resend(process.env.RESEND_API_KEY).emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'alertas@aura.com.br',
      to: s.email_addresses,
      subject: `📅 ${b.who} marcou captação: ${when}`,
      html: `<div style="font-family:Inter,sans-serif;background:#111;color:#f0f0f0;padding:24px;border-radius:12px;max-width:600px;">
        <h2 style="color:#8b5cf6;margin-bottom:12px;">Captação marcada pelo cliente</h2>
        ${line('Cliente', b.who)}${line('Quando', when)}${line('Local', b.location)}${line('Detalhes', b.notes)}
        <p style="margin-top:24px;font-size:12px;color:#666;">Já está em Reuniões e Captações no OWL Hub</p>
      </div>`,
    })
  }
  await Promise.allSettled([
    sendPushToMembers(link.member_ids, {
      title: `Captação marcada: ${b.who}`, body: [when, b.location].filter(Boolean).join(' · '),
      url: `/reunioes?meeting=${b.meetingId}`, tag: `booking-${b.meetingId}`,
    }),
    email(),
  ])
}
