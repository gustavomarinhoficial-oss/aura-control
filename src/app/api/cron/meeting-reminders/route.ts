import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendPushToMembers } from '@/lib/push/send'

// Roda a cada minuto (agendador do Supabase). Só envia o que está no horário e nunca repete:
// cada lembrete é registrado em meeting_reminders_sent antes de ser enviado.
// Não precisa de segredo: o endpoint só dispara avisos que já estavam devidos.
export const maxDuration = 30

function brNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

interface MeetingRow {
  id: string
  title: string
  type: string
  start_time: string
  location: string | null
  meeting_link: string | null
  clients: { name: string } | null
  leads: { company_name: string } | null
  meeting_attendees: { member_id: string }[] | null
}

async function run() {
  const db = createServiceClient()
  const { date, minutes: nowMin } = brNow()

  const { data } = await db
    .from('meetings')
    .select('id, title, type, start_time, location, meeting_link, clients(name), leads(company_name), meeting_attendees(member_id)')
    .eq('meeting_date', date)
    .not('start_time', 'is', null)
    .neq('status', 'cancelada')
  const meetings = (data ?? []) as unknown as MeetingRow[]

  const result: { meeting: string; kind: string; sent: number }[] = []

  for (const m of meetings) {
    const [h, min] = String(m.start_time).split(':').map(Number)
    const diff = h * 60 + min - nowMin // minutos até começar (negativo = já começou)

    // 30 min antes, 10 min antes e na hora (com folga de 10 min caso o minuto exato falhe).
    let kind: '30' | '10' | '0' | null = null
    if (diff <= 30 && diff > 10) kind = '30'
    else if (diff <= 10 && diff > 0) kind = '10'
    else if (diff <= 0 && diff > -10) kind = '0'
    if (!kind) continue

    const memberIds = (m.meeting_attendees ?? []).map(a => a.member_id)
    if (memberIds.length === 0) continue

    const key = `${m.id}|${date}|${String(m.start_time).slice(0, 5)}|${kind}`
    // Reserva o lembrete primeiro: se já existia, outro disparo já cuidou dele.
    const { data: claimed } = await db
      .from('meeting_reminders_sent')
      .upsert({ reminder_key: key, meeting_id: m.id }, { onConflict: 'reminder_key', ignoreDuplicates: true })
      .select('reminder_key')
    if (!claimed || claimed.length === 0) continue

    const label = m.type === 'captacao' ? 'Captação' : 'Reunião'
    const time = String(m.start_time).slice(0, 5)
    const who = m.clients?.name ?? m.leads?.company_name ?? ''
    const title = kind === '0' ? `${label} agora` : `${label} em ${Math.max(diff, 1)} min`
    const body = [m.title, time, who, m.location].filter(Boolean).join(' · ')
    // Na hora, se for online, o toque já abre o link da reunião.
    const url = kind === '0' && m.meeting_link ? m.meeting_link : `/reunioes?meeting=${m.id}`

    const { sent } = await sendPushToMembers(memberIds, { title, body, url, tag: key })
    result.push({ meeting: m.title, kind, sent })
  }

  return { date, nowMin, reminders: result }
}

export async function GET() {
  return NextResponse.json(await run())
}

export async function POST() {
  return NextResponse.json(await run())
}
