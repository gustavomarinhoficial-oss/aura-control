'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Mic, MicOff, CheckSquare, DollarSign, CalendarClock, X, Check } from 'lucide-react'
import { formatBRL } from '@/lib/utils/format'
import { parseVoiceInput } from '@/lib/utils/parse-voice'
import { useRole } from '@/lib/hooks/useRole'
import { JULIA_TASK_MEMBERS, isFinanceRestricted } from '@/lib/roles'
import type { Task, Charge, Member, Meeting } from '@/lib/supabase/types'

interface Client { id: string; name: string }

interface DayEvent {
  id: string
  type: 'task' | 'charge' | 'meeting'
  title: string
  color: string
  amount?: number
  status?: string
  priority?: string
  time?: string | null
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const TASK_COLORS: Record<string, string> = {
  pendente: '#6b7280',
  em_andamento: '#f59e0b',
  concluido: '#22c55e',
}
const PRIORITY_COLORS: Record<string, string> = {
  alta: '#ef4444',
  media: '#f59e0b',
  baixa: '#6b7280',
}

export default function CalendarioPage() {
  const role = useRole()
  const isJulia = role === 'julia'
  const hideFinance = isFinanceRestricted(role)

  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [tasks, setTasks] = useState<Task[]>([])
  const [charges, setCharges] = useState<Charge[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [activeOwner, setActiveOwner] = useState<string>('todos')
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  // Voice state
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [parsed, setParsed] = useState<ReturnType<typeof parseVoiceInput> | null>(null)
  const [voiceError, setVoiceError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`

  const load = useCallback(async () => {
    setLoading(true)
    const [tasksRes, chargesRes, meetingsRes, clientsRes, membersRes] = await Promise.all([
      fetch('/api/tasks').then(r => r.json()).catch(() => []),
      fetch(`/api/charges?month=${monthStr}`).then(r => r.json()).catch(() => []),
      fetch('/api/meetings').then(r => r.json()).catch(() => []),
      fetch('/api/clients').then(r => r.json()).catch(() => []),
      fetch('/api/members').then(r => r.json()).catch(() => []),
    ])
    setTasks(Array.isArray(tasksRes) ? tasksRes : [])
    setCharges(Array.isArray(chargesRes) ? chargesRes : [])
    setMeetings(Array.isArray(meetingsRes) ? meetingsRes : [])
    setClients(Array.isArray(clientsRes) ? clientsRes : [])
    setMembers(Array.isArray(membersRes) ? membersRes : [])
    setLoading(false)
  }, [monthStr])

  useEffect(() => { load() }, [load])

  // Monta mapa dia → eventos
  const eventsByDay: Record<number, DayEvent[]> = {}

  // Para Julia: só tarefas de Julia e Gabriel, sem cobranças
  const baseTasks = isJulia
    ? tasks.filter(t => t.assignees?.some(a => JULIA_TASK_MEMBERS.includes(a.name)))
    : tasks

  const visibleTasks = activeOwner === 'todos'
    ? baseTasks
    : baseTasks.filter(t => t.assignees?.some(a => a.name === activeOwner))

  const visibleCharges = hideFinance ? [] : charges

  const visibleMeetings = isJulia
    ? meetings.filter(m => m.attendees?.some(a => JULIA_TASK_MEMBERS.includes(a.name)))
    : meetings

  const visibleMembers = isJulia
    ? members.filter(m => JULIA_TASK_MEMBERS.includes(m.name))
    : members

  for (const task of visibleTasks) {
    if (!task.due_date) continue
    const d = new Date(task.due_date + 'T12:00:00')
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!eventsByDay[day]) eventsByDay[day] = []
      eventsByDay[day].push({
        id: task.id,
        type: 'task',
        title: task.title,
        color: PRIORITY_COLORS[task.priority] ?? '#6b7280',
        status: task.status,
        priority: task.priority,
      })
    }
  }

  for (const charge of visibleCharges) {
    if (!charge.due_date) continue
    const d = new Date(charge.due_date + 'T12:00:00')
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!eventsByDay[day]) eventsByDay[day] = []
      eventsByDay[day].push({
        id: charge.id,
        type: 'charge',
        title: charge.description,
        color: charge.paid_at ? '#22c55e' : '#7c3aed',
        amount: Number(charge.amount),
        status: charge.paid_at ? 'pago' : 'pendente',
      })
    }
  }

  for (const meeting of visibleMeetings) {
    if (meeting.status === 'cancelada') continue
    const d = new Date(meeting.meeting_date + 'T12:00:00')
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!eventsByDay[day]) eventsByDay[day] = []
      eventsByDay[day].push({
        id: meeting.id,
        type: 'meeting',
        title: meeting.title,
        color: '#60a5fa',
        status: meeting.status,
        time: meeting.start_time,
      })
    }
  }

  // Grid do calendário
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
    setSelectedDay(null)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
    setSelectedDay(null)
  }

  // Voice recording
  function startRecording() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setVoiceError('Seu navegador não suporta reconhecimento de voz. Use o Chrome.'); return }

    setVoiceError('')
    setTranscript('')
    setParsed(null)
    setSavedMsg('')

    const rec = new SR()
    rec.lang = 'pt-BR'
    rec.continuous = false
    rec.interimResults = true
    recognitionRef.current = rec

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const text = e.results[i][0].transcript
          setTranscript(text)
          const clientNames = clients.map(c => c.name)
          const result = parseVoiceInput(text, clientNames)
          setParsed(result)
          setEditTitle(result.title)
          setEditDate(result.due_date)
          setEditTime(result.time ?? '')
        } else {
          interim += e.results[i][0].transcript
          if (interim) setTranscript(interim)
        }
      }
    }

    rec.onerror = () => {
      setVoiceError('Erro ao capturar áudio. Verifique a permissão do microfone.')
      setRecording(false)
    }

    rec.onend = () => setRecording(false)

    rec.start()
    setRecording(true)
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  async function confirmCreate() {
    if (!parsed) return
    setSaving(true)
    const clientMatch = clients.find(c => c.name === parsed.client_hint)
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editTitle || parsed.title,
        due_date: editDate || parsed.due_date,
        client_id: clientMatch?.id ?? null,
        priority: 'media',
        status: 'pendente',
        description: editTime ? `Horário: ${editTime}` : null,
      }),
    })
    setSaving(false)
    const finalDate = editDate || parsed.due_date
    setSavedMsg(`"${editTitle || parsed.title}" adicionado para ${new Date(finalDate + 'T12:00:00').toLocaleDateString('pt-BR')}${editTime ? ` às ${editTime}` : ''}`)
    setParsed(null)
    setTranscript('')
    load()
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const selectedDayEvents = selectedDay ? (eventsByDay[selectedDay] ?? []) : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Calendário</h1>
          <p className="text-sm text-muted-foreground mt-1">{MONTH_NAMES[month]} {year}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Navegação de mês */}
          <div className="flex items-center gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg">
            <button onClick={prevMonth} className="p-2 hover:bg-[#222222] rounded-l-lg transition-colors"><ChevronLeft size={14} /></button>
            <span className="text-xs px-3 min-w-[140px] text-center">{MONTH_NAMES[month]} {year}</span>
            <button onClick={nextMonth} className="p-2 hover:bg-[#222222] rounded-r-lg transition-colors"><ChevronRight size={14} /></button>
          </div>

          {/* Botão de voz */}
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              recording
                ? 'bg-[#ef4444] hover:bg-[#dc2626] text-white animate-pulse'
                : 'bg-[#7c3aed] hover:bg-[#6d28d9] text-white'
            }`}
          >
            {recording ? <MicOff size={14} /> : <Mic size={14} />}
            {recording ? 'Parar' : 'Falar'}
          </button>
        </div>
      </div>

      {/* Filtro por pessoa */}
      {visibleMembers.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {(['todos', ...visibleMembers.map(m => m.name)]).map(person => (
            <button
              key={person}
              onClick={() => setActiveOwner(person)}
              className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors shrink-0 ${
                activeOwner === person
                  ? 'bg-[#7c3aed]/15 text-[#a78bfa] font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a]'
              }`}
            >
              {person === 'todos' ? 'Todos' : person}
            </button>
          ))}
        </div>
      )}

      {/* Painel de voz */}
      {(recording || transcript || voiceError || savedMsg) && (
        <div className={`border rounded-xl p-4 space-y-3 ${
          recording ? 'border-[#ef4444]/40 bg-[#ef4444]/5' : 'border-[#7c3aed]/30 bg-[#7c3aed]/5'
        }`}>
          {recording && (
            <div className="flex items-center gap-3">
              <div className="flex gap-0.5 items-end h-5">
                {[3,5,7,4,6,8,5,3].map((h, i) => (
                  <div key={i} style={{ height: h * 2 }} className="w-1 bg-[#ef4444] rounded-full animate-pulse" />
                ))}
              </div>
              <span className="text-sm text-[#ef4444]">Ouvindo... fale agora</span>
            </div>
          )}

          {voiceError && <p className="text-sm text-[#ef4444]">{voiceError}</p>}

          {savedMsg && (
            <div className="flex items-center gap-2 text-sm text-[#22c55e]">
              <Check size={14} />
              {savedMsg}
            </div>
          )}

          {transcript && !savedMsg && (
            <div className="space-y-3">
              <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5">
                <p className="text-xs text-muted-foreground mb-1">Você disse:</p>
                <p className="text-sm text-foreground italic">"{transcript}"</p>
              </div>

              {parsed && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Entendido:</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Tarefa</p>
                      <input
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="text-sm font-medium bg-transparent border-0 outline-none w-full text-foreground"
                      />
                    </div>
                    <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Data</p>
                      <input
                        type="date"
                        value={editDate}
                        onChange={e => setEditDate(e.target.value)}
                        className="text-sm font-medium bg-transparent border-0 outline-none w-full text-foreground"
                      />
                    </div>
                    <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Horário</p>
                      <input
                        type="time"
                        value={editTime}
                        onChange={e => setEditTime(e.target.value)}
                        className="text-sm font-medium bg-transparent border-0 outline-none w-full text-foreground"
                      />
                    </div>
                  </div>
                  {parsed.client_hint && (
                    <p className="text-xs text-[#a78bfa]">Cliente detectado: {parsed.client_hint}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => { setTranscript(''); setParsed(null) }}
                      className="flex items-center gap-1.5 text-xs border border-[#2a2a2a] px-3 py-1.5 rounded-lg hover:bg-[#222222] transition-colors"
                    >
                      <X size={11} /> Cancelar
                    </button>
                    <button
                      onClick={confirmCreate}
                      disabled={saving}
                      className="flex items-center gap-1.5 text-xs bg-[#7c3aed] hover:bg-[#6d28d9] text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                    >
                      <Check size={11} /> {saving ? 'Salvando...' : 'Confirmar e criar'}
                    </button>
                    <button
                      onClick={startRecording}
                      className="flex items-center gap-1.5 text-xs border border-[#7c3aed]/40 text-[#a78bfa] px-3 py-1.5 rounded-lg hover:bg-[#7c3aed]/10 transition-colors"
                    >
                      <Mic size={11} /> Falar de novo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grade do calendário */}
        <div className="lg:col-span-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
          {/* Labels dos dias */}
          <div className="grid grid-cols-7 border-b border-[#2a2a2a]">
            {WEEKDAY_LABELS.map(d => (
              <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-3">{d}</div>
            ))}
          </div>

          {/* Células */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} className="min-h-[80px] border-b border-r border-[#1f1f1f]" />
                const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const isToday = dayStr === todayStr
                const isSelected = selectedDay === day
                const events = eventsByDay[day] ?? []
                const taskEvents = events.filter(e => e.type === 'task')
                const chargeEvents = events.filter(e => e.type === 'charge')
                const meetingEvents = events.filter(e => e.type === 'meeting')

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`min-h-[80px] border-b border-r border-[#1f1f1f] p-2 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#7c3aed]/10' : 'hover:bg-[#222222]'
                    }`}
                  >
                    <div className={`text-xs font-medium mb-1.5 w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-[#7c3aed] text-white' : 'text-muted-foreground'
                    }`}>
                      {day}
                    </div>

                    {/* Pontos de tarefas */}
                    {taskEvents.slice(0, 2).map(e => (
                      <div key={e.id} className="flex items-center gap-1 mb-0.5">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                        <span className="text-[9px] text-muted-foreground truncate leading-tight">{e.title}</span>
                      </div>
                    ))}

                    {/* Cobranças */}
                    {chargeEvents.slice(0, 1).map(e => (
                      <div key={e.id} className="flex items-center gap-1 mb-0.5">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                        <span className="text-[9px] truncate leading-tight" style={{ color: e.color }}>{formatBRL(e.amount ?? 0)}</span>
                      </div>
                    ))}

                    {/* Reuniões */}
                    {meetingEvents.slice(0, 1).map(e => (
                      <div key={e.id} className="flex items-center gap-1 mb-0.5">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                        <span className="text-[9px] truncate leading-tight" style={{ color: e.color }}>{e.time ? e.time.slice(0, 5) + ' ' : ''}{e.title}</span>
                      </div>
                    ))}

                    {events.length > 3 && (
                      <span className="text-[9px] text-muted-foreground">+{events.length - 3}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Painel lateral do dia selecionado */}
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
          {selectedDay ? (
            <>
              <h3 className="text-sm font-medium mb-4">
                {selectedDay} de {MONTH_NAMES[month]}
                {`${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}` === todayStr && (
                  <span className="ml-2 text-[10px] text-[#a78bfa] bg-[#7c3aed]/10 px-1.5 py-0.5 rounded-full">Hoje</span>
                )}
              </h3>

              {selectedDayEvents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Nenhum evento</p>
                  <p className="text-xs text-muted-foreground mt-1">Use o botão Falar para adicionar</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayEvents.map(e => (
                    <div key={e.id} className="flex items-start gap-3 py-2 border-b border-[#2a2a2a] last:border-0">
                      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: e.color + '22' }}>
                        {e.type === 'task'
                          ? <CheckSquare size={10} style={{ color: e.color }} />
                          : e.type === 'meeting'
                          ? <CalendarClock size={10} style={{ color: e.color }} />
                          : <DollarSign size={10} style={{ color: e.color }} />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{e.title}</p>
                        {e.type === 'meeting' && e.time && (
                          <p className="text-[10px] text-[#60a5fa]">{e.time.slice(0, 5)}</p>
                        )}
                        {e.amount !== undefined && (
                          <p className="text-[10px] text-muted-foreground">{formatBRL(e.amount)}</p>
                        )}
                        {e.status && (
                          <p className="text-[10px] text-muted-foreground capitalize">{e.status.replace('_', ' ')}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground">Clique em um dia para ver os eventos</p>
              <p className="text-xs text-muted-foreground mt-2">ou use o botão <strong>Falar</strong> para criar uma tarefa por voz</p>
            </div>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#ef4444]" /> Tarefa alta prioridade</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#f59e0b]" /> Tarefa média</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#7c3aed]" /> Cobrança pendente</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#22c55e]" /> Cobrança paga</div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#60a5fa]" /> Reunião</div>
      </div>
    </div>
  )
}
