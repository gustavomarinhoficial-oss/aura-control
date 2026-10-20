import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'

const ALERT_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'
// Espera até 10min desde o primeiro evento acumulado antes de mandar o
// resumo — junta rajadas de aprovação/reprovação num único e-mail em vez
// de um por post (o plano free do Resend tem limite diário baixo).
const DEBOUNCE_MINUTES = 10

interface QueueEntry {
  id: string
  post_title: string
  client_name: string
  status: string
  reason: string | null
  images_count: number
  created_at: string
}

export async function queueContentNotification(entry: {
  post_title: string
  client_name: string
  status: string
  reason: string | null
  images_count: number
}) {
  const supabase = createServiceClient()
  await supabase.from('content_notification_queue').insert(entry)
  await maybeFlush()
}

async function sendDigest(entries: QueueEntry[]) {
  const supabase = createServiceClient()
  const { data: settings } = await supabase
    .from('alert_settings')
    .select('email_enabled, email_addresses')
    .eq('id', ALERT_SETTINGS_ID)
    .single()

  if (!settings?.email_enabled || !settings.email_addresses?.length || !process.env.RESEND_API_KEY) return

  const approvedCount = entries.filter(e => e.status === 'aprovado').length
  const rejectedCount = entries.filter(e => e.status === 'reprovado').length
  const parts = []
  if (approvedCount) parts.push(`${approvedCount} aprovação${approvedCount !== 1 ? 'ões' : ''}`)
  if (rejectedCount) parts.push(`${rejectedCount} reprovação${rejectedCount !== 1 ? 'ões' : ''}`)
  const subject = `📋 Aura Control — ${parts.join(' e ')}`

  const rows = entries.map(e => {
    const approved = e.status === 'aprovado'
    return `
      <div style="padding:12px 0;border-bottom:1px solid #262626;">
        <p style="margin:0;font-size:14px;"><strong style="color:${approved ? '#22c55e' : '#ef4444'};">${approved ? '✅ Aprovado' : '❌ Reprovado'}</strong> — ${e.client_name}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#ccc;">${e.post_title}</p>
        ${!approved && e.reason ? `<p style="margin:6px 0 0;font-size:13px;color:#aaa;"><em>Motivo:</em> ${e.reason}</p>` : ''}
        ${!approved && e.images_count > 0 ? `<p style="margin:4px 0 0;font-size:12px;color:#888;">${e.images_count} imagem${e.images_count !== 1 ? 'ns' : ''} anexada${e.images_count !== 1 ? 's' : ''} — ver na Central de Conteúdo</p>` : ''}
      </div>`
  }).join('')

  const html = `
    <div style="font-family:Inter,sans-serif;background:#111;color:#f0f0f0;padding:24px;border-radius:12px;max-width:600px;">
      <h2 style="color:#a78bfa;margin-bottom:4px;">Atividade no calendário de conteúdo</h2>
      <p style="margin:0 0 16px;font-size:12px;color:#888;">${entries.length} evento${entries.length !== 1 ? 's' : ''} desde o último resumo</p>
      ${rows}
      <p style="margin-top:20px;font-size:12px;color:#666;">Enviado automaticamente pelo Aura Control</p>
    </div>`

  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'alertas@aura.com.br',
    to: settings.email_addresses,
    subject,
    html,
  })
}

async function flushEntries(entries: QueueEntry[]) {
  if (!entries.length) return
  const supabase = createServiceClient()
  try {
    await sendDigest(entries)
  } finally {
    // Sempre limpa a fila, mesmo se o envio falhar — best-effort, não
    // deixa a fila crescer pra sempre por causa de um erro no Resend
    await supabase.from('content_notification_queue').delete().in('id', entries.map(e => e.id))
  }
}

// Chamado a cada evento novo — só manda se o mais antigo da fila já esperou o suficiente
async function maybeFlush() {
  try {
    const supabase = createServiceClient()
    const { data: entries } = await supabase
      .from('content_notification_queue')
      .select('*')
      .order('created_at', { ascending: true })

    if (!entries?.length) return
    const ageMinutes = (Date.now() - new Date(entries[0].created_at).getTime()) / 60000
    if (ageMinutes < DEBOUNCE_MINUTES) return
    await flushEntries(entries as QueueEntry[])
  } catch {
    // Notificação é best-effort — nunca deve derrubar a aprovação/reprovação em si
  }
}

// Rede de segurança pro cron diário: manda o que sobrou na fila mesmo sem
// ter atingido os 10min (evita ficar preso se ninguém mais mexer no dia)
export async function flushAllContentNotifications() {
  const supabase = createServiceClient()
  const { data: entries } = await supabase
    .from('content_notification_queue')
    .select('*')
    .order('created_at', { ascending: true })
  await flushEntries((entries ?? []) as QueueEntry[])
}
