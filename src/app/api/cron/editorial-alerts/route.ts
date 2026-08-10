import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function sendWhapi(phone: string, message: string) {
  const token = process.env.WHAPI_TOKEN
  if (!token) return { error: 'WHAPI_TOKEN não configurado' }
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('55') ? digits : `55${digits}`
  const res = await fetch('https://gate.whapi.cloud/messages/text', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: `${normalized}@s.whatsapp.net`, body: message }),
  })
  const json = await res.json().catch(() => ({}))
  return res.ok ? { sent: true } : { error: json }
}

interface WhatsappNumber { name: string; phone: string }
interface AlertSettings { whatsapp_enabled: boolean; whatsapp_numbers: WhatsappNumber[] }
interface EditorialLine {
  id: string; client_id: string; pdf_name: string; valid_until: string
  notified_30: boolean; notified_15: boolean; notified_5: boolean
  clients: { name: string } | null
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = adminClient()

  const nowUtc = new Date()
  const nowBrasilia = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000)
  const todayStr = nowBrasilia.toISOString().slice(0, 10)

  // Busca todas as linhas editoriais ativas (não expiradas)
  const { data: lines, error: linesError } = await supabase
    .from('editorial_lines')
    .select('id, client_id, pdf_name, valid_until, notified_30, notified_15, notified_5, clients(name)')
    .gte('valid_until', todayStr)

  if (linesError) return NextResponse.json({ error: linesError.message }, { status: 500 })
  if (!lines || lines.length === 0) return NextResponse.json({ skipped: 'Nenhuma linha editorial ativa' })

  // Busca configurações de alerta
  const { data: settings } = await supabase
    .from('alert_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .single()

  const s = settings as AlertSettings | null
  const canSendWhatsApp = s?.whatsapp_enabled && (s?.whatsapp_numbers?.length ?? 0) > 0 && !!process.env.WHAPI_TOKEN

  const results: Record<string, unknown>[] = []

  for (const line of lines as EditorialLine[]) {
    const clientName = line.clients?.name ?? 'Cliente'
    const validUntil = new Date(line.valid_until + 'T12:00:00Z')
    const today = new Date(todayStr + 'T12:00:00Z')
    const daysLeft = Math.round((validUntil.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    const expiryFormatted = validUntil.toLocaleDateString('pt-BR')

    const toSend: { days: number; field: keyof EditorialLine }[] = [
      { days: 30, field: 'notified_30' },
      { days: 15, field: 'notified_15' },
      { days: 5,  field: 'notified_5'  },
    ]

    for (const { days, field } of toSend) {
      if (daysLeft !== days || line[field]) continue

      const emoji = days === 5 ? '🚨' : days === 15 ? '⚠️' : '📅'
      const urgency = days === 5 ? 'URGENTE — ' : days === 15 ? 'Atenção — ' : ''
      const message =
        `*Aura Control — ${urgency}Linha Editorial*\n\n` +
        `${emoji} A linha editorial do cliente *${clientName}* vence em *${days} dias* (${expiryFormatted}).\n\n` +
        `📄 Arquivo: ${line.pdf_name}\n\n` +
        `Acesse o Aura Control para renovar a linha editorial deste cliente.`

      let waSent = false
      if (canSendWhatsApp) {
        const waResults = await Promise.all(
          (s!.whatsapp_numbers as WhatsappNumber[]).map(n => sendWhapi(n.phone, message))
        )
        waSent = waResults.some(r => 'sent' in r && r.sent)
      }

      // Marca como notificado mesmo que WhatsApp não esteja habilitado
      await supabase
        .from('editorial_lines')
        .update({ [field]: true })
        .eq('id', line.id)

      results.push({ client: clientName, daysLeft: days, whatsapp: waSent })
    }
  }

  return NextResponse.json({ checked: lines.length, alerts: results })
}
