import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase/server'

const ALLOWED_STATUSES = ['aprovado', 'reprovado']
const ALERT_SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

const PUBLIC_SELECT = 'id, title, caption, platform, status, scheduled_date, published_at, media_url, media_urls, rejection_reason, rejection_images, created_at'

async function notifyTeam(clientName: string, post: { title: string; platform: string; status: string; rejection_reason: string | null; rejection_images: string[] | null }) {
  try {
    const supabase = createServiceClient()
    const { data: settings } = await supabase
      .from('alert_settings')
      .select('email_enabled, email_addresses')
      .eq('id', ALERT_SETTINGS_ID)
      .single()

    if (!settings?.email_enabled || !settings.email_addresses?.length || !process.env.RESEND_API_KEY) return

    const approved = post.status === 'aprovado'
    const subject = `${approved ? '✅' : '❌'} ${clientName} ${approved ? 'aprovou' : 'reprovou'} um post — ${post.title}`
    const imagesCount = post.rejection_images?.length ?? 0

    const html = `
      <div style="font-family:Inter,sans-serif;background:#111;color:#f0f0f0;padding:24px;border-radius:12px;max-width:600px;">
        <h2 style="color:${approved ? '#22c55e' : '#ef4444'};margin-bottom:12px;">${approved ? 'Post aprovado' : 'Post reprovado'}</h2>
        <p style="margin:6px 0;font-size:14px;"><strong>Cliente:</strong> ${clientName}</p>
        <p style="margin:6px 0;font-size:14px;"><strong>Post:</strong> ${post.title}</p>
        <p style="margin:6px 0;font-size:14px;"><strong>Plataforma:</strong> ${post.platform}</p>
        ${!approved && post.rejection_reason ? `<p style="margin:16px 0 6px;font-size:14px;"><strong>Motivo:</strong> ${post.rejection_reason}</p>` : ''}
        ${!approved && imagesCount > 0 ? `<p style="margin:6px 0;font-size:13px;color:#aaa;">${imagesCount} imagem${imagesCount !== 1 ? 'ns' : ''} anexada${imagesCount !== 1 ? 's' : ''} pelo cliente — ver na Central de Conteúdo.</p>` : ''}
        <p style="margin-top:24px;font-size:12px;color:#666;">Enviado automaticamente pelo Aura Control</p>
      </div>`

    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'alertas@aura.com.br',
      to: settings.email_addresses,
      subject,
      html,
    })
  } catch {
    // Notificação é best-effort — nunca deve derrubar a aprovação/reprovação em si
  }
}

// PATCH /api/public/content/[id]  { token, status, reason?, images? }
// Só permite aprovar/reprovar, e só o post pertencer mesmo ao cliente do token.
// Reprovar exige motivo (não vazio) — fica salvo pra equipe ver no interno,
// junto com os prints (images) que o cliente quiser anexar.
// Nenhum outro campo (título, legenda, cliente etc) pode ser alterado por aqui.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const token = body.token as string | undefined
  const status = body.status as string | undefined
  const reason = (body.reason as string | undefined)?.trim()
  const images = Array.isArray(body.images) ? body.images.filter((u: unknown) => typeof u === 'string') : []

  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
  }
  if (status === 'reprovado' && !reason) {
    return NextResponse.json({ error: 'Informe o motivo da reprovação' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: client } = await supabase.from('clients').select('id, name').eq('share_token', token).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })

  const { data: post } = await supabase.from('content_posts').select('id, client_id').eq('id', id).maybeSingle()
  if (!post || post.client_id !== client.id) {
    return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 })
  }

  const { data: updated, error } = await supabase
    .from('content_posts')
    .update({
      status,
      rejection_reason: status === 'reprovado' ? reason : null,
      rejection_images: status === 'reprovado' && images.length > 0 ? images : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(PUBLIC_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Vercel pode congelar a função assim que a resposta é enviada, então
  // espera o e-mail (best-effort, com try/catch próprio) antes de responder
  await notifyTeam(client.name, updated)

  return NextResponse.json(updated)
}
