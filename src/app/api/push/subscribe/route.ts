import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getRole, ROLE_NAME } from '@/lib/roles'

// Descobre qual membro da equipe é essa pessoa (pelo papel; senão ela escolhe na tela).
async function resolveMember(userMeta: Record<string, unknown> | undefined, memberId?: string) {
  const db = createServiceClient()
  const { data: members } = await db.from('members').select('id, name').order('name')
  const list = members ?? []
  if (memberId && list.some(m => m.id === memberId)) return { id: memberId, members: list }
  const name = ROLE_NAME[getRole(userMeta)]
  const match = name ? list.find(m => m.name.toLowerCase() === name.toLowerCase()) : undefined
  return { id: match?.id ?? null, members: list }
}

// GET → este aparelho já está cadastrado? (?endpoint=...)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const endpoint = new URL(request.url).searchParams.get('endpoint')
  if (!endpoint) return NextResponse.json({ subscribed: false })
  const { data } = await createServiceClient().from('push_subscriptions').select('id').eq('endpoint', endpoint).maybeSingle()
  return NextResponse.json({ subscribed: !!data })
}

// POST { subscription, member_id? } → ativa as notificações neste aparelho
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const sub = body.subscription
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return NextResponse.json({ error: 'Inscrição inválida' }, { status: 400 })

  const { id: memberId, members } = await resolveMember(user.user_metadata, body.member_id)
  if (!memberId) return NextResponse.json({ needsMember: true, members }, { status: 409 })

  const { error } = await createServiceClient().from('push_subscriptions').upsert({
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    member_id: memberId,
    user_agent: (request.headers.get('user-agent') ?? '').slice(0, 200),
  }, { onConflict: 'endpoint' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE { endpoint } → desativa neste aparelho
export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (body.endpoint) await createServiceClient().from('push_subscriptions').delete().eq('endpoint', body.endpoint)
  return NextResponse.json({ ok: true })
}
