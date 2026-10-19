'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Video, Users, Link2 } from 'lucide-react'
import type { Meeting } from '@/lib/supabase/types'

interface Client { id: string; name: string }

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

// Cada cliente ganha uma cor fixa (pela ordem do cadastro); lead sempre laranja.
const CLIENT_PALETTE = ['#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#ef4444', '#06b6d4', '#84cc16', '#f472b6', '#8b5cf6', '#10b981']
const LEAD_COLOR = '#f97316'
const NEUTRAL_COLOR = '#6b7280'

const HOUR_PX = 56
const DEFAULT_DURATION_MIN = 60

// Duração em minutos: usa o término informado; sem ele, 1 hora.
function durationOf(m: { start_time: string | null; end_time?: string | null }): number {
  const s = minutesOf(m.start_time)
  const e = minutesOf(m.end_time ?? null)
  return s !== null && e !== null && e > s ? e - s : DEFAULT_DURATION_MIN
}

function pad(n: number) { return String(n).padStart(2, '0') }
function dateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
function startOfWeek(d: Date) { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dow); x.setHours(12, 0, 0, 0); return x }
function minutesOf(t: string | null) { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + m }

function Chip({ m, color, label, compact = false, onSelect }: { m: Meeting; color: string; label: string; compact?: boolean; onSelect: (m: Meeting) => void }) {
  const cancelled = m.status === 'cancelada'
  const done = m.status === 'realizada'
  const Icon = m.type === 'captacao' ? Video : Users
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onSelect(m) }}
      title={[m.title, m.start_time ? `${m.start_time.slice(0, 5)}${m.end_time ? `–${m.end_time.slice(0, 5)}` : ''}` : null, label, m.location].filter(Boolean).join(' · ')}
      className={`w-full text-left rounded-md px-1.5 py-1 text-[11px] leading-tight transition-opacity hover:opacity-80 ${cancelled ? 'opacity-40 line-through' : done ? 'opacity-70' : ''}`}
      style={{
        backgroundColor: color + '26',
        borderLeft: `3px ${m.type === 'captacao' ? 'dashed' : 'solid'} ${color}`,
        color: '#f2f2f2',
      }}
    >
      <span className="flex items-center gap-1 min-w-0">
        <Icon size={10} style={{ color }} className="shrink-0" />
        {m.start_time && <span className="font-semibold shrink-0">{m.start_time.slice(0, 5)}</span>}
        <span className="truncate">{m.title}</span>
        {m.meeting_link && <Link2 size={9} className="shrink-0 opacity-70" />}
      </span>
      {!compact && label && <span className="block truncate text-[10px] opacity-70 mt-0.5">{label}</span>}
    </button>
  )
}

export function MeetingsCalendar({ meetings, clients, onSelect, onCreateAt }: {
  meetings: Meeting[]
  clients: Client[]
  onSelect: (m: Meeting) => void
  onCreateAt: (date: string, time: string | null) => void
}) {
  const [view, setView] = useState<'semana' | 'mes'>('semana')
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d })
  const todayStr = dateStr(new Date())

  const clientColor = useMemo(() => {
    const sorted = [...clients].sort((a, b) => a.id.localeCompare(b.id))
    const map = new Map<string, string>()
    sorted.forEach((c, i) => map.set(c.id, CLIENT_PALETTE[i % CLIENT_PALETTE.length]))
    return map
  }, [clients])

  function colorOf(m: Meeting): string {
    if (m.client_id) return clientColor.get(m.client_id) ?? NEUTRAL_COLOR
    if (m.lead_id) return LEAD_COLOR
    return NEUTRAL_COLOR
  }
  function labelOf(m: Meeting): string {
    return m.clients?.name ?? (m.leads?.company_name ? `Lead · ${m.leads.company_name}` : '')
  }

  const byDay = useMemo(() => {
    const map = new Map<string, Meeting[]>()
    for (const m of meetings) {
      if (!map.has(m.meeting_date)) map.set(m.meeting_date, [])
      map.get(m.meeting_date)!.push(m)
    }
    for (const list of map.values()) list.sort((a, b) => (a.start_time ?? '99').localeCompare(b.start_time ?? '99'))
    return map
  }, [meetings])

  const weekStart = startOfWeek(cursor)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  function go(delta: number) {
    const d = new Date(cursor)
    if (view === 'semana') d.setDate(d.getDate() + delta * 7)
    else d.setMonth(d.getMonth() + delta, 1)
    setCursor(d)
  }

  const title = view === 'semana'
    ? (() => {
        const a = weekDays[0], b = weekDays[6]
        return a.getMonth() === b.getMonth()
          ? `${a.getDate()} – ${b.getDate()} de ${MONTHS[a.getMonth()]} de ${a.getFullYear()}`
          : `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)} de ${b.getFullYear()}`
      })()
    : `${MONTHS[cursor.getMonth()]} de ${cursor.getFullYear()}`

  // Legenda: só o que aparece no período mostrado
  const visibleRange = view === 'semana'
    ? weekDays.map(dateStr)
    : null
  const inRange = meetings.filter(m => visibleRange ? visibleRange.includes(m.meeting_date) : m.meeting_date.startsWith(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`))
  const legend = new Map<string, string>()
  let hasLead = false
  for (const m of inRange) {
    if (m.client_id && m.clients) legend.set(m.clients.name, colorOf(m))
    else if (m.lead_id) hasLead = true
  }

  const chip = (m: Meeting, compact = false) => (
    <Chip key={m.id} m={m} color={colorOf(m)} label={labelOf(m)} compact={compact} onSelect={onSelect} />
  )

  const weekMeetings = weekDays.flatMap(d => byDay.get(dateStr(d)) ?? []).filter(m => m.status !== 'cancelada')
  const busiest = weekDays.map(d => ({ d, n: (byDay.get(dateStr(d)) ?? []).filter(m => m.status !== 'cancelada').length })).sort((a, b) => b.n - a.n)[0]

  function busyColor(n: number) { return n === 0 ? '#2a2a2a' : n <= 2 ? '#22c55e' : n <= 4 ? '#f59e0b' : '#ef4444' }
  function busyLabel(n: number) { return n === 0 ? 'Livre' : n <= 2 ? `${n} compromisso${n > 1 ? 's' : ''}` : n <= 4 ? `${n} · cheio` : `${n} · lotado` }

  // ── semana: grade por horário (desktop) ──
  function renderWeekGrid() {
    const timed = weekDays.flatMap(d => byDay.get(dateStr(d)) ?? []).filter(m => m.start_time)
    const mins = timed.map(m => minutesOf(m.start_time)!)
    const startH = Math.max(0, Math.min(8, mins.length ? Math.floor(Math.min(...mins) / 60) : 8))
    const endH = Math.min(24, Math.max(19, mins.length ? Math.ceil(Math.max(...timed.map(m => minutesOf(m.start_time)! + durationOf(m))) / 60) : 19))
    const hours = Array.from({ length: endH - startH }, (_, i) => startH + i)
    const untimed = (d: Date) => (byDay.get(dateStr(d)) ?? []).filter(m => !m.start_time)

    return (
      <div className="hidden md:block overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#141414]">
        <div className="grid" style={{ gridTemplateColumns: '48px repeat(7, minmax(0, 1fr))' }}>
          {/* cabeçalho dos dias */}
          <div className="border-b border-[#2a2a2a]" />
          {weekDays.map((d, i) => {
            const ds = dateStr(d)
            const n = (byDay.get(ds) ?? []).filter(m => m.status !== 'cancelada').length
            const isToday = ds === todayStr
            return (
              <button
                key={ds}
                type="button"
                onClick={() => onCreateAt(ds, null)}
                className={`border-b border-l border-[#2a2a2a] px-2 py-2 text-left hover:bg-[#1c1c1c] transition-colors ${isToday ? 'bg-[#1c1c1c]' : ''}`}
                title="Criar compromisso neste dia"
              >
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{WEEKDAYS[i]}</span>
                  <span className={`text-lg font-semibold leading-none ${isToday ? 'text-[#111] bg-[#efefef] rounded-full w-7 h-7 inline-flex items-center justify-center text-sm' : ''}`}>{d.getDate()}</span>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-[#2a2a2a] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (n / 5) * 100)}%`, backgroundColor: busyColor(n) }} />
                </div>
                <p className="mt-1 text-[10px]" style={{ color: n === 0 ? '#6b7280' : busyColor(n) }}>{busyLabel(n)}</p>
              </button>
            )
          })}

          {/* sem horário */}
          {weekDays.some(d => untimed(d).length > 0) && (
            <>
              <div className="border-b border-[#2a2a2a] text-[10px] text-muted-foreground px-1 pt-2">s/ hora</div>
              {weekDays.map(d => (
                <div key={dateStr(d)} className="border-b border-l border-[#2a2a2a] p-1 space-y-1 min-h-[28px]">
                  {untimed(d).map(m => chip(m, true))}
                </div>
              ))}
            </>
          )}

          {/* horas */}
          <div>
            {hours.map(h => (
              <div key={h} className="text-[10px] text-muted-foreground text-right pr-1.5 -mt-1.5" style={{ height: HOUR_PX }}>{pad(h)}:00</div>
            ))}
          </div>
          {weekDays.map(d => {
            const ds = dateStr(d)
            const list = (byDay.get(ds) ?? []).filter(m => m.start_time)
            // colunas lado a lado quando há horários que se sobrepõem
            const placed: { m: Meeting; col: number; cols: number; top: number; height: number }[] = []
            const sorted = [...list].sort((a, b) => minutesOf(a.start_time)! - minutesOf(b.start_time)!)
            let group: typeof placed = []
            let groupEnd = -1
            const flush = () => { const cols = Math.max(1, ...group.map(g => g.col + 1)); group.forEach(g => { g.cols = cols }); placed.push(...group); group = []; groupEnd = -1 }
            for (const m of sorted) {
              const st = minutesOf(m.start_time)!
              const dur = durationOf(m)
              const e = st + dur
              if (group.length && st >= groupEnd) flush()
              const used = new Set(group.filter(g => minutesOf(g.m.start_time)! + durationOf(g.m) > st).map(g => g.col))
              let col = 0
              while (used.has(col)) col++
              group.push({ m, col, cols: 1, top: ((st / 60) - startH) * HOUR_PX, height: Math.max(24, (dur / 60) * HOUR_PX - 2) })
              groupEnd = Math.max(groupEnd, e)
            }
            if (group.length) flush()

            return (
              <div key={ds} className="relative border-l border-[#2a2a2a]" style={{ height: hours.length * HOUR_PX }}>
                {hours.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onCreateAt(ds, `${pad(h)}:00`)}
                    className="block w-full border-t border-[#222] hover:bg-[#1a1a1a] transition-colors"
                    style={{ height: HOUR_PX }}
                    aria-label={`Criar às ${pad(h)}:00`}
                  />
                ))}
                {ds === todayStr && (() => {
                  const now = new Date()
                  const top = ((now.getHours() + now.getMinutes() / 60) - startH) * HOUR_PX
                  return top >= 0 && top <= hours.length * HOUR_PX ? <div className="absolute left-0 right-0 h-px bg-[#ef4444] pointer-events-none" style={{ top }}><span className="absolute -left-1 -top-[3px] w-[7px] h-[7px] rounded-full bg-[#ef4444]" /></div> : null
                })()}
                {placed.map(p => (
                  <div
                    key={p.m.id}
                    className="absolute px-0.5"
                    style={{ top: p.top, height: p.height, left: `${(p.col / p.cols) * 100}%`, width: `${100 / p.cols}%` }}
                  >
                    <div className="h-full">{chip(p.m)}</div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── semana: lista por dia (celular) ──
  function renderWeekAgenda() {
    return (
      <div className="md:hidden space-y-2">
        {weekDays.map((d, i) => {
          const ds = dateStr(d)
          const list = byDay.get(ds) ?? []
          const n = list.filter(m => m.status !== 'cancelada').length
          const isToday = ds === todayStr
          return (
            <div key={ds} className={`rounded-xl border p-3 ${isToday ? 'border-[#efefef]/40 bg-[#1a1a1a]' : 'border-[#2a2a2a] bg-[#141414]'}`}>
              <button type="button" onClick={() => onCreateAt(ds, null)} className="w-full flex items-center justify-between mb-2 text-left">
                <span className="text-sm font-medium">{WEEKDAYS[i]} <span className="text-muted-foreground">{d.getDate()}/{pad(d.getMonth() + 1)}</span>{isToday && <span className="ml-2 text-[10px] text-[#111] bg-[#efefef] rounded-full px-1.5 py-0.5">hoje</span>}</span>
                <span className="text-[11px]" style={{ color: n === 0 ? '#6b7280' : busyColor(n) }}>{busyLabel(n)}</span>
              </button>
              {list.length > 0 ? <div className="space-y-1.5">{list.map(m => chip(m))}</div> : <p className="text-[11px] text-muted-foreground">Nada marcado</p>}
            </div>
          )
        })}
      </div>
    )
  }

  // ── mês ──
  function renderMonthGrid() {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12)
    const gridStart = startOfWeek(first)
    const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
    return (
      <div className="rounded-xl border border-[#2a2a2a] bg-[#141414] overflow-hidden">
        <div className="grid grid-cols-7 border-b border-[#2a2a2a]">
          {WEEKDAYS.map(w => <div key={w} className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map(d => {
            const ds = dateStr(d)
            const list = (byDay.get(ds) ?? [])
            const n = list.filter(m => m.status !== 'cancelada').length
            const inMonth = d.getMonth() === cursor.getMonth()
            const isToday = ds === todayStr
            return (
              <div
                key={ds}
                onClick={() => { setCursor(d); setView('semana') }}
                className={`min-h-[64px] md:min-h-[96px] border-b border-l border-[#222] p-1 cursor-pointer hover:bg-[#1a1a1a] transition-colors ${inMonth ? '' : 'opacity-40'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] ${isToday ? 'bg-[#efefef] text-[#111] rounded-full w-5 h-5 inline-flex items-center justify-center font-semibold' : 'text-muted-foreground'}`}>{d.getDate()}</span>
                  {n > 0 && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: busyColor(n) }} />}
                </div>
                {/* celular: bolinhas coloridas; desktop: faixas com o título */}
                <div className="md:hidden flex flex-wrap gap-0.5">
                  {list.slice(0, 6).map(m => <span key={m.id} className="w-2 h-2 rounded-full" style={{ backgroundColor: colorOf(m) }} />)}
                </div>
                <div className="hidden md:block space-y-0.5">
                  {list.slice(0, 3).map(m => chip(m, true))}
                  {list.length > 3 && <p className="text-[10px] text-muted-foreground pl-1">+{list.length - 3} mais</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
            <button type="button" onClick={() => go(-1)} className="p-2 hover:bg-[#222] rounded-l-lg" aria-label="Anterior"><ChevronLeft size={14} /></button>
            <button type="button" onClick={() => { const d = new Date(); d.setHours(12, 0, 0, 0); setCursor(d) }} className="px-3 text-xs hover:bg-[#222] h-[30px]">Hoje</button>
            <button type="button" onClick={() => go(1)} className="p-2 hover:bg-[#222] rounded-r-lg" aria-label="Próximo"><ChevronRight size={14} /></button>
          </div>
          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
        <div className="flex gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1">
          {(['semana', 'mes'] as const).map(v => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${view === v ? 'bg-[#2a2a2a] text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {v === 'semana' ? 'Semana' : 'Mês'}
            </button>
          ))}
        </div>
      </div>

      {view === 'semana' && (
        <p className="text-xs text-muted-foreground">
          {weekMeetings.length === 0
            ? 'Semana livre: nenhum compromisso marcado.'
            : <>
                {weekMeetings.length} compromisso{weekMeetings.length > 1 ? 's' : ''} na semana
                {' · '}{weekMeetings.filter(m => m.type === 'captacao').length} captaç{weekMeetings.filter(m => m.type === 'captacao').length === 1 ? 'ão' : 'ões'}
                {' · '}{weekMeetings.filter(m => m.type !== 'captacao').length} reuni{weekMeetings.filter(m => m.type !== 'captacao').length === 1 ? 'ão' : 'ões'}
                {busiest && busiest.n > 1 && <> · dia mais cheio: <span className="text-foreground">{WEEKDAYS[(busiest.d.getDay() + 6) % 7]} {busiest.d.getDate()}</span> ({busiest.n})</>}
              </>}
        </p>
      )}

      {view === 'semana' ? <>{renderWeekGrid()}{renderWeekAgenda()}</> : renderMonthGrid()}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground">
        {[...legend.entries()].map(([name, color]) => (
          <span key={name} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />{name}</span>
        ))}
        {hasLead && <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: LEAD_COLOR }} />Lead</span>}
        <span className="flex items-center gap-1.5"><Users size={11} /> Reunião</span>
        <span className="flex items-center gap-1.5"><Video size={11} /> Captação (borda tracejada)</span>
      </div>
    </div>
  )
}
