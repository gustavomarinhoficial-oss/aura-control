'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, CalendarCheck, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Clock, Loader2, MapPin } from 'lucide-react'
import { ClientAvatar } from '@/components/domain/ClientAvatar'
import { OwlMark } from '@/components/ui/OwlMark'
import { formatDateLong, formatDuration, toMin, toTime, weekdayOf } from '@/lib/booking/slots'

interface Booked { date: string; start: string | null; end: string | null; location: string | null }
interface Info {
  title: string
  client: { name: string; logo_url: string | null } | null
  duration_min: number
  location: string | null
  message: string | null
  status: 'aberto' | 'pausado' | 'cheio'
  days: { date: string; times: string[] }[]
  booked: Booked[]
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const input = 'w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-3.5 py-3 text-base sm:text-sm focus:outline-none focus:border-[#efefef] placeholder:text-[#5a5a5a]'

function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

function googleUrl(b: Booked, title: string): string {
  const d = b.date.replace(/-/g, '')
  const t = (x: string) => `${d}T${x.replace(':', '')}00`
  const q = new URLSearchParams({ action: 'TEMPLATE', text: `${title} com a OWL Creative Club`, dates: `${t(b.start!)}/${t(b.end!)}`, ctz: 'America/Sao_Paulo' })
  if (b.location) q.set('location', b.location)
  return `https://calendar.google.com/calendar/render?${q}`
}

// Página que o cliente abre: escolhe o dia, o horário, confirma e a captação já entra na agenda da OWL.
export function PublicBooking({ slug }: { slug: string }) {
  const [info, setInfo] = useState<Info | null>(null)
  const [loadError, setLoadError] = useState('')
  const [month, setMonth] = useState('')
  const [date, setDate] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', company: '', location: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<Booked | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/public/booking/${slug}`, { cache: 'no-store' }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    if (!res?.ok || !data) { setLoadError(res?.status === 404 ? 'Este link não existe mais. Peça um novo para a equipe OWL.' : 'Não foi possível carregar. Atualize a página.'); return }
    setInfo(data)
    setMonth(m => m || (data.days[0]?.date.slice(0, 7) ?? ''))
  }, [slug])

  useEffect(() => { load() }, [load])

  async function confirm(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !time || saving) return
    setSaving(true); setError('')
    const res = await fetch(`/api/public/booking/${slug}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, date, time }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    setSaving(false)
    if (res?.ok) { setDone(data); window.scrollTo(0, 0); return }
    setError(data.error ?? 'Não foi possível marcar. Confira sua internet e tente de novo.')
    // alguém pegou o horário nesse meio tempo: volta pra escolha com a lista atualizada
    if (data.code === 'SLOT_TAKEN') { setTime(null); await load() }
    if (data.code === 'CLOSED') await load()
  }

  if (loadError) return <Shell><p className="text-sm text-[#a8a8a8] text-center py-20">{loadError}</p></Shell>
  if (!info) return <Shell><div className="flex justify-center py-24"><Loader2 size={22} className="animate-spin text-[#7a7a7a]" /></div></Shell>

  const header = (
    <header className="flex items-center gap-3.5">
      <ClientAvatar name={info.client?.name ?? info.title} logoUrl={info.client?.logo_url} size={52} />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8a8a8a]">Agendar {info.title.toLowerCase()}</p>
        <h1 className="text-xl font-bold leading-tight break-words">{info.client?.name ?? 'OWL Creative Club'}</h1>
      </div>
    </header>
  )

  if (done) {
    return (
      <Shell>
        {header}
        <div className="rounded-2xl border border-[#22c55e]/30 bg-[#22c55e]/10 p-6 text-center space-y-3">
          <CheckCircle2 size={36} className="text-[#4ade80] mx-auto" />
          <h2 className="text-lg font-semibold">Está marcado!</h2>
          <BookedText b={done} />
          <a href={googleUrl(done, info.title)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-[#efefef] text-[#111]">
            <CalendarPlus size={15} /> Pôr no Google Agenda
          </a>
        </div>
        {info.message && <Message text={info.message} />}
        <p className="text-xs text-[#7a7a7a] text-center">A equipe OWL já foi avisada. Precisa mudar? Fale com a gente no WhatsApp.</p>
      </Shell>
    )
  }

  const bookedList = info.booked.length > 0 && (
    <div className="rounded-2xl border border-[#262626] bg-[#141414] p-4 space-y-3">
      <p className="flex items-center gap-2 text-sm font-semibold"><CalendarCheck size={15} className="text-[#4ade80]" /> Já marcado</p>
      {info.booked.map((b, i) => <BookedText key={i} b={b} left />)}
    </div>
  )

  if (info.status !== 'aberto') {
    return (
      <Shell>
        {header}
        {bookedList}
        {error && <p className="text-sm text-[#fca5a5] text-center">{error}</p>}
        <p className="text-sm text-[#a8a8a8] text-center py-6">
          {info.status === 'pausado' ? 'O agendamento está pausado no momento.' : info.booked.length ? 'Precisa mudar o horário ou marcar outra data?' : 'Este link já foi usado.'} Fale com a equipe OWL.
        </p>
      </Shell>
    )
  }

  const byDate = new Map(info.days.map(d => [d.date, d.times]))
  const months = info.days.map(d => d.date.slice(0, 7))
  const [y, m] = (month || '2000-01').split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const blanks = (weekdayOf(`${month || '2000-01'}-01`) + 6) % 7 // semana começa na segunda
  const times = date ? byDate.get(date) ?? [] : []
  const openLink = !info.client

  return (
    <Shell>
      {header}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[#a8a8a8]">
        <span className="flex items-center gap-1.5"><Clock size={14} /> {formatDuration(info.duration_min)}</span>
        {info.location && <span className="flex items-center gap-1.5"><MapPin size={14} /> {info.location}</span>}
      </div>
      {info.message && <Message text={info.message} />}
      {bookedList}
      {error && <p role="alert" className="text-sm text-[#fca5a5] bg-[#ef4444]/10 border border-[#ef4444]/25 rounded-xl px-4 py-3">{error}</p>}

      {info.days.length === 0 ? (
        <p className="text-sm text-[#a8a8a8] text-center py-10">Não há horários livres no momento. Fale com a equipe OWL.</p>
      ) : date && time ? (
        <form onSubmit={confirm} className="space-y-4">
          <button type="button" onClick={() => setTime(null)} className="flex items-center gap-1.5 text-xs text-[#a8a8a8]"><ArrowLeft size={13} /> Trocar horário</button>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-4">
            <p className="text-base font-semibold">{formatDateLong(date)}</p>
            <p className="text-sm text-[#a8a8a8]">{time} às {toTime(toMin(time) + info.duration_min)}</p>
          </div>
          <div className="space-y-3">
            {openLink && <Field label="Empresa"><input required autoComplete="organization" maxLength={120} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} className={input} /></Field>}
            <Field label="Seu nome"><input required autoComplete="name" maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={input} /></Field>
            <Field label={openLink ? 'WhatsApp' : 'WhatsApp (opcional)'}><input required={openLink} type="tel" autoComplete="tel" maxLength={40} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={input} /></Field>
            {!info.location && <Field label="Local da captação"><input required maxLength={300} placeholder="Endereço completo" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className={input} /></Field>}
            <Field label="Alguma observação? (opcional)"><textarea rows={3} maxLength={1000} placeholder="O que vamos gravar, quem vai participar…" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={`${input} resize-none`} /></Field>
          </div>
          <button type="submit" disabled={saving} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#efefef] text-[#111] font-semibold disabled:opacity-60">
            {saving && <Loader2 size={16} className="animate-spin" />} Confirmar horário
          </button>
        </form>
      ) : (
        <>
          <div className="rounded-2xl border border-[#262626] bg-[#141414] p-4">
            <div className="flex items-center justify-between mb-3">
              <button aria-label="Mês anterior" disabled={!months.some(x => x < month)} onClick={() => setMonth(shiftMonth(month, -1))} className="w-9 h-9 flex items-center justify-center rounded-full disabled:opacity-20 hover:bg-white/5"><ChevronLeft size={18} /></button>
              <p className="text-sm font-semibold">{MONTHS[m - 1]} {y}</p>
              <button aria-label="Próximo mês" disabled={!months.some(x => x > month)} onClick={() => setMonth(shiftMonth(month, 1))} className="w-9 h-9 flex items-center justify-center rounded-full disabled:opacity-20 hover:bg-white/5"><ChevronRight size={18} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => <span key={i} className="text-[11px] text-[#6b6b6b] py-1">{d}</span>)}
              {Array.from({ length: blanks }, (_, i) => <span key={`b${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = `${month}-${String(i + 1).padStart(2, '0')}`
                const free = byDate.has(d)
                return (
                  <button key={d} disabled={!free} aria-label={formatDateLong(d)} aria-pressed={date === d} onClick={() => { setDate(d); setError('') }}
                    className={`aspect-square rounded-full text-sm transition-colors ${date === d ? 'bg-[#efefef] text-[#111] font-semibold' : free ? 'bg-[#22c55e]/15 text-[#86efac] font-medium hover:bg-[#22c55e]/25' : 'text-[#444]'}`}>
                    {i + 1}
                  </button>
                )
              })}
            </div>
          </div>

          {date && times.length > 0 ? (
            <div>
              <p className="text-sm font-semibold mb-2.5">{formatDateLong(date)}</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {times.map(t => (
                  <button key={t} onClick={() => { setTime(t); setError('') }} className="py-3 rounded-xl border border-[#2e2e2e] bg-[#141414] text-sm font-medium hover:border-[#efefef]">{t}</button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#7a7a7a] text-center">Escolha um dia em verde para ver os horários.</p>
          )}
          <p className="text-[11px] text-[#6b6b6b] text-center">Horários de Brasília</p>
        </>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#0a0a0a] text-white flex flex-col px-4 pt-[calc(1.75rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md mx-auto space-y-5 flex-1">{children}</div>
      <p className="flex items-center justify-center gap-2 text-[11px] text-[#6b6b6b] mt-10"><OwlMark size={16} /> OWL Creative Club</p>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-xs text-[#a8a8a8] mb-1.5">{label}</span>{children}</label>
}

function Message({ text }: { text: string }) {
  return <p className="text-sm text-[#d4d4d4] bg-[#141414] border border-[#262626] rounded-2xl px-4 py-3 whitespace-pre-wrap">{text}</p>
}

function BookedText({ b, left }: { b: Booked; left?: boolean }) {
  return (
    <div className={left ? '' : 'text-center'}>
      <p className="text-sm font-medium">{formatDateLong(b.date)}{b.start && `, ${b.start}${b.end ? ` às ${b.end}` : ''}`}</p>
      {b.location && <p className="text-xs text-[#a8a8a8] mt-0.5">{b.location}</p>}
    </div>
  )
}
