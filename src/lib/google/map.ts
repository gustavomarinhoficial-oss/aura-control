import { addDays, toMin, toTime } from '@/lib/booking/slots'
import type { GEvent } from './client'

// Tradução entre compromisso do Hub e evento do Google. Sem rede e sem banco.

export interface HubMeeting {
  id: string
  title: string
  type: 'reuniao' | 'captacao'
  meeting_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  meeting_link: string | null
  notes: string | null
  status: string
  google_event_id: string | null
  google_updated: string | null
  google_dirty: boolean
  google_changed_at: string
  client_name: string | null
  team: string | null
}

export interface Fields {
  title: string
  meeting_date: string
  start_time: string | null
  end_time: string | null
  location: string | null
  notes: string | null
}

const TZ = 'America/Sao_Paulo'
const MARK = '—— OWL Hub ——'
const CAPTACAO_COLOR = '3'
const hm = (t: string | null) => (t ? t.slice(0, 5) : null)

// Horário do Google (qualquer fuso) → dia e hora de Brasília (UTC-3 fixo)
function brTime(dateTime: string): { date: string; time: string } {
  const iso = new Date(new Date(dateTime).getTime() - 3 * 3600_000).toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

// O Google devolve a descrição em HTML quando alguém edita por lá
function cleanNotes(description: string | undefined): string | null {
  const text = (description ?? '')
    .replace(/<br\s*\/?>|<\/(p|div|li)>/gi, '\n').replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
  const at = text.indexOf(MARK)
  return (at >= 0 ? text.slice(0, at) : text).replace(/\r/g, '').trim() || null
}

// null = evento cancelado, recusado ou sem data: para o Hub, não existe
export function eventToFields(e: GEvent): Fields | null {
  if (e.status === 'cancelled' || !(e.start?.date || e.start?.dateTime)) return null
  if (e.attendees?.some(a => a.self && a.responseStatus === 'declined')) return null
  const base = { title: e.summary?.trim().slice(0, 200) || '(sem título)', location: e.location?.trim() || null, notes: cleanNotes(e.description) }
  if (e.start.date) return { ...base, meeting_date: e.start.date, start_time: null, end_time: null }
  const s = brTime(e.start.dateTime!)
  const f = e.end?.dateTime ? brTime(e.end.dateTime) : null
  // atravessa a meia-noite: o Hub não guarda término em outro dia
  return { ...base, meeting_date: s.date, start_time: s.time, end_time: f && f.date === s.date && f.time > s.time ? f.time : null }
}

// Sem término, o compromisso do Hub vale 1 hora
const endOf = (f: { start_time: string | null; end_time: string | null }) =>
  hm(f.end_time) ?? (f.start_time ? toTime(Math.min(toMin(f.start_time) + 60, 1439)) : null)

type When = Pick<Fields, 'meeting_date' | 'start_time' | 'end_time'>
const sameWhen = (a: When, b: When) => a.meeting_date === b.meeting_date && hm(a.start_time) === hm(b.start_time) && endOf(a) === endOf(b)

// Só o que mudou no Google em relação ao Hub
export function diffFields(m: HubMeeting, f: Fields): Partial<Fields> {
  const out: Partial<Fields> = {}
  if (f.title !== m.title.trim()) out.title = f.title
  if (!sameWhen(m, f)) { out.meeting_date = f.meeting_date; out.start_time = f.start_time; out.end_time = f.end_time }
  if (f.location !== (m.location?.trim() || null)) out.location = f.location
  if (f.notes !== (m.notes?.replace(/\r/g, '').trim() || null)) out.notes = f.notes
  return out
}

export const typeFromTitle = (title: string): 'reuniao' | 'captacao' => (/^\W*capta[çc][ãa]o/i.test(title) ? 'captacao' : 'reuniao')

// current = como o evento está no Google agora (data igual não é reenviada, pra não estragar evento de vários dias)
export function meetingToEvent(m: HubMeeting, current: GEvent | null): Record<string, unknown> {
  const footer = [
    [m.type === 'captacao' ? 'Captação' : 'Reunião', m.client_name && `Cliente: ${m.client_name}`, m.team && `Equipe: ${m.team}`].filter(Boolean).join(' · '),
    m.meeting_link && `Link: ${m.meeting_link}`,
  ].filter(Boolean).join('\n')
  const body: Record<string, unknown> = {
    summary: m.title, location: m.location ?? '',
    description: [m.notes?.trim(), `${MARK}\n${footer}`].filter(Boolean).join('\n\n'),
    extendedProperties: { private: { hubId: m.id } },
  }
  if (m.type === 'captacao') body.colorId = CAPTACAO_COLOR
  const now = current && eventToFields(current)
  if (!now || !sameWhen(m, now)) {
    if (m.start_time) {
      body.start = { dateTime: `${m.meeting_date}T${hm(m.start_time)}:00`, timeZone: TZ, date: null }
      body.end = { dateTime: `${m.meeting_date}T${endOf(m)}:00`, timeZone: TZ, date: null }
    } else {
      body.start = { date: m.meeting_date, dateTime: null, timeZone: null }
      body.end = { date: addDays(m.meeting_date, 1), dateTime: null, timeZone: null }
    }
  }
  return body
}

// Mesmo compromisso já anotado nos dois lados antes de ligar: mesmo dia, mesma hora e título parecido
const plain = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/captacao|reuniao/g, '').replace(/[^a-z0-9]/g, '')
export function looksSame(m: HubMeeting, f: Fields): boolean {
  if (m.meeting_date !== f.meeting_date || hm(m.start_time) !== hm(f.start_time)) return false
  const a = plain(m.title), b = plain(f.title)
  return a === b || (a.length > 3 && b.includes(a)) || (b.length > 3 && a.includes(b))
}
