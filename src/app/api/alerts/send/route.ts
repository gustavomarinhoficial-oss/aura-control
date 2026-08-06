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

interface WhatsappNumber { name: string; phone: string; apikey: string }
interface AlertSettings {
  email_enabled: boolean
  email_addresses: string[]
  whatsapp_enabled: boolean
  whatsapp_numbers: WhatsappNumber[]
  frequency_hours: number
  days_ahead: number
  time_start: number
  time_end: number
  last_sent_at: string | null
}
interface Task { id: string; title: string; due_date: string | null; status: string; priority: string }
interface Client { id: string; name: string }

// POST /api/alerts/send — chamado pelo Vercel Cron (a cada hora)
// Só envia se: (a) dentro da janela horária configurada, (b) passou o intervalo desde último envio
export async function POST(request: Request) {
  // Autenticação do cron via secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = adminClient()

  // Busca configurações
  const { data: settings, error: settingsError } = await supabase
    .from('alert_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .single()

  if (settingsError || !settings) {
    return NextResponse.json({ error: 'Configurações não encontradas' }, { status: 404 })
  }

  const s = settings as AlertSettings

  // Verifica janela horária (horário de Brasília = UTC-3)
  const nowUtc = new Date()
  const nowBrasilia = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000)
  const currentHour = nowBrasilia.getHours()

  if (currentHour < s.time_start || currentHour >= s.time_end) {
    return NextResponse.json({ skipped: 'Fora da janela horária', hour: currentHour })
  }

  // Verifica intervalo desde último envio
  if (s.last_sent_at) {
    const lastSent = new Date(s.last_sent_at)
    const hoursSince = (nowUtc.getTime() - lastSent.getTime()) / (1000 * 60 * 60)
    if (hoursSince < s.frequency_hours) {
      return NextResponse.json({ skipped: 'Intervalo não atingido', hoursSince: hoursSince.toFixed(1) })
    }
  }

  if (!s.email_enabled && !s.whatsapp_enabled) {
    return NextResponse.json({ skipped: 'Alertas desativados' })
  }

  // Busca tarefas próximas e atrasadas
  const todayStr = nowBrasilia.toISOString().slice(0, 10)
  const futureDate = new Date(nowBrasilia)
  futureDate.setDate(futureDate.getDate() + s.days_ahead)
  const futureDateStr = futureDate.toISOString().slice(0, 10)

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id,title,due_date,status,priority,client_id')
    .in('status', ['pendente', 'em_andamento'])
    .lte('due_date', futureDateStr)
    .order('due_date', { ascending: true })

  const { data: clients } = await supabase.from('clients').select('id,name')
  const clientMap: Record<string, string> = {}
  for (const c of (clients as Client[] ?? [])) clientMap[c.id] = c.name

  const taskList = (tasks as (Task & { client_id: string | null })[] ?? [])
  if (taskList.length === 0) {
    return NextResponse.json({ skipped: 'Sem tarefas a alertar' })
  }

  const overdue = taskList.filter(t => t.due_date! < todayStr)
  const upcoming = taskList.filter(t => t.due_date! >= todayStr)

  const priorityLabel: Record<string, string> = { alta: '🔴 Alta', media: '🟡 Média', baixa: '🟢 Baixa' }

  function formatTask(t: Task & { client_id: string | null }): string {
    const client = t.client_id ? clientMap[t.client_id] : null
    const date = t.due_date ? new Date(t.due_date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
    return `• ${t.title}${client ? ` (${client})` : ''} — ${date} — ${priorityLabel[t.priority] ?? t.priority}`
  }

  const lines: string[] = []
  if (overdue.length) {
    lines.push(`⚠️ *Atrasadas (${overdue.length}):*`)
    overdue.forEach(t => lines.push(formatTask(t)))
    lines.push('')
  }
  if (upcoming.length) {
    lines.push(`📅 *Próximas (${upcoming.length}):*`)
    upcoming.forEach(t => lines.push(formatTask(t)))
  }
  const messageText = lines.join('\n')

  const results: Record<string, unknown> = {}

  // Email via Resend
  if (s.email_enabled && s.email_addresses.length > 0 && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const htmlLines = lines.map(l =>
      l.startsWith('•')
        ? `<li style="margin:4px 0;font-size:14px;">${l.replace('•', '').trim()}</li>`
        : l === ''
          ? '<br/>'
          : `<p style="margin:8px 0;font-weight:600;font-size:15px;">${l}</p>`
    ).join('')

    const html = `
      <div style="font-family:Inter,sans-serif;background:#111;color:#f0f0f0;padding:24px;border-radius:12px;max-width:600px;">
        <h2 style="color:#a78bfa;margin-bottom:16px;">Aura Control — Lembrete de Tarefas</h2>
        ${htmlLines}
        <p style="margin-top:24px;font-size:12px;color:#666;">Enviado automaticamente pelo Aura Control</p>
      </div>`

    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'alertas@aura.com.br',
      to: s.email_addresses,
      subject: `📋 Aura Control — ${taskList.length} tarefa${taskList.length !== 1 ? 's' : ''} pendente${taskList.length !== 1 ? 's' : ''}`,
      html,
    })
    results.email = emailError ? { error: emailError.message } : { sent: true }
  }

  // WhatsApp via Callmebot
  if (s.whatsapp_enabled && s.whatsapp_numbers.length > 0) {
    const waText = encodeURIComponent(`*Aura Control* — Lembretes\n\n${messageText}`)
    const waResults = await Promise.all(
      (s.whatsapp_numbers as WhatsappNumber[]).map(async (n) => {
        const url = `https://api.callmebot.com/whatsapp.php?phone=${n.phone}&text=${waText}&apikey=${n.apikey}`
        const res = await fetch(url)
        return { name: n.name, ok: res.ok, status: res.status }
      })
    )
    results.whatsapp = waResults
  }

  // Atualiza last_sent_at
  await supabase.from('alert_settings').update({ last_sent_at: nowUtc.toISOString() }).eq('id', SETTINGS_ID)

  return NextResponse.json({ sent: true, tasks: taskList.length, results })
}
