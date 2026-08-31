import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Times do Rio pra acompanhar — id de cada um em cada fonte (o mesmo time
// tem ids diferentes na ESPN e na TheSportsDB)
const TEAMS = [
  { label: 'Flamengo',      espnId: '819',  sdbId: '134287' },
  { label: 'Botafogo',      espnId: '6086', sdbId: '134285' },
  { label: 'Fluminense',    espnId: '3445', sdbId: '134296' },
  { label: 'Vasco da Gama', espnId: '3454', sdbId: '134282' },
]
const TARGET_CLIENT_NAMES = ['Stadium Steakhouse', 'Brasa Alta']
const HORIZON_DAYS = 14

interface Fixture {
  externalId: string // prefixado pela fonte, ex: "espn:123" ou "sdb:456"
  dateUtc: string
  timeKnown: boolean // false quando a fonte ainda não confirmou o horário
  home: string
  away: string
  venue?: string
  competition?: string
  source: 'ESPN' | 'TheSportsDB'
}

function checkAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

// Converte um timestamp UTC pra data/hora de Brasília (UTC-3, sem horário de verão)
function toBrasilia(dateUtc: string): { date: string; time: string } {
  const d = new Date(dateUtc)
  const br = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  return {
    date: br.toISOString().split('T')[0],
    time: br.toISOString().split('T')[1].slice(0, 5),
  }
}

// ESPN: sem chave, mas só tem as rodadas que a própria ESPN já catalogou —
// pode ficar sem os próximos jogos por um tempo até eles liberarem a rodada.
async function fetchEspnFixtures(teamId: string): Promise<Fixture[]> {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/teams/${teamId}/schedule`)
  if (!res.ok) throw new Error(`ESPN respondeu ${res.status}`)
  const data = await res.json()
  const events = Array.isArray(data.events) ? data.events : []
  const fixtures: Fixture[] = []
  for (const e of events) {
    const competitors = e.competitions?.[0]?.competitors ?? []
    const home = competitors.find((c: { homeAway: string }) => c.homeAway === 'home')?.team?.displayName
    const away = competitors.find((c: { homeAway: string }) => c.homeAway === 'away')?.team?.displayName
    if (!home || !away || !e.date) continue
    const timeKnown = e.timeValid !== false && e.competitions?.[0]?.timeValid !== false
    fixtures.push({
      externalId: `espn:${e.id}`,
      dateUtc: e.date,
      timeKnown,
      home,
      away,
      venue: e.competitions?.[0]?.venue?.fullName,
      competition: e.seasonType?.name?.trim(),
      source: 'ESPN',
    })
  }
  return fixtures
}

// TheSportsDB: base mais completa de jogos futuros, mas a chave gratuita
// compartilhada ("123") às vezes fica sobrecarregada/fora do ar.
async function fetchSdbFixtures(teamId: string): Promise<Fixture[]> {
  const res = await fetch(`https://www.thesportsdb.com/api/v1/json/123/eventsnext.php?id=${teamId}`, {
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`TheSportsDB respondeu ${res.status}`)
  const data = await res.json()
  const events = Array.isArray(data.events) ? data.events : []
  const fixtures: Fixture[] = []
  for (const e of events) {
    if (!e.strHomeTeam || !e.strAwayTeam || !e.dateEvent) continue
    // TheSportsDB usa 00:00:00 como placeholder quando o horário ainda não
    // foi confirmado — não é o horário real do jogo
    const timeKnown = !!e.strTime && e.strTime !== '00:00:00'
    fixtures.push({
      externalId: `sdb:${e.idEvent}`,
      dateUtc: `${e.dateEvent}T${timeKnown ? e.strTime : '12:00:00'}Z`,
      timeKnown,
      home: e.strHomeTeam,
      away: e.strAwayTeam,
      venue: e.strVenue || undefined,
      competition: e.strLeague || undefined,
      source: 'TheSportsDB',
    })
  }
  return fixtures
}

// Junta as duas fontes: se as duas trouxerem jogo no mesmo dia (mesmo time),
// é o mesmo jogo — fica só uma vez. Prioridade: quem tem horário confirmado
// vence; entre duas com o mesmo status de horário, prefere a ESPN (dado mais completo)
function mergeFixtures(espn: Fixture[], sdb: Fixture[]): Fixture[] {
  const byDay = new Map<string, Fixture>()
  for (const f of [...espn, ...sdb]) {
    const day = toBrasilia(f.dateUtc).date
    const existing = byDay.get(day)
    const betterTime = !existing || (f.timeKnown && !existing.timeKnown)
    const samePreferEspn = existing && f.timeKnown === existing.timeKnown && existing.source === 'TheSportsDB' && f.source === 'ESPN'
    if (betterTime || samePreferEspn) byDay.set(day, f)
  }
  return Array.from(byDay.values())
}

async function run() {
  const supabase = createServiceClient()

  const { data: clients } = await supabase.from('clients').select('id, name').in('name', TARGET_CLIENT_NAMES)
  if (!clients?.length) return NextResponse.json({ error: 'Nenhum dos clientes-alvo foi encontrado' }, { status: 404 })

  const today = new Date()
  const horizon = new Date(today.getTime() + HORIZON_DAYS * 86400000)

  let created = 0
  let updated = 0
  const sourceErrors: Record<string, string> = {}

  for (const team of TEAMS) {
    const [espnResult, sdbResult] = await Promise.allSettled([
      fetchEspnFixtures(team.espnId),
      fetchSdbFixtures(team.sdbId),
    ])

    if (espnResult.status === 'rejected') sourceErrors[`${team.label} (ESPN)`] = String(espnResult.reason?.message ?? espnResult.reason)
    if (sdbResult.status === 'rejected') sourceErrors[`${team.label} (TheSportsDB)`] = String(sdbResult.reason?.message ?? sdbResult.reason)

    const espnFixtures = espnResult.status === 'fulfilled' ? espnResult.value : []
    const sdbFixtures = sdbResult.status === 'fulfilled' ? sdbResult.value : []
    const merged = mergeFixtures(espnFixtures, sdbFixtures)

    const upcoming = merged.filter(f => {
      const d = new Date(f.dateUtc)
      return d >= today && d <= horizon
    })

    for (const fixture of upcoming) {
      const brasilia = toBrasilia(fixture.dateUtc)
      const scheduled_date = brasilia.date
      const scheduled_time = fixture.timeKnown ? brasilia.time : null
      const title = `Jogo: ${fixture.home} x ${fixture.away}`
      const notes = [`Sincronizado automaticamente via ${fixture.source}`, fixture.competition, fixture.venue].filter(Boolean).join(' — ')

      for (const client of clients) {
        const { data: existing } = await supabase
          .from('content_posts')
          .select('id')
          .eq('client_id', client.id)
          .eq('external_event_id', fixture.externalId)
          .maybeSingle()

        if (existing) {
          // Só corrige data/hora (ex: jogo adiado) — não mexe em título, legenda
          // ou status, caso a equipe já tenha avançado esse post no fluxo
          await supabase
            .from('content_posts')
            .update({ scheduled_date, scheduled_time, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
          updated++
        } else {
          await supabase.from('content_posts').insert({
            client_id: client.id,
            title,
            platform: 'instagram',
            status: 'rascunho',
            scheduled_date,
            scheduled_time,
            notes,
            media_urls: [],
            external_event_id: fixture.externalId,
          })
          created++
        }
      }
    }
  }

  return NextResponse.json({ created, updated, sourceErrors })
}

// Vercel Cron dispara via GET
export async function GET(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return run()
}

export async function POST(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return run()
}
