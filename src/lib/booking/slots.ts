// Regra dos horários do link de agendamento. Sem acesso a banco: usada no servidor
// (o que o cliente vê) e na tela do Hub (prévia), então as duas nunca divergem.

export type BookingMode = 'semanal' | 'escolhidos'
export type Weekly = Record<string, [string, string][]> // "0" domingo … "6" sábado

export interface BookingLink {
  id: string
  slug: string
  title: string
  client_id: string | null
  member_ids: string[]
  duration_min: number
  step_min: number
  buffer_min: number
  notice_hours: number
  mode: BookingMode
  weekly: Weekly
  slots: string[]
  start_date: string | null
  end_date: string | null
  window_days: number
  location: string | null
  message: string | null
  max_bookings: number | null
  active: boolean
}

export type SlotRules = Pick<BookingLink, 'duration_min' | 'step_min' | 'buffer_min' | 'notice_hours' | 'mode' | 'weekly' | 'slots' | 'start_date' | 'end_date' | 'window_days'>

export interface Busy { date: string; start: string | null; end: string | null }

// livre = aparece pro cliente; retirado = tirado/não escolhido pela equipe; ocupado = bate com a agenda; cedo = dentro da antecedência mínima
export type SlotState = 'livre' | 'retirado' | 'ocupado' | 'cedo'
export interface Slot { time: string; state: SlotState }
export interface DaySlots { date: string; slots: Slot[] }

// Padrão da OWL: captação de 3h, começando às 11h, 12h, 13h ou 14h; segunda e quarta só às 14h.
// Com 3h e sem folga, quem marca às 11h ainda deixa o das 14h livre.
export const DEFAULT_WEEKLY: Weekly = {
  1: [['14:00', '17:00']], 2: [['11:00', '17:00']], 3: [['14:00', '17:00']], 4: [['11:00', '17:00']], 5: [['11:00', '17:00']],
}
const DEFAULT_MEETING_MIN = 60 // compromisso sem término ocupa 1 hora (igual ao calendário)
const LAST_MINUTE = 23 * 60 + 59

export const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
export const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
export const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
export const slotKey = (date: string, time: string) => `${date} ${time}`

// Contas de data sempre em UTC: o resultado não depende do fuso do aparelho
export function addDays(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export const weekdayOf = (date: string) => new Date(date + 'T00:00:00Z').getUTCDay()

// Brasília não tem horário de verão: UTC-3 fixo
export const todayBR = (now = new Date()) => new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10)
const slotInstant = (date: string, time: string) => new Date(`${date}T${time}:00-03:00`).getTime()

// Período em que o link oferece horários
export function slotRange(r: Pick<SlotRules, 'start_date' | 'end_date' | 'window_days'>, now = new Date()): { from: string; to: string } {
  const today = todayBR(now)
  const from = r.start_date && r.start_date > today ? r.start_date : today
  const max = addDays(from, 90)
  const to = r.end_date ?? addDays(from, r.window_days)
  return { from, to: to > max ? max : to }
}

function isBusy(date: string, startMin: number, rules: Pick<SlotRules, 'duration_min' | 'buffer_min'>, busy: Busy[]): boolean {
  const end = startMin + rules.duration_min
  return busy.some(b => {
    if (b.date !== date) return false
    if (!b.start) return true // compromisso sem horário: segura o dia
    const bs = toMin(b.start)
    const be = b.end ? toMin(b.end) : bs + DEFAULT_MEETING_MIN
    return startMin < be + rules.buffer_min && end + rules.buffer_min > bs
  })
}

// Todos os horários do período com o estado de cada um (a tela do Hub mostra todos; o cliente, só os livres)
export function buildSlots(rules: SlotRules, busy: Busy[], now = new Date()): DaySlots[] {
  const { from, to } = slotRange(rules, now)
  const marked = new Set(rules.slots)
  const minInstant = now.getTime() + rules.notice_hours * 3600_000
  const out: DaySlots[] = []
  for (let date = from; date <= to; date = addDays(date, 1)) {
    const times = new Set<number>()
    for (const [a, b] of rules.weekly[String(weekdayOf(date))] ?? []) {
      for (let t = toMin(a); t + rules.duration_min <= toMin(b); t += rules.step_min) times.add(t)
    }
    // horários escolhidos a dedo valem mesmo se a grade da semana mudar depois
    if (rules.mode === 'escolhidos') {
      for (const s of rules.slots) if (s.startsWith(date + ' ')) times.add(toMin(s.slice(11)))
    }
    const slots = [...times].filter(t => t + rules.duration_min <= LAST_MINUTE).sort((x, y) => x - y).map((t): Slot => {
      const time = toTime(t)
      const has = marked.has(slotKey(date, time))
      const offered = rules.mode === 'escolhidos' ? has : !has
      const state: SlotState = slotInstant(date, time) < minInstant ? 'cedo'
        : isBusy(date, t, rules, busy) ? 'ocupado'
        : offered ? 'livre' : 'retirado'
      return { time, state }
    })
    if (slots.length) out.push({ date, slots })
  }
  return out
}

export function freeDays(rules: SlotRules, busy: Busy[], now = new Date()): { date: string; times: string[] }[] {
  return buildSlots(rules, busy, now)
    .map(d => ({ date: d.date, times: d.slots.filter(s => s.state === 'livre').map(s => s.time) }))
    .filter(d => d.times.length > 0)
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60), m = min % 60
  return h === 0 ? `${m} min` : m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

export function formatDateLong(date: string): string {
  const s = new Date(date + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return s[0].toUpperCase() + s.slice(1)
}
