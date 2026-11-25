'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, X } from 'lucide-react'
import { inputCls } from '@/components/domain/ads/CampaignForm'
import {
  DEFAULT_WEEKLY, buildSlots, formatDateLong, formatDuration, slotKey, slotRange, toMin,
  type BookingLink, type Busy, type SlotRules, type SlotState, type Weekly,
} from '@/lib/booking/slots'
import type { Member } from '@/lib/supabase/types'

const WEEK = [['1', 'Seg'], ['2', 'Ter'], ['3', 'Qua'], ['4', 'Qui'], ['5', 'Sex'], ['6', 'Sáb'], ['0', 'Dom']] as const

const DURATIONS = [30, 60, 90, 120, 150, 180, 240, 300, 360, 480]
const STEPS = [30, 60, 90, 120]
const BUFFERS = [0, 15, 30, 60, 90, 120]
const NOTICES = [[0, 'Sem antecedência'], [12, '12 horas antes'], [24, '1 dia antes'], [48, '2 dias antes'], [72, '3 dias antes'], [168, '1 semana antes']] as const
const WINDOWS = [7, 15, 30, 60, 90]
const LIMITS = [1, 2, 3, 4, 6, 8]

const SLOT_STYLE: Record<SlotState, string> = {
  livre: 'border-[#22c55e]/50 bg-[#22c55e]/15 text-[#86efac]',
  retirado: 'border-[#2a2a2a] text-muted-foreground',
  ocupado: 'border-transparent bg-[#111111] text-[#5a5a5a] line-through cursor-not-allowed',
  cedo: 'border-transparent bg-[#111111] text-[#4a4a4a] cursor-not-allowed',
}

// Valor salvo fora da lista pronta continua aparecendo no select
const withCurrent = (list: readonly number[], v: number) => (list.includes(v) ? [...list] : [...list, v].sort((a, b) => a - b))

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return <p className="text-xs text-muted-foreground mb-1">{children}{hint && <span className="text-muted-foreground/60"> {hint}</span>}</p>
}

// Criar ou editar um link de agendamento, com a prévia dos horários que o cliente vai ver
export function BookingLinkForm({ clients, members, initial, defaultMembers, onClose, onSaved }: {
  clients: { id: string; name: string }[]
  members: Member[]
  initial?: BookingLink
  defaultMembers: string[]
  onClose: () => void
  onSaved: (created: BookingLink) => void
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? 'Captação',
    client_id: initial?.client_id ?? '',
    member_ids: initial?.member_ids ?? defaultMembers,
    duration_min: initial?.duration_min ?? 180,
    step_min: initial?.step_min ?? 60,
    buffer_min: initial?.buffer_min ?? 30,
    notice_hours: initial?.notice_hours ?? 24,
    mode: initial?.mode ?? 'semanal',
    weekly: initial?.weekly ?? DEFAULT_WEEKLY,
    start_date: initial?.start_date ?? '',
    end_date: initial?.end_date ?? '',
    window_days: initial?.window_days ?? 30,
    location: initial?.location ?? '',
    message: initial?.message ?? '',
    max_bookings: initial ? initial.max_bookings : 1,
  })
  // Cada modo guarda a própria lista, então trocar de um pro outro não perde o que já foi marcado
  const [removed, setRemoved] = useState<string[]>(initial?.mode === 'semanal' ? initial.slots : [])
  const [picked, setPicked] = useState<string[]>(initial?.mode === 'escolhidos' ? initial.slots : [])
  const [busy, setBusy] = useState<Busy[] | null>(null)
  const [now] = useState(() => new Date())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm(f => ({ ...f, [k]: v })) }
  const setDay = (day: string, ranges: [string, string][]) => set('weekly', { ...form.weekly, [day]: ranges } as Weekly)

  const marks = form.mode === 'escolhidos' ? picked : removed
  const setMarks = form.mode === 'escolhidos' ? setPicked : setRemoved

  const rules: SlotRules = {
    duration_min: form.duration_min, step_min: form.step_min, buffer_min: form.buffer_min, notice_hours: form.notice_hours, mode: form.mode,
    // horário da semana ainda sendo digitado não entra na prévia
    weekly: Object.fromEntries(Object.entries(form.weekly).map(([d, rs]) => [d, rs.filter(([a, b]) => a && b && toMin(b) > toMin(a))])) as Weekly,
    slots: marks, start_date: form.start_date || null, end_date: form.end_date || null, window_days: form.window_days,
  }
  const { from, to } = slotRange(rules, now)
  const memberKey = form.member_ids.join(',')

  useEffect(() => {
    let alive = true
    fetch(`/api/booking/busy?from=${from}&to=${to}&members=${memberKey}`)
      .then(r => r.json()).then(d => { if (alive) setBusy(Array.isArray(d) ? d : []) }).catch(() => { if (alive) setBusy([]) })
    return () => { alive = false }
  }, [from, to, memberKey])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const days = useMemo(() => buildSlots(rules, busy ?? [], now), [form, marks, busy, now])
  const freeCount = days.reduce((n, d) => n + d.slots.filter(s => s.state === 'livre').length, 0)

  function toggleSlot(date: string, time: string) {
    const key = slotKey(date, time)
    setMarks(list => list.includes(key) ? list.filter(k => k !== key) : [...list, key])
  }

  // Liga/desliga todos os horários possíveis do dia
  function toggleDay(date: string) {
    const open = days.find(d => d.date === date)?.slots.filter(s => s.state === 'livre' || s.state === 'retirado') ?? []
    const turnOn = !open.some(s => s.state === 'livre')
    const keys = open.map(s => slotKey(date, s.time))
    const shouldMark = form.mode === 'escolhidos' ? turnOn : !turnOn
    setMarks(list => {
      const rest = list.filter(k => !keys.includes(k))
      return shouldMark ? [...rest, ...keys] : rest
    })
  }

  async function save() {
    if (form.mode === 'escolhidos' && picked.length === 0) { setError('Clique nos horários que o cliente pode escolher.'); return }
    setSaving(true); setError('')
    const res = await fetch(initial ? `/api/booking/links/${initial.id}` : '/api/booking/links', {
      method: initial ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, slots: marks }),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    setSaving(false)
    if (!res?.ok) { setError(data.error ?? 'Não foi possível salvar. Tente de novo.'); return }
    onSaved(data)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-t-2xl sm:rounded-xl w-full max-w-2xl max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-base font-semibold">{initial ? 'Editar link de agendamento' : 'Novo link de agendamento'}</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Cliente</Label>
              <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={inputCls}>
                <option value="">Link aberto (a pessoa informa a empresa)</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label>Nome do compromisso</Label>
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Captação" className={inputCls} />
            </div>
          </div>

          <div>
            <Label hint="(a agenda dessas pessoas bloqueia os horários)">Quem vai</Label>
            <div className="flex flex-wrap gap-1.5">
              {members.map(m => {
                const on = form.member_ids.includes(m.id)
                return (
                  <button key={m.id} type="button" onClick={() => set('member_ids', on ? form.member_ids.filter(i => i !== m.id) : [...form.member_ids, m.id])}
                    className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${on ? 'border-[#efefef] bg-[#efefef]/15 text-[#efefef]' : 'border-[#2a2a2a] text-muted-foreground'}`}>
                    {m.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label>Duração</Label>
              <select value={form.duration_min} onChange={e => set('duration_min', Number(e.target.value))} className={inputCls}>
                {withCurrent(DURATIONS, form.duration_min).map(v => <option key={v} value={v}>{formatDuration(v)}</option>)}
              </select>
            </div>
            <div>
              <Label>Horários a cada</Label>
              <select value={form.step_min} onChange={e => set('step_min', Number(e.target.value))} className={inputCls}>
                {withCurrent(STEPS, form.step_min).map(v => <option key={v} value={v}>{formatDuration(v)}</option>)}
              </select>
            </div>
            <div>
              <Label>Folga antes/depois</Label>
              <select value={form.buffer_min} onChange={e => set('buffer_min', Number(e.target.value))} className={inputCls}>
                {withCurrent(BUFFERS, form.buffer_min).map(v => <option key={v} value={v}>{v === 0 ? 'Nenhuma' : formatDuration(v)}</option>)}
              </select>
            </div>
            <div>
              <Label>Marcar até</Label>
              <select value={form.notice_hours} onChange={e => set('notice_hours', Number(e.target.value))} className={inputCls}>
                {NOTICES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label hint="(vazio: o cliente informa)">Local</Label>
              <input value={form.location} onChange={e => set('location', e.target.value)} placeholder="Ex.: endereço do cliente" className={inputCls} />
            </div>
            <div>
              <Label>Quantas captações podem ser marcadas</Label>
              <select value={form.max_bookings ?? ''} onChange={e => set('max_bookings', e.target.value ? Number(e.target.value) : null)} className={inputCls}>
                {withCurrent(LIMITS, form.max_bookings ?? 1).map(v => <option key={v} value={v}>{v === 1 ? 'Só 1' : v}</option>)}
                <option value="">Sem limite</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label hint="(vazio: hoje)">A partir de</Label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={inputCls} />
            </div>
            <div>
              <Label hint="(opcional)">Até</Label>
              <input type="date" value={form.end_date} min={form.start_date || undefined} onChange={e => set('end_date', e.target.value)} className={inputCls} />
            </div>
            {!form.end_date && (
              <div>
                <Label>Sem data final, mostrar</Label>
                <select value={form.window_days} onChange={e => set('window_days', Number(e.target.value))} className={inputCls}>
                  {withCurrent(WINDOWS, form.window_days).map(v => <option key={v} value={v}>Próximos {v} dias</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <Label hint="(a captação inteira cabe dentro dessa faixa)">Dias e horários da semana</Label>
            <div className="rounded-lg border border-[#2a2a2a] divide-y divide-[#2a2a2a]">
              {WEEK.map(([day, label]) => {
                const ranges = form.weekly[day] ?? []
                const on = ranges.length > 0
                return (
                  <div key={day} className="flex items-start gap-3 px-3 py-2">
                    <label className="flex items-center gap-2 text-sm w-16 shrink-0 py-1.5 cursor-pointer">
                      <input type="checkbox" checked={on} onChange={() => setDay(day, on ? [] : [['09:00', '18:00']])} className="accent-[#efefef]" />
                      <span className={on ? '' : 'text-muted-foreground'}>{label}</span>
                    </label>
                    <div className="flex-1 space-y-1.5">
                      {ranges.map(([a, b], i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <input type="time" value={a} aria-label="Início" onChange={e => setDay(day, ranges.map((r, j) => j === i ? [e.target.value, r[1]] : r))} className={`${inputCls} !w-auto !py-1.5`} />
                          <span className="text-xs text-muted-foreground">às</span>
                          <input type="time" value={b} aria-label="Fim" onChange={e => setDay(day, ranges.map((r, j) => j === i ? [r[0], e.target.value] : r))} className={`${inputCls} !w-auto !py-1.5`} />
                          {ranges.length > 1 && <button type="button" aria-label="Remover faixa" onClick={() => setDay(day, ranges.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-[#ef4444] p-1"><X size={13} /></button>}
                          {i === ranges.length - 1 && ranges.length < 4 && <button type="button" aria-label="Adicionar faixa" title="Adicionar outra faixa" onClick={() => setDay(day, [...ranges, ['14:00', '18:00']])} className="text-muted-foreground hover:text-foreground p-1"><Plus size={14} /></button>}
                        </div>
                      ))}
                      {!on && <p className="text-xs text-muted-foreground py-1.5">Sem horários</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <Label>O que o cliente pode escolher</Label>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#111111] border border-[#2a2a2a]">
              {([['semanal', 'Todos os horários livres'], ['escolhidos', 'Só os que eu escolher']] as const).map(([v, l]) => (
                <button key={v} type="button" onClick={() => set('mode', v)} className={`text-xs sm:text-sm py-2 rounded-md transition-colors ${form.mode === v ? 'bg-[#efefef] text-[#111111] font-medium' : 'text-muted-foreground'}`}>{l}</button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {form.mode === 'semanal' ? 'Clique num horário para tirar ele do link.' : 'Clique nos horários que quer oferecer.'} Verde é o que o cliente vê; riscado já está ocupado na agenda. Clique no dia para marcar ou tirar tudo.
            </p>
            <div className="mt-2 rounded-lg border border-[#2a2a2a] max-h-72 overflow-y-auto divide-y divide-[#222]">
              {busy === null ? (
                <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
              ) : days.length === 0 ? (
                <p className="text-xs text-muted-foreground p-4 text-center">Nenhum horário cabe nessa configuração.</p>
              ) : days.map(d => (
                <div key={d.date} className="px-3 py-2">
                  <button type="button" onClick={() => toggleDay(d.date)} className="text-xs font-medium mb-1.5 hover:underline">{formatDateLong(d.date)}</button>
                  <div className="flex flex-wrap gap-1.5">
                    {d.slots.map(s => (
                      <button key={s.time} type="button" disabled={s.state === 'ocupado' || s.state === 'cedo'} onClick={() => toggleSlot(d.date, s.time)}
                        title={s.state === 'ocupado' ? 'Ocupado na agenda' : s.state === 'cedo' ? 'Passou ou está dentro da antecedência mínima' : undefined}
                        className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${SLOT_STYLE[s.state]}`}>
                        {s.time}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label hint="(opcional)">Recado para o cliente</Label>
            <textarea value={form.message} onChange={e => set('message', e.target.value)} rows={2} placeholder="Ex.: separe os produtos e avise a equipe que vai aparecer nos vídeos." className={`${inputCls} resize-none`} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#2a2a2a] space-y-2">
          {error && <p className="text-xs text-[#ef4444]">{error}</p>}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">{busy !== null && `${freeCount} horário${freeCount !== 1 ? 's' : ''} no link`}</p>
            <button onClick={save} disabled={saving} className="flex items-center gap-2 bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111] text-sm font-medium px-5 py-2.5 rounded-lg disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />}{initial ? 'Salvar' : 'Criar link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
