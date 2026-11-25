import { createServiceClient } from '@/lib/supabase/server'
import { addDays, todayBR } from '@/lib/booking/slots'
import { calendarId, deleteEvent, getEvent, googleConfigured, insertEvent, isFatal, isGone, isNotOurs, listEvents, patchEvent, type GEvent } from './client'
import { diffFields, eventToFields, looksSame, meetingToEvent, typeFromTitle, type HubMeeting } from './map'

type DB = ReturnType<typeof createServiceClient>
const WINDOW_DAYS = 90        // quanto do Google entra no Hub
const LOCK_MS = 60_000
const PUSH_BUDGET_MS = 35_000 // o que não couber vai no minuto seguinte

export interface SyncResult { skipped?: string; pulled?: number; pushed?: number; error?: string }

// Roda a cada minuto e logo depois de cada mudança no Hub. Nunca derruba quem chamou.
export async function syncGoogle(db: DB = createServiceClient()): Promise<SyncResult> {
  if (!googleConfigured()) return { skipped: 'sem configuração' }
  const now = new Date().toISOString()
  // uma sincronização por vez
  const { data: lock, error: lockErr } = await db.from('google_sync')
    .update({ locked_until: new Date(Date.now() + LOCK_MS).toISOString(), last_run_at: now })
    .eq('id', 1).or(`locked_until.is.null,locked_until.lt.${now}`).select('calendar_id')
  if (lockErr) return { skipped: 'falta o SQL 062' }
  if (!lock?.length) return { skipped: 'já está rodando' }

  let result: SyncResult
  try {
    // trocou de agenda: as ligações antigas não valem mais (sem isso, tudo pareceria apagado no Google)
    if (lock[0].calendar_id !== calendarId()) {
      ok(await db.from('meetings').update({ google_event_id: null, google_updated: null, google_dirty: false }).not('google_event_id', 'is', null))
      ok(await db.from('google_deletions').delete().neq('event_id', ''))
      ok(await db.from('google_sync').update({ calendar_id: calendarId() }).eq('id', 1))
    }
    result = await run(db)
  } catch (e) {
    result = { error: e instanceof Error ? e.message : 'Erro na sincronização' }
  }
  if (result.error) console.error('google-agenda', result.error)
  await db.from('google_sync').update({
    locked_until: null, last_error: result.error?.slice(0, 300) ?? null, ...(!result.error && { last_ok_at: new Date().toISOString() }),
  }).eq('id', 1)
  return result
}

function ok<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

async function run(db: DB): Promise<SyncResult> {
  const started = Date.now()
  const today = todayBR()
  const until = addDays(today, WINDOW_DAYS)

  const events = new Map((await listEvents(`${today}T00:00:00-03:00`, `${until}T00:00:00-03:00`)).map(e => [e.id, e]))
  const rows = ok(await db.from('google_meetings').select('*').gte('meeting_date', today).order('meeting_date').limit(1000)) as HubMeeting[]
  // passados que ainda têm algo pra mandar, e os que o Google trouxe de volta pra frente
  rows.push(...ok(await db.from('google_meetings').select('*').lt('meeting_date', today).eq('google_dirty', true).not('google_event_id', 'is', null).limit(200)) as HubMeeting[])
  const known = new Set(rows.map(r => r.google_event_id))
  const stray = [...events.keys()].filter(id => !known.has(id))
  for (let i = 0; i < stray.length; i += 50) {
    rows.push(...ok(await db.from('google_meetings').select('*').in('google_event_id', stray.slice(i, i + 50))) as HubMeeting[])
  }
  const deleting = new Set((ok(await db.from('google_deletions').select('event_id')) ?? []).map(d => d.event_id as string))

  const byEvent = new Map(rows.filter(r => r.google_event_id).map(r => [r.google_event_id!, r]))
  const byId = new Map(rows.map(r => [r.id, r]))
  let pulled = 0

  // Apagado no Google: no Hub fica como cancelada, com o histórico
  const cancel = async (m: HubMeeting) => {
    const status = m.status === 'agendada' ? 'cancelada' : m.status
    ok(await db.from('meetings').update({ status, google_event_id: null, google_updated: null, google_dirty: false }).eq('id', m.id))
    Object.assign(m, { status, google_event_id: null, google_dirty: false })
    pulled++
  }

  const pull = async (m: HubMeeting, e: GEvent) => {
    if (e.updated === m.google_updated || m.status === 'cancelada') return
    if (m.google_dirty && Date.parse(m.google_changed_at) > Date.parse(e.updated ?? '')) return // o Hub mudou depois: vale o do Hub
    const f = eventToFields(e)
    if (!f) return cancel(m)
    const patch: Record<string, unknown> = diffFields(m, f)
    if (Object.keys(patch).length) pulled++
    if (e.hangoutLink && !m.meeting_link) patch.meeting_link = e.hangoutLink
    // só grava se ninguém mexeu no Hub nesse meio tempo (senão fica pro próximo minuto)
    const saved = ok(await db.from('meetings').update({ ...patch, google_updated: e.updated ?? null })
      .eq('id', m.id).eq('google_changed_at', m.google_changed_at).select('id'))
    if (saved?.length) Object.assign(m, patch, { google_updated: e.updated ?? null })
    else m.google_dirty = false // mudou agora: não manda a versão velha
  }

  // Google → Hub
  for (const e of events.values()) {
    if (deleting.has(e.id)) continue
    const linked = byEvent.get(e.id)
    if (linked) { await pull(linked, e); continue }
    const f = eventToFields(e)
    if (!f || f.meeting_date < today) continue
    // já existe no Hub e só falta ligar
    const own = byId.get(e.extendedProperties?.private?.hubId ?? '')
    const twin = own && !own.google_event_id && own.status !== 'cancelada' ? own
      : rows.find(r => !r.google_event_id && r.status === 'agendada' && looksSame(r, f))
    if (twin) {
      const link = {
        ...(!twin.location && f.location && { location: f.location }), ...(!twin.notes && f.notes && { notes: f.notes }),
        ...(!twin.meeting_link && e.hangoutLink && { meeting_link: e.hangoutLink }),
        google_event_id: e.id, google_updated: e.updated ?? null, google_dirty: true,
      }
      ok(await db.from('meetings').update(link).eq('id', twin.id))
      Object.assign(twin, link)
      byEvent.set(e.id, twin)
    } else {
      ok(await db.from('meetings').insert({
        ...f, type: typeFromTitle(f.title), meeting_link: e.hangoutLink ?? null, status: 'agendada', workspace: 'owl',
        google_event_id: e.id, google_updated: e.updated ?? null,
      }))
    }
    pulled++
  }

  // Ligado, dentro do período, mas sumiu da lista: apagaram ou mudaram pra fora do período
  for (const m of byEvent.values()) {
    if (!m.google_event_id || events.has(m.google_event_id) || m.status === 'cancelada' || m.meeting_date < today || m.meeting_date >= until) continue
    const e = await getEvent(m.google_event_id)
    if (e && eventToFields(e)) await pull(m, e)
    else await cancel(m)
  }

  // Hub → Google
  let pushed = 0
  let firstError = ''
  const attempt = async (fn: () => Promise<void>): Promise<void> => {
    if (Date.now() - started > PUSH_BUDGET_MS) return
    try { await fn(); pushed++ } catch (e) {
      if (isFatal(e)) throw e
      firstError ||= e instanceof Error ? e.message : 'erro'
    }
  }

  for (const id of deleting) await attempt(async () => {
    await deleteEvent(id)
    ok(await db.from('google_deletions').delete().eq('event_id', id))
  })

  for (const m of byId.values()) {
    const eventId = m.google_event_id
    if (m.status === 'cancelada') {
      if (eventId) await attempt(async () => {
        await deleteEvent(eventId)
        ok(await db.from('meetings').update({ google_event_id: null, google_updated: null, google_dirty: false }).eq('id', m.id))
      })
    } else if (eventId ? m.google_dirty : m.status === 'agendada' && m.meeting_date >= today) {
      await attempt(async () => {
        let e: GEvent
        try {
          e = eventId
            ? await patchEvent(eventId, meetingToEvent(m, events.get(eventId) ?? await getEvent(eventId)))
            : await insertEvent(meetingToEvent(m, null))
        } catch (err) {
          if (eventId && isGone(err)) return cancel(m)
          if (isNotOurs(err)) { ok(await db.from('meetings').update({ google_dirty: false }).eq('id', m.id)); return }
          throw err
        }
        if (e.status === 'cancelled') return cancel(m)
        ok(await db.from('meetings').update({ google_event_id: e.id, google_updated: e.updated ?? null }).eq('id', m.id))
        ok(await db.from('meetings').update({ google_dirty: false }).eq('id', m.id).eq('google_changed_at', m.google_changed_at))
      })
    }
  }

  return { pulled, pushed, ...(firstError && { error: `Um compromisso não foi para o Google: ${firstError}` }) }
}
