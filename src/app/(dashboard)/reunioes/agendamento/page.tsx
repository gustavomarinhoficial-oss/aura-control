'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarCheck, Check, ExternalLink, Link2, Loader2, MessageCircle, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { ClientAvatar } from '@/components/domain/ClientAvatar'
import { BookingLinkForm } from '@/components/domain/booking/BookingLinkForm'
import { formatDateLong, formatDuration, todayBR, type BookingLink } from '@/lib/booking/slots'
import type { Member } from '@/lib/supabase/types'

interface Row extends BookingLink {
  clients: { id: string; name: string; logo_url: string | null } | null
  bookings: { id: string; title: string; meeting_date: string; start_time: string | null; end_time: string | null }[]
}

const DEFAULT_TEAM = ['Gustavo', 'Gabriel', 'Thomas'] // quem costuma ir nas captações

export default function AgendamentoPage() {
  const [links, setLinks] = useState<Row[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<{ initial?: BookingLink } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [justCreated, setJustCreated] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [l, c, m] = await Promise.all([
      fetch('/api/booking/links').then(r => r.json()).catch(() => null),
      fetch('/api/clients').then(r => r.json()).catch(() => []),
      fetch('/api/members').then(r => r.json()).catch(() => []),
    ])
    if (Array.isArray(l)) { setLinks(l); setError('') } else setError(l?.error ?? 'Erro ao carregar')
    setClients(Array.isArray(c) ? c : [])
    setMembers(Array.isArray(m) ? m : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const urlOf = (l: { slug: string }) => `${window.location.origin}/agendar/${l.slug}`

  function copy(l: Row) {
    navigator.clipboard.writeText(urlOf(l)).then(() => { setCopied(l.id); setTimeout(() => setCopied(null), 2000) })
  }

  function whatsappUrl(l: Row) {
    const text = `Olá! Vamos marcar a próxima captação${l.clients ? ` da ${l.clients.name}` : ''}? Escolha o melhor dia e horário por aqui: ${urlOf(l)}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

  async function toggleActive(l: Row) {
    const res = await fetch(`/api/booking/links/${l.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !l.active }) }).catch(() => null)
    if (res?.ok) setLinks(prev => prev.map(x => x.id === l.id ? { ...x, active: !l.active } : x))
  }

  async function remove(l: Row) {
    if (!confirm('Apagar este link? As captações já marcadas continuam na agenda.')) return
    const res = await fetch(`/api/booking/links/${l.id}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) setLinks(prev => prev.filter(x => x.id !== l.id))
  }

  function statusOf(l: Row) {
    if (!l.active) return { label: 'Pausado', color: '#6b7280' }
    if (l.max_bookings !== null && l.bookings.length >= l.max_bookings) return { label: 'Já marcado', color: '#22c55e' }
    return { label: 'Aguardando cliente', color: '#f59e0b' }
  }

  const defaultMembers = links[0]?.member_ids ?? members.filter(m => DEFAULT_TEAM.includes(m.name)).map(m => m.id)

  return (
    <div className="space-y-6">
      <Link href="/reunioes" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit"><ArrowLeft size={13} /> Reuniões e Captações</Link>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Links de agendamento</h1>
          <p className="text-sm text-muted-foreground mt-1">Mande o link, o cliente escolhe um horário livre e a captação entra na agenda.</p>
        </div>
        <button onClick={() => setModal({})} disabled={loading || !!error} className="flex items-center gap-2 bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111] text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
          <Plus size={14} /> Novo link
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <p className="text-sm text-[#fca5a5] bg-[#ef4444]/10 border border-[#ef4444]/25 rounded-xl p-4">{error}</p>
      ) : links.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
          <CalendarCheck size={28} className="text-muted-foreground" strokeWidth={1} />
          <p className="text-sm">Nenhum link ainda. Crie o primeiro e mande para o cliente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map(l => {
            const st = statusOf(l)
            const upcoming = l.bookings.filter(b => b.meeting_date >= todayBR())
            return (
              <div key={l.id} className={`bg-[#1a1a1a] border rounded-xl p-4 space-y-3 ${justCreated === l.id ? 'border-[#22c55e]/60' : 'border-[#2a2a2a]'}`}>
                <div className="flex items-start gap-3">
                  <ClientAvatar name={l.clients?.name ?? l.title} logoUrl={l.clients?.logo_url} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{l.clients?.name ?? 'Link aberto'} <span className="text-muted-foreground font-normal">· {l.title}</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDuration(l.duration_min)} · {members.filter(m => l.member_ids.includes(m.id)).map(m => m.name).join(', ')}
                      {l.mode === 'escolhidos' && ' · horários escolhidos'}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0" style={{ background: st.color + '22', color: st.color }}>{st.label}</span>
                </div>

                {justCreated === l.id && <p className="text-xs text-[#86efac]">Link criado. Copie ou mande direto no WhatsApp.</p>}
                <p className="text-xs text-muted-foreground bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 truncate">{urlOf(l)}</p>

                {upcoming.map(b => (
                  <Link key={b.id} href={`/reunioes?meeting=${b.id}`} className="flex items-center gap-2 text-xs text-[#86efac] hover:underline">
                    <CalendarCheck size={13} className="shrink-0" /> {formatDateLong(b.meeting_date)}{b.start_time && `, ${b.start_time.slice(0, 5)}${b.end_time ? ` às ${b.end_time.slice(0, 5)}` : ''}`}
                  </Link>
                ))}

                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => copy(l)} className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-[#efefef] text-[#111111]">
                    {copied === l.id ? <Check size={13} /> : <Link2 size={13} />}{copied === l.id ? 'Copiado' : 'Copiar link'}
                  </button>
                  <a href={whatsappUrl(l)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-[#2a2a2a] hover:border-[#3a3a3a]"><MessageCircle size={13} /> WhatsApp</a>
                  <a href={urlOf(l)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[#2a2a2a] hover:border-[#3a3a3a]"><ExternalLink size={13} /> Ver</a>
                  <div className="ml-auto flex items-center gap-1 text-muted-foreground">
                    <button onClick={() => setModal({ initial: l })} title="Editar" aria-label="Editar" className="p-2 hover:text-foreground"><Pencil size={14} /></button>
                    <button onClick={() => toggleActive(l)} title={l.active ? 'Pausar' : 'Reativar'} aria-label={l.active ? 'Pausar' : 'Reativar'} className="p-2 hover:text-foreground">{l.active ? <Pause size={14} /> : <Play size={14} />}</button>
                    <button onClick={() => remove(l)} title="Apagar" aria-label="Apagar" className="p-2 hover:text-[#ef4444]"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <BookingLinkForm
          clients={clients} members={members} initial={modal.initial} defaultMembers={defaultMembers}
          onClose={() => setModal(null)}
          onSaved={saved => { if (!modal.initial) setJustCreated(saved.id); setModal(null); load() }}
        />
      )}
    </div>
  )
}
