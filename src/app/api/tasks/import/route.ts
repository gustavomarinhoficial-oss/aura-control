import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'

// Normalize column names to known keys
function normalizeHeader(h: string): string {
  const s = h.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
  if (['tarefa', 'task', 'titulo', 'title', 'nome', 'name'].includes(s)) return 'title'
  if (['responsavel', 'responsavel', 'assignee', 'pessoa', 'membro', 'member'].includes(s)) return 'assignee'
  if (['prazo', 'due_date', 'data', 'vencimento', 'deadline', 'entrega'].includes(s)) return 'due_date'
  if (['prioridade', 'priority'].includes(s)) return 'priority'
  if (['cliente', 'client', 'conta'].includes(s)) return 'client'
  if (['descricao', 'description', 'detalhes', 'details', 'obs'].includes(s)) return 'description'
  return s
}

function normalizePriority(v: string): string {
  const s = (v ?? '').toLowerCase().normalize('NFD').replace(/[Ì€-Í¯]/g, '').trim()
  if (['alta', 'high', 'a', 'urgente', 'urgent'].includes(s)) return 'alta'
  if (['baixa', 'low', 'b'].includes(s)) return 'baixa'
  return 'media'
}

function parseDate(v: unknown): string | null {
  if (!v) return null
  // Excel serial number
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
  }
  const s = String(v).trim()
  // ISO format: 2026-08-20
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // BR format: 20/08/2026
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  // BR short: 20/08/26
  const brShort = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
  if (brShort) return `20${brShort[3]}-${brShort[2].padStart(2, '0')}-${brShort[1].padStart(2, '0')}`
  return null
}

function matchMember(name: string, members: { id: string; name: string }[]): string | null {
  if (!name) return null
  const n = name.toLowerCase().normalize('NFD').replace(/[Ì€-Í¯]/g, '').trim()
  const exact = members.find(m => m.name.toLowerCase().normalize('NFD').replace(/[Ì€-Í¯]/g, '') === n)
  if (exact) return exact.id
  const partial = members.find(m => m.name.toLowerCase().normalize('NFD').replace(/[Ì€-Í¯]/g, '').startsWith(n) || n.startsWith(m.name.toLowerCase().normalize('NFD').replace(/[Ì€-Í¯]/g, '')))
  return partial?.id ?? null
}

function matchClient(name: string, clients: { id: string; name: string }[]): string | null {
  if (!name) return null
  const n = name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
  const found = clients.find(c => c.name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').includes(n) || n.includes(c.name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')))
  return found?.id ?? null
}

export async function POST(request: Request) {
  const supabase = createServiceClient()

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Arquivo nÃ£o enviado' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

  if (!rows.length) return NextResponse.json({ error: 'Arquivo vazio' }, { status: 400 })

  // Normalize headers
  const normalized = rows.map(row => {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(row)) out[normalizeHeader(k)] = v
    return out
  })

  // Load members and clients
  const [{ data: members }, { data: clients }] = await Promise.all([
    supabase.from('members').select('id, name'),
    supabase.from('clients').select('id, name'),
  ])

  const created: string[] = []
  const skipped: string[] = []

  for (const row of normalized) {
    const title = String(row.title ?? '').trim()
    if (!title) { skipped.push('(linha sem tÃ­tulo)'); continue }

    const assignee_id = matchMember(String(row.assignee ?? ''), members ?? [])
    const client_id = matchClient(String(row.client ?? ''), clients ?? [])
    const due_date = parseDate(row.due_date)
    const priority = normalizePriority(String(row.priority ?? ''))
    const description = String(row.description ?? '').trim() || null

    const { error } = await supabase.from('tasks').insert({
      title, description, priority, due_date,
      assignee_id, client_id, status: 'pendente',
    })

    if (error) skipped.push(title)
    else created.push(title)
  }

  return NextResponse.json({ created: created.length, skipped: skipped.length, tasks: created })
}
