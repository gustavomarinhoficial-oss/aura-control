import { NextResponse } from 'next/server'
import Groq, { toFile } from 'groq-sdk'
import { createServiceClient } from '@/lib/supabase/server'
import { matchByName, resolveDate, type DateSpec } from '@/lib/meetings/voiceParse'
import { leadOptionValue } from '@/lib/utils/entitySelect'

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

  // 1) Voz → texto
  let transcript = ''
  try {
    const ext = audio.type.includes('mp4') ? 'm4a' : audio.type.includes('ogg') ? 'ogg' : 'webm'
    const file = await toFile(Buffer.from(await audio.arrayBuffer()), `ditado.${ext}`, { type: audio.type || 'audio/webm' })
    const hint = `Criar tarefa para ${clients[0]?.name ?? 'o cliente'}, prazo sexta-feira. Clientes: ${clients.map(c => c.name).join(', ')}. Equipe: ${members.map(m => m.name).join(', ')}.`.slice(0, 600)
    const res = await groq.audio.transcriptions.create({ file, model: STT_MODEL, language: 'pt', temperature: 0, prompt: hint, response_format: 'json' })
    transcript = (res.text ?? '').trim()
  } catch (err) {
    return NextResponse.json({ error: `Não consegui transcrever o áudio${err instanceof Error ? `: ${err.message}` : '.'}` }, { status: 502 })
  }
  if (!transcript) return NextResponse.json({ error: 'Não consegui ouvir nada. Fale mais perto do microfone e tente de novo.' }, { status: 422 })

  // 2) Texto → tarefa (o código resolve data, cliente e responsáveis)
  const { date: today, weekday } = brToday()
  const system = `Você transforma a fala de uma pessoa em uma tarefa interna de uma agência de marketing. Hoje é ${weekday}, ${today}. Responda APENAS um JSON, sem texto fora dele, com estes campos (null quando a pessoa não disse):
{"title": string, "description": string|null, "who": string|null, "all_clients": boolean, "assignees": string[], "priority": "baixa"|"media"|"alta", "date": {"kind": "hoje"|"amanha"|"depois_de_amanha"|"weekday"|"day_of_month"|"iso", "weekday": string|null, "day": number|null, "month": number|null, "iso": "YYYY-MM-DD"|null} | null}
Regras:
(1) "title": a ação em poucas palavras, no infinitivo, sem empresa nem prazo (ex.: "Criar relatório mensal", "Revisar artes do feed"). Obrigatório.
(2) "description": detalhes extras que a pessoa falou além do título (o que fazer, referências, observações), em frases claras. null se não houver. Não repita o título.
(3) "who": a empresa/cliente/lead da tarefa, escrito do jeito que foi falado (ex.: "Imove", "Stadium"). null se não citou. "all_clients" = true só se disse que é para todos os clientes.
(4) "assignees": nomes de pessoas da equipe responsáveis (${members.map(m => m.name).join(', ') || 'nenhuma cadastrada'}); "eu"/"comigo"/"pra mim" = ${me || 'a pessoa que está falando'}.
(5) "priority": "alta" se disse urgente/importante/prioridade; "baixa" se disse sem pressa/quando der; senão "media".
(6) "date" é o PRAZO. NÃO calcule datas: "sexta" => {"kind":"weekday","weekday":"sexta"}; "amanhã" => {"kind":"amanha"}; "dia 15" => {"kind":"day_of_month","day":15}; data completa => kind "iso". Se a pessoa NÃO falou prazo, date = null (a tarefa fica fixa, sem prazo). Nunca invente prazo.`

  let raw: Record<string, unknown> = {}
  try {
    const completion = await groq.chat.completions.create({
      model: PARSE_MODEL,
      temperature: 0,
      max_tokens: 2000,
      reasoning_effort: 'low',
      messages: [{ role: 'system', content: system }, { role: 'user', content: transcript }],
    })
    const text = completion.choices[0]?.message?.content ?? ''
    const json = text.match(/\{[\s\S]*\}/)?.[0]
    raw = json ? JSON.parse(json) : {}
  } catch {
    // sem interpretação: devolve só a transcrição como descrição
  }

  const who = str(raw.who)
  const client = raw.all_clients === true ? null : matchByName(clients, c => c.name, who, [transcript])
  const lead = raw.all_clients === true || client ? null : matchByName(leads, l => l.company_name, who)

  const assigneeIds = new Set<string>()
  const names = Array.isArray(raw.assignees) ? (raw.assignees as unknown[]).filter((x): x is string => typeof x === 'string') : []
  for (const n of names) {
    const m = matchByName(members, x => x.name, n)
    if (m) assigneeIds.add(m.id)
  }

  const priority = raw.priority === 'alta' || raw.priority === 'baixa' ? raw.priority : 'media'

  return NextResponse.json({
    transcript,
    draft: {
      title: str(raw.title) ?? transcript.slice(0, 80),
      description: str(raw.description),
      client_select: raw.all_clients === true ? 'todos' : client ? client.id : lead ? leadOptionValue(lead.id) : '',
      assignee_ids: [...assigneeIds],
      priority,
      due_date: resolveDate(raw.date as DateSpec | null, today),
    },
  })
}
