import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// Times do Rio pra acompanhar (ids no ESPN) e clientes que recebem o rascunho
const TEAMS: Record<string, string> = {
  '819':  'Flamengo',
  '6086': 'Botafogo',
  '3445': 'Fluminense',
  '3454': 'Vasco da Gama',
}
const TARGET_CLIENT_NAMES = ['Stadium Steakhouse', 'Brasa Alta']
const HORIZON_DAYS = 14

interface EspnEvent {
  id: string
  date: string
  competitions: {
    venue?: { fullName?: string }
    competitors: { homeAway: string; team: { displayName: string } }[]
  }[]
  seasonType?: { name?: string }
}

function checkAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

// Converte o timestamp UTC do ESPN pra data/hora de Brasília (UTC-3, sem horário de verão)
function toBrasilia(dateUtc: string): { date: string; time: string } {
  const d = new Date(dateUtc)
  const br = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  return {
    date: br.toISOString().split('T')[0],
    time: br.toISOString().split('T')[1].slice(0, 5),
  }
}

async function fetchTeamFixtures(teamId: string): Promise<EspnEvent[]> {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/teams/${teamId}/schedule`)
  if (!res.ok) throw new Error(`ESPN respondeu ${res.status} pro time ${teamId}`)
  const data = await res.json()
  return Array.isArray(data.events) ? data.events : []
}

async function run() {
  const supabase = createServiceClient()

  const { data: clients } = await supabase.from('clients').select('id, name').in('name', TARGET_CLIENT_NAMES)
  if (!clients?.length) return NextResponse.json({ error: 'Nenhum dos clientes-alvo foi encontrado' }, { status: 404 })

  const today = new Date()
  const horizon = new Date(today.getTime() + HORIZON_DAYS * 86400000)

  let created = 0
  let updated = 0
  const teamErrors: Record<string, string> = {}

  for (const [teamId, teamLabel] of Object.entries(TEAMS)) {
    let events: EspnEvent[]
    try {
      events = await fetchTeamFixtures(teamId)
    } catch (err) {
      teamErrors[teamLabel] = err instanceof Error ? err.message : 'erro desconhecido'
      continue
    }

    const upcoming = events.filter(e => {
      const d = new Date(e.date)
      return d >= today && d <= horizon
    })

    for (const event of upcoming) {
      const competitors = event.competitions?.[0]?.competitors ?? []
      const home = competitors.find(c => c.homeAway === 'home')?.team.displayName
      const away = competitors.find(c => c.homeAway === 'away')?.team.displayName
      if (!home || !away) continue

      const { date: scheduled_date, time: scheduled_time } = toBrasilia(event.date)
      const venue = event.competitions?.[0]?.venue?.fullName
      const competition = event.seasonType?.name?.trim()
      const title = `Jogo: ${home} x ${away}`
      const notes = [`Sincronizado automaticamente via ESPN`, competition, venue].filter(Boolean).join(' — ')

      for (const client of clients) {
        const { data: existing } = await supabase
          .from('content_posts')
          .select('id')
          .eq('client_id', client.id)
          .eq('external_event_id', event.id)
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
            external_event_id: event.id,
          })
          created++
        }
      }
    }
  }

  return NextResponse.json({ created, updated, teamErrors })
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
