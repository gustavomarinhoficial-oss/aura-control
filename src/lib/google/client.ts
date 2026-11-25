import { createSign } from 'crypto'

// Acesso à Google Agenda da empresa por conta de serviço (chave só no servidor).
// GOOGLE_SERVICE_ACCOUNT = JSON da chave; GOOGLE_CALENDAR_ID = e-mail/ID da agenda compartilhada com ela.

export interface GEvent {
  id: string
  status?: string
  summary?: string
  location?: string
  description?: string
  updated?: string
  hangoutLink?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
  attendees?: { self?: boolean; responseStatus?: string }[]
  extendedProperties?: { private?: Record<string, string> }
}

export class GoogleError extends Error {
  status: number
  reason: string
  constructor(status: number, message: string, reason = '') {
    super(message)
    this.status = status
    this.reason = reason
  }
}

export const calendarId = () => process.env.GOOGLE_CALENDAR_ID?.trim() ?? ''
export const googleConfigured = () => !!process.env.GOOGLE_SERVICE_ACCOUNT && !!calendarId()

const BAD_KEY = 'A chave do Google colada na Vercel está incompleta (GOOGLE_SERVICE_ACCOUNT).'
const b64 = (v: string) => Buffer.from(v).toString('base64url')
let cached: { token: string; until: number } | null = null

async function accessToken(): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token
  let key: { client_email?: string; private_key?: string }
  try { key = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT!) } catch { throw new GoogleError(0, BAD_KEY) }
  if (!key.client_email || !key.private_key) throw new GoogleError(0, BAD_KEY)

  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(JSON.stringify({
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/calendar.events', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))}`
  const jwt = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url')}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', cache: 'no-store',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
    signal: AbortSignal.timeout(10_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new GoogleError(401, 'O Google recusou a chave de acesso. Gere uma nova chave e troque na Vercel.')
  cached = { token: data.access_token, until: Date.now() + 50 * 60_000 }
  return cached.token
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId())}/events${path}`, {
    method, cache: 'no-store',
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (res.ok) return data as T
  const msg: string = data?.error?.message ?? `erro ${res.status}`
  const reason: string = data?.error?.errors?.[0]?.reason ?? ''
  if (res.status === 401) cached = null
  throw new GoogleError(res.status,
    /has not been used|is disabled/i.test(msg) ? 'A Google Calendar API ainda não está ativada no projeto do Google.'
      : reason === 'requiredAccessLevel' ? 'O Hub só consegue ler a agenda. No Google, dê a permissão "Fazer alterações em eventos".'
        : msg, reason)
}

// chave, permissão ou limite: não adianta insistir nos outros eventos agora
export const isFatal = (e: unknown) => e instanceof GoogleError && (e.status === 0 || e.status === 401 || e.status === 429 || /requiredAccessLevel|rateLimit|quota/i.test(e.reason))
// evento de outra pessoa (a empresa é só convidada): o Google não deixa alterar
export const isNotOurs = (e: unknown) => e instanceof GoogleError && e.status === 403 && /organizer/i.test(e.reason + e.message)
export const isGone = (e: unknown) => e instanceof GoogleError && (e.status === 404 || e.status === 410)

// Eventos de um período, com os que se repetem já separados um a um
export async function listEvents(timeMin: string, timeMax: string): Promise<GEvent[]> {
  const out: GEvent[] = []
  let pageToken = ''
  do {
    const q = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', maxResults: '2500', eventTypes: 'default', ...(pageToken && { pageToken }) })
    let page: { items?: GEvent[]; nextPageToken?: string }
    try {
      page = await call('GET', `?${q}`)
    } catch (e) {
      if (isGone(e)) throw new GoogleError(403, 'A agenda não está compartilhada com o Hub (ou o e-mail da agenda está errado).')
      throw e
    }
    out.push(...(page.items ?? []))
    pageToken = page.nextPageToken ?? ''
  } while (pageToken)
  return out
}

export async function getEvent(id: string): Promise<GEvent | null> {
  try { return await call<GEvent>('GET', `/${encodeURIComponent(id)}`) } catch (e) { if (isGone(e)) return null; throw e }
}
export const insertEvent = (body: unknown) => call<GEvent>('POST', '', body)
export const patchEvent = (id: string, body: unknown) => call<GEvent>('PATCH', `/${encodeURIComponent(id)}`, body)
export async function deleteEvent(id: string): Promise<void> {
  try { await call('DELETE', `/${encodeURIComponent(id)}`) } catch (e) { if (!isGone(e)) throw e }
}
