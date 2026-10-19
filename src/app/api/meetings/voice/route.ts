import { NextResponse } from 'next/server'
import Groq, { toFile } from 'groq-sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { buildTitle, fixTimes, matchByName, resolveDate, type DateSpec } from '@/lib/meetings/voiceParse'

export const maxDuration = 45

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const STT_MODEL = 'whisper-large-v3'
const PARSE_MODEL = 'openai/gpt-oss-120b'

function brToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, weekday: get('weekday') }
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

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

  // 1) Voz → texto (Whisper, português). Nomes de clientes e da equipe entram como dica de vocabulário.
  let transcript = ''
  try {
    const ext = audio.type.includes('mp4') ? 'm4a' : audio.type.includes('ogg') ? 'ogg' : 'webm'
    const file = await toFile(Buffer.from(await audio.arrayBuffer()), `ditado.${ext}`, { type: audio.type || 'audio/webm' })
    const hint = `Marque uma reunião na terça-feira com ${clients[0]?.name ?? 'o cliente'}, de 10h a meio-dia. Captação, reunião, OWL. Clientes: ${clients.map(c => c.name).join(', ')}. Equipe: ${members.map(m => m.name).join(', ')}.`.slice(0, 600)
    const res = await groq.audio.transcriptions.create({ file, model: STT_MODEL, language: 'pt', temperature: 0, prompt: hint, response_format: 'json' })
    transcript = (res.text ?? '').trim()
  } catch (err) {
    return NextResponse.json({ error: `Não consegui transcrever o áudio${err instanceof Error ? `: ${err.message}` : '.'}` }, { status: 502 })
  }
  if (!transcript) return NextResponse.json({ error: 'Não consegui ouvir nada. Fale mais perto do microfone e tente de novo.' }, { status: 422 })

  // 2) Texto → o que foi dito (quem resolve data, horário, cliente e título é o código)
  const { date: today, weekday } = brToday()
  const system = `Você extrai de uma frase falada os dados de um compromisso de agenda de uma agência de marketing. Hoje é ${weekday}, ${today}. Responda APENAS um JSON, sem texto fora dele, com estes campos (null quando a pessoa não disse):
{"kind": "reuniao" | "captacao", "who": string|null, "subject": string|null, "date": {"kind": "hoje"|"amanha"|"depois_de_amanha"|"weekday"|"day_of_month"|"iso", "weekday": string|null, "day": number|null, "month": number|null, "iso": "YYYY-MM-DD"|null} | null, "start_time": "HH:MM"|null, "end_time": "HH:MM"|null, "location": string|null, "meeting_link": string|null, "attendees": string[], "notes": string|null}
Regras:
(1) "kind": captacao para captação/gravação/filmagem/sessão de fotos; o resto é reuniao.
(2) "who": o cliente, lead ou pessoa com quem é o compromisso, escrito do jeito que foi falado (ex.: "Imove", "Stadium", "Aaron"). Sem artigo e sem a palavra "reunião". Não invente.
(3) "subject": só o ASSUNTO se a pessoa disse um explicitamente (ex.: "alinhamento mensal", "apresentação da proposta"). Se disse apenas "reunião com X", subject = null.
(4) "date": NÃO calcule datas. "terça-feira"/"na terça"/"sexta que vem" => {"kind":"weekday","weekday":"terça"}; "amanhã" => {"kind":"amanha"}; "dia 15" => {"kind":"day_of_month","day":15}; "dia 15 de novembro" => day 15, month 11; data completa dita => kind "iso".
(5) Horários em 24h: "10h" = 10:00, "meio-dia" = 12:00, "meia-noite" = 00:00, "duas da tarde" = 14:00, "de 10h a meio-dia" = start 10:00 e end 12:00. Se só disse o início, end_time = null.
(6) "attendees": nomes de pessoas da equipe (${members.map(m => m.name).join(', ') || 'nenhuma cadastrada'}); "eu", "comigo" = ${me || 'a pessoa que está falando'}.
(7) "notes": só pauta ou detalhes extras ditos. "location"/"meeting_link" só se ditos.`

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
    // sem interpretação: devolve só a transcrição pro formulário
  }

  const type: 'reuniao' | 'captacao' = raw.kind === 'captacao' ? 'captacao' : 'reuniao'
  const who = str(raw.who)

  // Cliente (ou lead) pelo nome, inclusive quando o Whisper escreveu diferente ("Imove" → iMoowe)
  const client = matchByName(clients, c => c.name, who, [transcript])
  const lead = client ? null : matchByName(leads, l => l.company_name, who)
  const whoName = client?.name ?? lead?.company_name ?? who

  const attendeeIds = new Set<string>()
  const names = Array.isArray(raw.attendees) ? (raw.attendees as unknown[]).filter((x): x is string => typeof x === 'string') : []
  for (const n of names) {
    const m = matchByName(members, x => x.name, n)
    if (m) attendeeIds.add(m.id)
  }

  const { start, end } = fixTimes(raw.start_time, raw.end_time)
  const date = resolveDate(raw.date as DateSpec | null, today)

  return NextResponse.json({
    transcript,
    draft: {
      title: buildTitle({ type, whoName, subject: str(raw.subject), fallback: transcript.slice(0, 80) }),
      type,
      client_id: client?.id ?? null,
      lead_id: lead?.id ?? null,
      meeting_date: date,
      start_time: start,
      end_time: end,
      location: str(raw.location),
      meeting_link: str(raw.meeting_link),
      attendee_ids: [...attendeeIds],
      notes: str(raw.notes),
    },
  })
}
