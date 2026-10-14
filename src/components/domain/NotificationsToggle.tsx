'use client'

import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'

type State = 'loading' | 'unsupported' | 'blocked' | 'off' | 'on'

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

// Liga/desliga os avisos de reunião e captação neste aparelho (push do celular).
// No iPhone só funciona com o Hub instalado na tela inicial (iOS 16.4+).
export function NotificationsToggle({ className = '' }: { className?: string }) {
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pickMembers, setPickMembers] = useState<{ id: string; name: string }[] | null>(null)

  useEffect(() => {
    async function check() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { setState('unsupported'); return }
      if (Notification.permission === 'denied') { setState('blocked'); return }
      try {
        const reg = await navigator.serviceWorker.getRegistration('/sw.js')
        const sub = await reg?.pushManager.getSubscription()
        if (!sub) { setState('off'); return }
        const res = await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(sub.endpoint)}`)
        const d = await res.json().catch(() => ({}))
        setState(d.subscribed ? 'on' : 'off')
      } catch { setState('off') }
    }
    check()
  }, [])

  async function enable(memberId?: string) {
    setBusy(true)
    setError('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState(permission === 'denied' ? 'blocked' : 'off'); setBusy(false); return }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!key) throw new Error('Chave de notificação não configurada.')
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), member_id: memberId }),
      })
      const d = await res.json().catch(() => ({}))
      if (res.status === 409 && d.needsMember) { setPickMembers(d.members); setBusy(false); return }
      if (!res.ok) throw new Error(d.error ?? 'Não consegui ativar.')
      setPickMembers(null)
      setState('on')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não consegui ativar.')
    }
    setBusy(false)
  }

  async function disable() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) })
        await sub.unsubscribe()
      }
      setState('off')
    } catch { /* ignora */ }
    setBusy(false)
  }

  if (state === 'loading') return null

  const base = `flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm transition-colors ${className}`

  if (state === 'unsupported') {
    return (
      <p className="px-3 py-2 text-[11px] text-muted-foreground leading-snug">
        Para receber avisos no celular, instale o Hub na tela inicial (Safari → Compartilhar → Adicionar à Tela de Início) e abra por lá.
      </p>
    )
  }
  if (state === 'blocked') {
    return <p className="px-3 py-2 text-[11px] text-muted-foreground leading-snug">Notificações bloqueadas. Libere em Ajustes do celular → Notificações → OWL Hub.</p>
  }

  return (
    <div>
      {state === 'on' ? (
        <button onClick={disable} disabled={busy} className={`${base} text-[#22c55e] hover:bg-[#1a1a1a]`}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} strokeWidth={1.5} />}
          Avisos de reunião ligados
        </button>
      ) : (
        <button onClick={() => enable()} disabled={busy} className={`${base} text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a]`}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <BellOff size={16} strokeWidth={1.5} />}
          Ativar avisos de reunião
        </button>
      )}
      {pickMembers && (
        <div className="px-3 py-2 space-y-2">
          <p className="text-[11px] text-muted-foreground">Quem é você na equipe?</p>
          <div className="flex flex-wrap gap-1.5">
            {pickMembers.map(m => (
              <button key={m.id} onClick={() => enable(m.id)} className="text-xs border border-[#2a2a2a] hover:border-[#efefef] rounded-full px-3 py-1">{m.name}</button>
            ))}
          </div>
        </div>
      )}
      {error && <p className="px-3 py-1 text-[11px] text-[#ef4444]">{error}</p>}
    </div>
  )
}
