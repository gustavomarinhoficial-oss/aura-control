import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Times do Rio pra acompanhar
const TEAM_NAMES = ['Flamengo', 'Botafogo', 'Fluminense', 'Vasco da Gama']
// id de cada um na TheSportsDB (usada como fonte auxiliar, por time)
const SDB_TEAM_IDS: Record<string, string> = {
  'Flamengo':      '134287',
  'Botafogo':      '134285',
  'Fluminense':    '134296',
  'Vasco da Gama': '134282',
}
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

function espnDateStr(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

// Ligas cobertas na ESPN: Brasileirão (nacional) + Libertadores e
// Sul-Americana (continentais — é onde jogos como Fluminense x Platense ou
// Independiente del Valle x Flamengo aparecem; o placar só do bra.1 não
// pega essas fases de mata-mata internacional).
const ESPN_LEAGUES = ['bra.1', 'conmebol.libertadores', 'conmebol.sudamericana']

// ESPN: sem chave. Usa o placar da liga inteira num intervalo de datas (mais
// completo e atualizado do que o calendário por time, que fica desatualizado
// até a rodada ser oficialmente liberada) e filtra só os jogos dos 4 times.
// Busca cada competição em paralelo — se uma falhar (ex: fora do ar), as
// outras continuam valendo em vez de derrubar o sync inteiro.
async function fetchEspnFixtures(from: Date, to: Date): Promise<{ fixtures: Fixture[]; errors: string[] }> {
  const dateRange = `${espnDateStr(from)}-${espnDateStr(to)}`
  const results = await Promise.allSettled(
    ESPN_LEAGUES.map(async league => {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${dateRange}`)
      if (!res.ok) throw new Error(`${league} respondeu ${res.status}`)
      return res.json()
    })
  )

  const fixtures: Fixture[] = []
  const errors: string[] = []

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      errors.push(`${ESPN_LEAGUES[i]}: ${String(r.reason?.message ?? r.reason)}`)
      return
    }
    const events = Array.isArray(r.value.events) ? r.value.events : []
    for (const e of events) {
      const competitors = e.competitions?.[0]?.competitors ?? []
      const home = competitors.find((c: { homeAway: string }) => c.homeAway === 'home')?.team?.displayName
      const away = competitors.find((c: { homeAway: string }) => c.homeAway === 'away')?.team?.displayName
      if (!home || !away || !e.date) continue
      if (!TEAM_NAMES.includes(home) && !TEAM_NAMES.includes(away)) continue
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
  })

  return { fixtures, errors }
}

// TheSportsDB: fonte auxiliar, por time — a chave gratuita compartilhada
// ("123") às vezes fica sobrecarregada/fora do ar.
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

// Junta as duas fontes por confronto (mesmos dois times). Quando o horário
// não está confirmado, a data que a fonte informa pode estar até um dia
// errada em relação ao fuso de Brasília — por isso agrupa por proximidade
// de data (jogos a até 3 dias um do outro pro mesmo confronto são quase
// certamente o mesmo jogo, só reportado com datas ligeiramente diferentes
// pelas duas fontes), não por dia exato. Times que se enfrentam de novo
// bem depois (ida e volta de mata-mata, por exemplo) continuam separados.
// Dentro de cada grupo, prioriza quem tem horário confirmado, e empatado
// nisso, prefere a ESPN (dado mais completo).
function mergeFixtures(fixtures: Fixture[]): Fixture[] {
  const byPair = new Map<string, Fixture[]>()
  for (const f of fixtures) {
    const pair = [f.home, f.away].sort().join('|')
    if (!byPair.has(pair)) byPair.set(pair, [])
    byPair.get(pair)!.push(f)
  }

  const CLUSTER_WINDOW_MS = 3 * 86400000
  const result: Fixture[] = []

  for (const group of byPair.values()) {
    const sorted = [...group].sort((a, b) => new Date(a.dateUtc).getTime() - new Date(b.dateUtc).getTime())
    const clusters: Fixture[][] = []
    for (const f of sorted) {
      const last = clusters[clusters.length - 1]
      if (last && new Date(f.dateUtc).getTime() - new Date(last[0].dateUtc).getTime() <= CLUSTER_WINDOW_MS) {
        last.push(f)
      } else {
        clusters.push([f])
      }
    }
    for (const cluster of clusters) {
      const best = cluster.reduce((a, b) => {
        if (a.timeKnown !== b.timeKnown) return a.timeKnown ? a : b
        if (a.source !== b.source) return a.source === 'ESPN' ? a : b
        return a
      })
      result.push(best)
    }
  }
  return result
}

async function run() {
  const supabase = createServiceClient()

  const { data: clients } = await supabase.from('clients').select('id, name').in('name', TARGET_CLIENT_NAMES)
  if (!clients?.length) return NextResponse.json({ error: 'Nenhum dos clientes-alvo foi encontrado' }, { status: 404 })

  const today = new Date()
  const horizon = new Date(today.getTime() + HORIZON_DAYS * 86400000)

  const sourceErrors: Record<string, string> = {}
  const allFixtures: Fixture[] = []

  const [espnResult, ...sdbResults] = await Promise.allSettled([
    fetchEspnFixtures(today, horizon),
    ...TEAM_NAMES.map(name => fetchSdbFixtures(SDB_TEAM_IDS[name])),
  ])

  if (espnResult.status === 'fulfilled') {
    allFixtures.push(...espnResult.value.fixtures)
    if (espnResult.value.errors.length) sourceErrors['ESPN'] = espnResult.value.errors.join(' | ')
  } else {
    sourceErrors['ESPN'] = String(espnResult.reason?.message ?? espnResult.reason)
  }

  sdbResults.forEach((r, i) => {
    const teamName = TEAM_NAMES[i]
    if (r.status === 'fulfilled') allFixtures.push(...r.value)
    else sourceErrors[`${teamName} (TheSportsDB)`] = String(r.reason?.message ?? r.reason)
  })

  const merged = mergeFixtures(allFixtures)
  const upcoming = merged.filter(f => {
    const d = new Date(f.dateUtc)
    return d >= today && d <= horizon
  })

  let created = 0
  let updated = 0

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
