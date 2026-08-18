'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Clock, CheckCircle2, XCircle, MapPin, Trash2, Edit2,
  AlertCircle, ChevronDown, ChevronRight, CalendarClock,
} from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { useRole } from '@/lib/hooks/useRole'
import { JULIA_TASK_MEMBERS } from '@/lib/roles'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import type { Meeting, MeetingStatus, Member } from '@/lib/supabase/types'

const statusConfig: Record<MeetingStatus, { label: string; icon: React.ElementType; color: string }> = {
  agendada:  { label: 'Agendada',  icon: Clock,        color: 'text-[#f59e0b]' },
  realizada: { label: 'Realizada', icon: CheckCircle2, color: 'text-[#22c55e]' },
  cancelada: { label: 'Cancelada', icon: XCircle,       color: 'text-muted-foreground' },
}

interface Client { id: string; name: string }

// Data local (não UTC) — evita virar o dia errado perto da meia-noite UTC
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function MemberAvatar({ member, size = 20 }: { member: { initials: string; color: string; name: string }; size?: number }) {
  return (
    <div
      title={member.name}
      style={{ width: size, height: size, backgroundColor: member.color + '33', borderColor: member.color + '66', fontSize: size * 0.38 }}
      className="rounded-full border flex items-center justify-center font-semibold shrink-0 cursor-default"
    >
      <span style={{ color: member.color }}>{member.initials}</span>
    </div>
  )
}

function AttendeeAvatars({ attendees, size = 18 }: { attendees: Meeting['attendees']; size?: number }) {
  if (!attendees || attendees.length === 0) return null
  return (
    <div className="flex items-center -space-x-1.5">
      {attendees.map(a => <MemberAvatar key={a.id} member={a} size={size} />)}
    </div>
  )
}

function AttendeeMultiSelect({ members, value, onChange }: { members: Member[]; value: string[]; onChange: (ids: string[]) => void }) {
  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id])
  }
  if (members.length === 0) return <p className="text-xs text-muted-foreground">Nenhum membro cadastrado</p>
  return (
    <div className="flex flex-wrap gap-1.5">
      {members.map(m => {
        const active = value.includes(m.id)
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => toggle(m.id)}
            className={`flex items-center gap-1.5 pl-1.5 pr-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
              active
                ? 'border-[#7c3aed] bg-[#7c3aed]/15 text-[#a78bfa]'
                : 'border-[#2a2a2a] text-muted-foreground hover:border-[#3a3a3a] hover:text-foreground'
            }`}
          >
            <MemberAvatar member={m} size={16} />
            {m.name}
          </button>
        )
      })}
    </div>
  )
}

interface MeetingFormData {
  title: string
  client_id: string | null
  meeting_date: string
  start_time: string | null
  location: string | null
  notes: string | null
  attendee_ids: string[]
}

function MeetingForm({ initial, clients, members, onSubmit, submitLabel, saving, error }: {
  initial?: Partial<Meeting>
  clients: Client[]
  members: Member[]
  onSubmit: (data: MeetingFormData) => void
  submitLabel: string
  saving: boolean
  error: string
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [clientId, setClientId] = useState(initial?.client_id ?? '')
  const [date, setDate] = useState(initial?.meeting_date ?? localDateStr(new Date()))
  const [time, setTime] = useState(initial?.start_time?.slice(0, 5) ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [attendeeIds, setAttendeeIds] = useState<string[]>(initial?.attendees?.map(a => a.id) ?? [])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onSubmit({
      title: title.trim(),
      client_id: clientId || null,
      meeting_date: date,
      start_time: time || null,
      location: location.trim() || null,
      notes: notes.trim() || null,
      attendee_ids: attendeeIds,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Título *</label>
        <input
          value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Ex: Reunião de alinhamento — Cliente X"
          className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Cliente (opcional)</label>
        <select
          value={clientId} onChange={e => setClientId(e.target.value)}
          className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
        >
          <option value="">— Nenhum cliente —</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Data *</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Horário</label>
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Local</label>
        <input
          value={location} onChange={e => setLocation(e.target.value)}
          placeholder="Ex: Escritório, endereço do cliente..."
          className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Participantes</label>
        <AttendeeMultiSelect members={members} value={attendeeIds} onChange={setAttendeeIds} />
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Observações (opcional)</label>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="Pauta, contexto..."
          className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors resize-none"
        />
      </div>
      {error && <p className="text-xs text-[#ef4444] flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={saving} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm py-2.5 rounded-lg transition-colors disabled:opacity-60 font-medium">
          {saving ? 'Salvando...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default function ReunioesPage() {
  const role = useRole()
  const isJulia = role === 'julia'

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<Meeting | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [meetingsRes, clientsRes, membersRes] = await Promise.all([
      fetch('/api/meetings').then(r => r.json()).catch(() => []),
      fetch('/api/clients').then(r => r.json()).catch(() => []),
      fetch('/api/members').then(r => r.json()).catch(() => []),
    ])
    setMeetings(Array.isArray(meetingsRes) ? meetingsRes : [])
    setClients(Array.isArray(clientsRes) ? clientsRes : [])
    setMembers(Array.isArray(membersRes) ? membersRes : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const visibleMeetings = isJulia
    ? meetings.filter(m => m.attendees?.some(a => JULIA_TASK_MEMBERS.includes(a.name)))
    : meetings

  const todayStr = localDateStr(new Date())
  const upcoming = visibleMeetings.filter(m => m.meeting_date >= todayStr).sort((a, b) =>
    a.meeting_date === b.meeting_date ? (a.start_time ?? '').localeCompare(b.start_time ?? '') : a.meeting_date.localeCompare(b.meeting_date)
  )
  const past = visibleMeetings.filter(m => m.meeting_date < todayStr).sort((a, b) => b.meeting_date.localeCompare(a.meeting_date))

  async function createMeeting(data: MeetingFormData) {
    setSaving(true); setError('')
    const res = await fetch('/api/meetings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!res.ok) { setError('Erro ao criar reunião'); setSaving(false); return }
    setShowNew(false); setSaving(false); load()
  }

  async function updateMeeting(id: string, data: MeetingFormData) {
    setSaving(true); setError('')
    const res = await fetch(`/api/meetings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!res.ok) { setError('Erro ao salvar reunião'); setSaving(false); return }
    setEditing(null); setSaving(false); load()
  }

  async function updateStatus(id: string, status: MeetingStatus) {
    setMeetings(prev => prev.map(m => m.id === id ? { ...m, status } : m))
    await fetch(`/api/meetings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
  }

  async function deleteMeeting(id: string) {
    if (!confirm('Apagar esta reunião?')) return
    setMeetings(prev => prev.filter(m => m.id !== id))
    await fetch(`/api/meetings/${id}`, { method: 'DELETE' })
  }

  function MeetingRow({ meeting }: { meeting: Meeting }) {
    const sc = statusConfig[meeting.status]
    return (
      <div className="group bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-xl px-5 py-4 transition-colors">
        <div className="flex items-start gap-4">
          <Select value={meeting.status} onValueChange={v => updateStatus(meeting.id, v as MeetingStatus)}>
            <SelectTrigger
              aria-label="Alterar status da reunião"
              className="h-auto w-auto gap-0.5 p-0.5 border-0 bg-transparent rounded-md mt-0.5 hover:bg-[#2a2a2a] data-[size=default]:h-auto [&_svg:not([class*='size-'])]:size-3"
            >
              <sc.icon size={18} className={sc.color} strokeWidth={1.5} />
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false}>
              {(Object.keys(statusConfig) as MeetingStatus[]).map(s => {
                const opt = statusConfig[s]
                return (
                  <SelectItem key={s} value={s}>
                    <opt.icon size={14} className={opt.color} strokeWidth={1.5} />
                    {opt.label}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-medium ${meeting.status === 'cancelada' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {meeting.title}
              </p>
              <button
                onClick={() => setEditing(meeting)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#a78bfa] transition-all shrink-0"
                title="Editar reunião"
              >
                <Edit2 size={11} />
              </button>
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <CalendarClock size={10} />
                {formatDate(meeting.meeting_date)}{meeting.start_time && ` · ${meeting.start_time.slice(0, 5)}`}
              </span>
              {meeting.clients && (
                <span className="text-[11px] text-[#a78bfa] bg-[#7c3aed]/10 px-2 py-0.5 rounded-full">{meeting.clients.name}</span>
              )}
              {meeting.location && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPin size={10} />{meeting.location}
                </span>
              )}
              <AttendeeAvatars attendees={meeting.attendees} size={18} />
            </div>
            {meeting.notes && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{meeting.notes}</p>}
          </div>

          <button
            onClick={() => deleteMeeting(meeting.id)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#ef4444] transition-all mt-0.5"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reuniões</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {upcoming.length} próxima{upcoming.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Nova reunião
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : upcoming.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
          <CalendarClock size={28} className="text-muted-foreground" strokeWidth={1} />
          <div>
            <p className="text-sm font-medium">Nenhuma reunião agendada</p>
            <p className="text-xs text-muted-foreground mt-0.5">Crie sua primeira reunião</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {upcoming.map(m => <MeetingRow key={m.id} meeting={m} />)}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowPast(p => !p)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showPast ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Reuniões anteriores ({past.length})
          </button>
          {showPast && (
            <div className="space-y-2 opacity-70">
              {past.map(m => <MeetingRow key={m.id} meeting={m} />)}
            </div>
          )}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold mb-5">Nova reunião</h2>
            <MeetingForm clients={clients} members={members} onSubmit={createMeeting} submitLabel="Criar reunião" saving={saving} error={error} />
            <button onClick={() => { setShowNew(false); setError('') }} className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-3 py-1">Cancelar</button>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold mb-5">Editar reunião</h2>
            <MeetingForm initial={editing} clients={clients} members={members} onSubmit={d => updateMeeting(editing.id, d)} submitLabel="Salvar" saving={saving} error={error} />
            <button onClick={() => { setEditing(null); setError('') }} className="w-full text-center text-sm text-muted-foreground hover:text-foreground mt-3 py-1">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
