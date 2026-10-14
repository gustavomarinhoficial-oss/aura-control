import webpush from 'web-push'
import { createServiceClient } from '@/lib/supabase/server'

let configured = false
function configure(): boolean {
  if (configured) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contato@owlcreative.club', pub, priv)
  configured = true
  return true
}

export interface PushPayload { title: string; body: string; url?: string; tag?: string }

// Manda a notificação pra todos os aparelhos dos membros informados.
// Aparelhos que não existem mais (404/410) são apagados.
export async function sendPushToMembers(memberIds: string[], payload: PushPayload): Promise<{ sent: number; removed: number }> {
  if (memberIds.length === 0 || !configure()) return { sent: 0, removed: 0 }
  const db = createServiceClient()
  const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('member_id', memberIds)

  let sent = 0
  const dead: string[] = []
  await Promise.all((subs ?? []).map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 600 })
      sent++
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) dead.push(s.id)
    }
  }))
  if (dead.length) await db.from('push_subscriptions').delete().in('id', dead)
  return { sent, removed: dead.length }
}
