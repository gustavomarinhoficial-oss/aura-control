import { NextResponse } from 'next/server'

// Pergunta à Meta até quando o token de leitura vale (debug_token).
// expiresAt = null quando o token não expira (usuário do sistema).
export async function GET() {
  const token = process.env.META_ADS_TOKEN
  if (!token) return NextResponse.json({ configured: false })

  const url = `https://graph.facebook.com/v23.0/debug_token?input_token=${encodeURIComponent(token)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }).catch(() => null)
  const json = res ? await res.json().catch(() => ({})) : {}
  const d = json.data
  if (!d) return NextResponse.json({ configured: true, valid: false })

  const expires = Number(d.expires_at ?? 0)
  const expiresAt = expires > 0 ? new Date(expires * 1000).toISOString() : null
  const daysLeft = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000) : null
  return NextResponse.json({ configured: true, valid: d.is_valid !== false, expiresAt, daysLeft })
}
