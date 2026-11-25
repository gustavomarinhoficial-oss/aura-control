import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { isFull, linkBookings, linkBusy, loadLink, notifyBooking } from '@/lib/booking/server'
import { freeDays, isTime, toMin, toTime, todayBR } from '@/lib/booking/slots'

type Ctx = { params: Promise<{ slug: string }> }

// O que o cliente vê: só horários livres. Nada da agenda (títulos, outros clientes, quem vai) sai daqui.
export async function GET(_: Request, { params }: Ctx) {
  const { slug } = await params
  const db = createServiceClient()
  const link = await loadLink(db, slug)
  if (!link) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })

  const booked = await linkBookings(db, link.id)
  const status = !link.active ? 'pausado' : isFull(link, booked) ? 'cheio' : 'aberto'
  return NextResponse.json({
    title: link.title,
    client: link.clients,
    duration_min: link.duration_min,
    location: link.location,
    message: link.message,
    status,
    days: status === 'aberto' ? freeDays(link, await linkBusy(db, link)) : [],
    // Link de um cliente só: ele revê o que já marcou. Link aberto nunca mostra marcação de outra pessoa.
    booked: link.client_id
      ? booked.filter(b => b.meeting_date >= todayBR()).map(b => ({ date: b.meeting_date, start: b.start_time?.slice(0, 5) ?? null, end: b.end_time?.slice(0, 5) ?? null, location: b.location }))
      : [],
  })
}

// POST { date, time, name, phone?, company?, location?, notes? } — marca a captação na agenda
export async function POST(request: Request, { params }: Ctx) {
  const { slug } = await params
  const body = await request.json().catch(() => ({}))
  const text = (k: string, max: number): string => (typeof body?.[k] === 'string' ? body[k].trim().slice(0, max) : '')
  const bad = (error: string, status = 400, code?: string) => NextResponse.json({ error, code }, { status })
  const taken = () => bad('Esse horário acabou de ser ocupado. Escolha outro, por favor.', 409, 'SLOT_TAKEN')
  const closed = () => bad('Este link não aceita mais marcações. Fale com a equipe OWL.', 409, 'CLOSED')

  const db = createServiceClient()
  const link = await loadLink(db, slug)
  if (!link) return bad('Link inválido', 404)
  if (!link.active) return closed()

  const date = text('date', 10), time = text('time', 5)
  const name = text('name', 120), phone = text('phone', 40), company = text('company', 120)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isTime(time)) return bad('Escolha o dia e o horário.')
  if (!name) return bad('Informe seu nome.')
  if (!link.client_id && (!company || !phone)) return bad('Informe a empresa e o WhatsApp.')
  const location = link.location ?? text('location', 300)
  if (!location) return bad('Informe o local da captação.')

  const free = freeDays(link, await linkBusy(db, link))
  if (!free.find(d => d.date === date)?.times.includes(time)) return taken()

  const who = link.clients?.name ?? company
  const notes = [`Marcado pelo link por ${name}${phone ? ` (${phone})` : ''}`, text('notes', 1000)].filter(Boolean).join('\n')
  const { data: meetingId, error } = await db.rpc('book_capture_slot', {
    p_link: link.id, p_date: date, p_start: toMin(time), p_title: `${link.title} - ${who}`, p_location: location, p_notes: notes,
  })
  if (error) {
    if (error.message.includes('SLOT_TAKEN')) return taken()
    if (/LINK_(FULL|CLOSED)/.test(error.message)) return closed()
    console.error('book_capture_slot', error.message)
    return bad('Não foi possível marcar agora. Tente de novo.', 500)
  }

  const end = toTime(toMin(time) + link.duration_min)
  // a Vercel pode congelar a função depois da resposta: espera os avisos antes
  await notifyBooking(link, { meetingId, who, date, time, end, location, notes })
  return NextResponse.json({ date, start: time, end, location }, { status: 201 })
}
