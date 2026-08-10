import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

interface WhatsappNumber { name: string; phone: string; apikey?: string }
interface AlertSettings {
  email_enabled: boolean
  email_addresses: string[]
  whatsapp_enabled: boolean
  whatsapp_numbers: WhatsappNumber[]
  days_ahead: number
}
interface Task { id: string; title: string; due_date: string | null; status: string; priority: string; client_id: string | null }
interface Client { id: string; name: string }

async function sendWhapi(phone: string, message: string) {
  const token = process.env.WHAPI_TOKEN
  if (!token) return { error: 'WHAPI_TOKEN não configurado' }

  // Normaliza número: remove não-dígitos, adiciona 55 se não tiver
  const digits = phone.replace(/\D/g, '')
  const normalized = digits.startsWith('55') ? digits : `55${digits}`

  const res = await fetch('https://gate.whapi.cloud/messages/text', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: `${normalized}@s.whatsapp.net`, body: message }),
  })
  const json = await res.json().catch(() => ({}))
  return res.ok ? { sent: true } : { error: json }
}

// POST /api/alerts/send?mode=morning|evening — chamado pelo Vercel Cron
// morning (12h UTC = 9h Brasília): tarefas de hoje + atrasadas
// evening (0h UTC = 21h Brasília): tarefas de amanhã
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') ?? 'morning'

  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = adminClient()
  const { data: settings, error: settingsError } = await supabase
    .from('alert_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .single()

  if (settingsError || !settings) {
    return NextResponse.json({ error: 'Configurações não encontradas' }, { status: 404 })
  }

  const s = settings as AlertSettings

  if (!s.email_enabled && !s.whatsapp_enabled) {
    return NextResponse.json({ skipped: 'Alertas desativados' })
  }

  // Horário de Brasília (UTC-3)
  const nowUtc = new Date()
  const nowBrasilia = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000)
  const todayStr = nowBrasilia.toISOString().slice(0, 10)

  // morning: tarefas atrasadas + vencendo hoje
  // evening: tarefas vencendo amanhã
  const tomorrowBrasilia = new Date(nowBrasilia)
  tomorrowBrasilia.setDate(tomorrowBrasilia.getDate() + 1)
  const tomorrowStr = tomorrowBrasilia.toISOString().slice(0, 10)

  let query = supabase
    .from('tasks')
    .select('id,title,due_date,status,priority,client_id')
    .in('status', ['pendente', 'em_andamento'])
    .order('due_date', { ascending: true })

  if (mode === 'morning') {
    query = query.lte('due_date', todayStr)
  } else {
    query = query.eq('due_date', tomorrowStr)
  }

  const { data: tasks } = await query
  const { data: clients } = await supabase.from('clients').select('id,name')

  const clientMap: Record<string, string> = {}
  for (const c of (clients as Client[] ?? [])) clientMap[c.id] = c.name

  const taskList = (tasks as Task[] ?? [])

  if (taskList.length === 0) {
    return NextResponse.json({ skipped: mode === 'morning' ? 'Sem tarefas para hoje' : 'Sem tarefas para amanhã' })
  }

  const priorityLabel: Record<string, string> = { alta: '🔴 Alta', media: '🟡 Média', baixa: '🟢 Baixa' }

  function formatTask(t: Task): string {
    const client = t.client_id ? clientMap[t.client_id] : null
    const date = t.due_date ? new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
    return `• ${t.title}${client ? ` (${client})` : ''} — ${date} — ${priorityLabel[t.priority] ?? t.priority}`
  }

  const lines: string[] = []

  if (mode === 'morning') {
    const overdue = taskList.filter(t => t.due_date! < todayStr)
    const today = taskList.filter(t => t.due_date === todayStr)
    const header = `☀️ *Bom dia! Suas tarefas de hoje — ${new Date(todayStr + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}*`
    lines.push(header, '')
    if (overdue.length) {
      lines.push(`⚠️ *Atrasadas (${overdue.length}):*`)
      overdue.forEach(t => lines.push(formatTask(t)))
      lines.push('')
    }
    if (today.length) {
      lines.push(`📅 *Vence hoje (${today.length}):*`)
      today.forEach(t => lines.push(formatTask(t)))
    }
    if (!overdue.length && !today.length) {
      lines.push('✅ Nenhuma tarefa urgente pra hoje!')
    }
  } else {
    const header = `🌙 *Preparação para amanhã — ${new Date(tomorrowStr + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}*`
    lines.push(header, '')
    lines.push(`📋 *${taskList.length} tarefa${taskList.length !== 1 ? 's' : ''} vencendo amanhã:*`)
    taskList.forEach(t => lines.push(formatTask(t)))
  }

  const messageText = lines.join('\n')
  const results: Record<string, unknown> = {}

  // Email via Resend
  if (s.email_enabled && s.email_addresses.length > 0 && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const htmlLines = lines.map(l => {
      if (l === '') return '<br/>'
      if (l.startsWith('•')) return `<li style="margin:4px 0;font-size:14px;">${l.replace('•', '').trim()}</li>`
      return `<p style="margin:8px 0;font-weight:600;font-size:15px;">${l.replace(/\*/g, '')}</p>`
    }).join('')

    const subjectEmoji = mode === 'morning' ? '☀️' : '🌙'
    const subjectLabel = mode === 'morning' ? 'Tarefas de hoje' : 'O que vem amanhã'

    const html = `
      <div style="font-family:Inter,sans-serif;background:#111;color:#f0f0f0;padding:24px;border-radius:12px;max-width:600px;">
        <h2 style="color:#a78bfa;margin-bottom:16px;">Aura Control</h2>
        ${htmlLines}
        <p style="margin-top:24px;font-size:12px;color:#666;">Enviado automaticamente pelo Aura Control</p>
      </div>`

    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'alertas@aura.com.br',
      to: s.email_addresses,
      subject: `${subjectEmoji} Aura Control — ${subjectLabel}`,
      html,
    })
    results.email = emailError ? { error: emailError.message } : { sent: true, to: s.email_addresses }
  }

  // WhatsApp via Whapi.cloud
  if (s.whatsapp_enabled && s.whatsapp_numbers.length > 0 && process.env.WHAPI_TOKEN) {
    const waResults = await Promise.all(
      (s.whatsapp_numbers as WhatsappNumber[]).map(async (n) => {
        const result = await sendWhapi(n.phone, `*Aura Control*\n\n${messageText}`)
        return { name: n.name, phone: n.phone, ...result }
      })
    )
    results.whatsapp = waResults
  }

  await supabase
    .from('alert_settings')
    .update({ last_sent_at: nowUtc.toISOString() })
    .eq('id', SETTINGS_ID)

  return NextResponse.json({ sent: true, mode, tasks: taskList.length, results })
}
