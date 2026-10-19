import { NextResponse } from 'next/server'
import Groq, { toFile } from 'groq-sdk'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 45

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const STT_MODEL = 'whisper-large-v3'
const PARSE_MODEL = 'openai/gpt-oss-120b'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

// Acha o item da lista que o usuário citou (ignora acento/maiúscula; aceita nome parcial).
function matchByName<T extends { id: string }>(list: T[], getName: (x: T) => string, said: string | null | undefined): T | null {
  if (!said) return null
  const q = norm(said)
  if (!q) return null
  const scored = list
    .map(x => {
      const n = norm(getName(x))
      if (n === q) return { x, score: 3 }
      if (n.includes(q) || q.includes(n)) return { x, score: 2 }
      const words = q.split(' ').filter(w => w.length > 2)
      return { x, score: words.length && words.every(w => n.includes(w)) ? 1 : 0 }
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
  return scored[0]?.x ?? null
}

function brToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, weekday: get('weekday') }
}

const validTime = (t: unknown): string | null => (typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null)

// POST multipart { audio, me? } → { transcript, draft }
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null)
  const audio = form?.get('audio')
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: 'Áudio não recebido.' }, { status: 400 })
  if (audio.size > 24 * 1024 * 1024) return NextResponse.json({ error: 'Áudio muito longo.' }, { status: 400 })
  if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: 'Transcrição não configurada.' }, { status: 500 })
  const me = String(form?.get('me') ?? '')

  const db = createServiceClient()
  const [clientsRes, leadsRes, membersRes] = await Promise.all([
    db.from('clients').select('id, name').eq('status', 'ativo'),
    db.from('leads').select('id, company_name'),
    db.from('members').select('id, name'),
  ])
  const clients = clientsRes.data ?? []
  const leads = leadsRes.data ?? []
  const members = membersRes.data ?? []

  // 1) Voz → texto (Whisper, português). Os nomes dos clientes entram como dica de vocabulário.
  let transcript = ''
  try {
    const ext = audio.type.includes('mp4') ? 'm4a' : audio.type.includes('ogg') ? 'ogg' : 'webm'
    const file = await toFile(Buffer.from(await audio.arrayBuffer()), `ditado.${ext}`, { type: audio.type || 'audio/webm' })
    const hint = `Marcar reunião ou captação. Clientes: ${clients.map(c => c.name).join(', ')}. Equipe: ${members.map(m => m.name).join(', ')}.`.slice(0, 600)
    const res = await groq.audio.transcriptions.create({ file, model: STT_MODEL, language: 'pt', temperature: 0, prompt: hint, response_format: 'json' })
    transcript = (res.text ?? '').trim()
  } catch (err) {
    return NextResponse.json({ error: `Não consegui transcrever o áudio${err instanceof Error ? `: ${err.message}` : '.'}` }, { status: 502 })
  }
  if (!transcript) return NextResponse.json({ error: 'Não consegui ouvir nada. Fale mais perto do microfone e tente de novo.' }, { status: 422 })

  // 2) Texto → campos do compromisso
  const { date: today, weekday } = brToday()
  const system = `Você transforma a fala de uma pessoa em um compromisso de agenda de uma agência de marketing. Hoje é ${weekday}, ${today} (fuso de Brasília). Responda APENAS um JSON, sem texto fora dele, com estes campos (use null quando a pessoa não disse):
{"title": string, "type": "reuniao" | "captacao", "client": string|null, "lead": string|null, "date": "YYYY-MM-DD"|null, "start_time": "HH:MM"|null, "end_time": "HH:MM"|null, "location": string|null, "meeting_link": string|null, "attendees": string[], "notes": string|null}
Regras: (1) "captação"/"gravação"/"filmagem"/"sessão de fotos" = captacao; o resto = reuniao. (2) Resolva datas relativas ("amanhã", "sexta que vem", "dia 15") a partir de hoje. (3) Horários em 24h: "meio-dia" = 12:00, "duas da tarde" = 14:00, "de meio-dia até as 3" = start 12:00 e end 15:00 (sem "da manhã" explícito, interprete o fim como depois do início). (4) Se só disse o início, end_time = null. (5) "client" deve ser um destes clientes (ou null): ${clients.map(c => c.name).join(' | ') || '(nenhum)'}. "lead" é o nome de uma empresa em prospecção, se não for cliente. (6) "attendees" são nomes de pessoas da equipe: ${members.map(m => m.name).join(', ') || '(nenhum)'}; "eu", "comigo", "eu vou" = ${me || 'a pessoa que está falando'}. (7) "title" curto e claro, sem repetir data/hora (ex.: "Alinhamento mensal", "Captação de fotos"). (8) Coloque em "notes" só pauta ou detalhes extras ditos.`

  let raw: Record<string, unknown> = {}
  try {
    const completion = await groq.chat.completions.create({
      model: PARSE_MODEL,
      temperature: 0,
      max_tokens: 500,
      messages: [{ role: 'system', content: system }, { role: 'user', content: transcript }],
    })
    const text = completion.choices[0]?.message?.content ?? ''
    const json = text.match(/\{[\s\S]*\}/)?.[0]
    raw = json ? JSON.parse(json) : {}
  } catch {
    // sem interpretação: devolve só a transcrição e o título cru
  }

  const client = matchByName(clients, c => c.name, typeof raw.client === 'string' ? raw.client : null)
  const lead = client ? null : matchByName(leads, l => l.company_name, typeof raw.lead === 'string' ? raw.lead : null)
  const names = Array.isArray(raw.attendees) ? (raw.attendees as unknown[]).filter((x): x is string => typeof x === 'string') : []
  const attendeeIds = new Set<string>()
  for (const n of names) {
    const m = matchByName(members, x => x.name, n)
    if (m) attendeeIds.add(m.id)
  }
  const start = validTime(raw.start_time)
  let end = validTime(raw.end_time)
  if (start && end && end <= start) end = null

  const date = typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : null

  return NextResponse.json({
    transcript,
    draft: {
      title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : transcript.slice(0, 80),
      type: raw.type === 'captacao' ? 'captacao' : 'reuniao',
      client_id: client?.id ?? null,
      lead_id: lead?.id ?? null,
      meeting_date: date,
      start_time: start,
      end_time: end,
      location: typeof raw.location === 'string' ? raw.location : null,
      meeting_link: typeof raw.meeting_link === 'string' ? raw.meeting_link : null,
      attendee_ids: [...attendeeIds],
      notes: typeof raw.notes === 'string' ? raw.notes : null,
    },
  })
}
