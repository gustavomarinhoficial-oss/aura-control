import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

// GET /api/alerts/test-email — diagnóstico direto, sem dependência de tarefas
export async function GET() {
  const apiKey = process.env.RESEND_API_KEY
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      step: 'env',
      error: 'RESEND_API_KEY não está configurado no Vercel. Vá em Settings → Environment Variables e adicione.',
    })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: settings } = await supabase
    .from('alert_settings')
    .select('email_addresses, email_enabled')
    .eq('id', SETTINGS_ID)
    .single()

  const addresses: string[] = settings?.email_addresses ?? []

  if (!settings?.email_enabled) {
    return NextResponse.json({ ok: false, step: 'settings', error: 'Email está desativado nas Configurações. Ative o toggle de Email e salve.' })
  }

  if (addresses.length === 0) {
    return NextResponse.json({ ok: false, step: 'settings', error: 'Nenhum endereço de email cadastrado nas Configurações.' })
  }

  const resend = new Resend(apiKey)
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: addresses,
    subject: '✅ Aura Control — Teste de email',
    html: `<div style="font-family:sans-serif;padding:24px;background:#111;color:#f0f0f0;border-radius:12px;max-width:500px;">
      <h2 style="color:#a78bfa;">Aura Control</h2>
      <p>✅ Email funcionando! Este é um teste de diagnóstico.</p>
      <p style="color:#888;font-size:12px;">Remetente: ${fromEmail}<br/>Destinatário(s): ${addresses.join(', ')}</p>
    </div>`,
  })

  if (error) {
    return NextResponse.json({
      ok: false,
      step: 'resend',
      error: (error as { message?: string }).message ?? String(error),
      from: fromEmail,
      to: addresses,
    })
  }

  return NextResponse.json({ ok: true, id: data?.id, from: fromEmail, to: addresses })
}
