'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Circle, Loader2, CheckCircle2, Trash2, AlertCircle, Calendar, ChevronDown, ChevronRight, Check, Edit2, Upload, Download, X, FileSpreadsheet } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { useRole } from '@/lib/hooks/useRole'
import { JULIA_TASK_MEMBERS } from '@/lib/roles'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import type { Task, TaskStatus, TaskPriority, Member, TaskItem } from '@/lib/supabase/types'

const statusConfig: Record<TaskStatus, { label: string; icon: React.ElementType; color: string }> = {
  pendente: { label: 'Pendente', icon: Circle, color: 'text-muted-foreground' },
  em_andamento: { label: 'Em andamento', icon: Loader2, color: 'text-[#f59e0b]' },
  concluido: { label: 'Concluído', icon: CheckCircle2, color: 'text-[#22c55e]' },
}

const priorityConfig: Record<TaskPriority, { label: string; color: string }> = {
  baixa: { label: 'Baixa', color: 'text-muted-foreground' },
  media: { label: 'Média', color: 'text-[#f59e0b]' },
  alta: { label: 'Alta', color: 'text-[#ef4444]' },
}

interface Client { id: string; name: string }

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

function AssigneeAvatars({ assignees, size = 18 }: { assignees: Task['assignees']; size?: number }) {
  if (!assignees || assignees.length === 0) return null
  return (
    <div className="flex items-center -space-x-1.5">
      {assignees.map(a => <MemberAvatar key={a.id} member={a} size={size} />)}
    </div>
  )
}

function AssigneeMultiSelect({ members, value, onChange }: { members: Member[]; value: string[]; onChange: (ids: string[]) => void }) {
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

function TaskChecklist({ taskId }: { taskId: string }) {
  const [items, setItems] = useState<TaskItem[]>([])
  const [newTitle, setNewTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const loadItems = useCallback(() => {
    fetch(`/api/task-items?task_id=${taskId}`).then(r => r.json()).then(d => setItems(Array.isArray(d) ? d : [])).catch(() => {})
  }, [taskId])

  useEffect(() => { loadItems() }, [loadItems])

  async function toggleItem(id: string, completed: boolean) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, completed: !completed } : i))
    await fetch(`/api/task-items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed: !completed }),
    })
  }

  async function addItem() {
    const t = newTitle.trim()
    if (!t) return
    setNewTitle('')
    const res = await fetch('/api/task-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, title: t }),
    })
    if (res.ok) loadItems()
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/task-items/${id}`, { method: 'DELETE' })
  }

  const done = items.filter(i => i.completed).length

  return (
    <div className="mt-3 pt-3 border-t border-[#2a2a2a] space-y-1.5">
      {items.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div className="h-full bg-[#7c3aed] rounded-full transition-all" style={{ width: `${Math.round((done / items.length) * 100)}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">{done}/{items.length}</span>
        </div>
      )}
      {items.map(item => (
        <div key={item.id} className="group flex items-center gap-2">
          <button
            onClick={() => toggleItem(item.id, item.completed)}
            className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
              item.completed ? 'bg-[#7c3aed] border-[#7c3aed]' : 'border-[#3a3a3a] hover:border-[#7c3aed]'
            }`}
          >
            {item.completed && <Check size={8} className="text-white" />}
          </button>
          <span className={`text-xs flex-1 ${item.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.title}</span>
          <button
            onClick={() => deleteItem(item.id)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#ef4444] transition-all"
          >
            <Trash2 size={10} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 mt-1">
        <input
          ref={inputRef}
          type="text"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
          placeholder="Adicionar item..."
          className="flex-1 text-xs bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {newTitle.trim() && (
          <button onClick={addItem} className="text-[#7c3aed] hover:text-[#a78bfa] transition-colors">
            <Plus size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

export default function TarefasPage() {
  const role = useRole()
  const isJulia = role === 'julia'
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('task')

  const [tasks, setTasks] = useState<Task[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [activeTab, setActiveTab] = useState<'todas' | 'concluidas'>('todas')
  const [activeOwner, setActiveOwner] = useState<string>('todos')
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [pulseTask, setPulseTask] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [tasksRes, clientsRes, membersRes] = await Promise.all([
      fetch('/api/tasks').then(r => r.json()).catch(() => []),
      fetch('/api/clients').then(r => r.json()).catch(() => []),
      fetch('/api/members').then(r => r.json()).catch(() => []),
    ])
    setTasks(Array.isArray(tasksRes) ? tasksRes : [])
    setClients(Array.isArray(clientsRes) ? clientsRes : [])
    setMembers(Array.isArray(membersRes) ? membersRes : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Veio de um link "Ver tarefa" (ex: do Omar) — acha a tarefa, foca a aba certa e destaca
  useEffect(() => {
    if (!highlightId || loading || tasks.length === 0) return
    const target = tasks.find(t => t.id === highlightId)
    if (!target) return
    setActiveTab(target.status === 'concluido' ? 'concluidas' : 'todas')
    setPulseTask(highlightId)
    const timer = setTimeout(() => {
      document.getElementById(`task-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
    const clear = setTimeout(() => setPulseTask(null), 2500)
    return () => { clearTimeout(timer); clearTimeout(clear) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, loading, tasks.length])

  async function updateStatus(id: string, status: TaskStatus) {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    load()
  }

  async function deleteTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  }

  const today = new Date().toISOString().split('T')[0]

  // Para Julia: mostrar apenas tarefas da Julia e do Gabriel
  const baseTasks = isJulia
    ? tasks.filter(t => t.assignees?.some(a => JULIA_TASK_MEMBERS.includes(a.name)))
    : tasks

  const overdueCount = baseTasks.filter(t => t.due_date && t.due_date < today && t.status !== 'concluido').length

  const ownerFiltered = activeOwner === 'todos'
    ? baseTasks
    : baseTasks.filter(t => t.assignees?.some(a => a.name === activeOwner))

  // Para Julia: filtrar botões de membro para mostrar só Julia e Gabriel
  const visibleMembers = isJulia
    ? members.filter(m => JULIA_TASK_MEMBERS.includes(m.name))
    : members

  const openTasks = ownerFiltered
    .filter(t => t.status !== 'concluido')
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return a.due_date.localeCompare(b.due_date)
    })
  const doneTasks = ownerFiltered.filter(t => t.status === 'concluido')
  const filtered = activeTab === 'todas' ? openTasks : doneTasks

  const counts = {
    open: baseTasks.filter(t => t.status !== 'concluido').length,
    concluido: baseTasks.filter(t => t.status === 'concluido').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {counts.open} abertas · {counts.concluido} concluídas
            {overdueCount > 0 && <span className="text-[#ef4444] ml-2">· {overdueCount} atrasadas</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-sm font-medium px-3 py-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          >
            <Upload size={14} />
            <span className="hidden sm:inline">Importar</span>
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Nova tarefa
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-3">
        <div className="flex gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1 w-fit">
          {([['todas', 'Todas'], ['concluidas', 'Concluídas']] as const).map(([val, lbl]) => (
            <button
              key={val}
              onClick={() => setActiveTab(val)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeTab === val ? 'bg-[#2a2a2a] text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {lbl}
            </button>
          ))}
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
                {activeOwner === person && person !== 'todos' && (
                  <span className="ml-1.5 text-[10px] bg-[#7c3aed]/20 text-[#a78bfa] px-1.5 py-0.5 rounded-full">
                    {filtered.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
          <CheckCircle2 size={28} className="text-muted-foreground" strokeWidth={1} />
          <div>
            <p className="text-sm font-medium">Nenhuma tarefa</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {activeTab === 'concluidas' ? 'Nenhuma tarefa concluída ainda' : 'Crie sua primeira tarefa'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const sc = statusConfig[task.status]
            const pc = priorityConfig[task.priority]
            const isOverdue = task.due_date && task.due_date < today && task.status !== 'concluido'
            const isExpanded = expandedTask === task.id
            return (
              <div
                key={task.id}
                id={`task-${task.id}`}
                className={`group bg-[#1a1a1a] border rounded-xl px-5 py-4 transition-all duration-500 ${
                  pulseTask === task.id
                    ? 'border-[#7c3aed] ring-2 ring-[#7c3aed]/40'
                    : task.status === 'concluido' ? 'border-[#2a2a2a] opacity-60' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Status toggle */}
                  <Select value={task.status} onValueChange={v => updateStatus(task.id, v as TaskStatus)}>
                    <SelectTrigger
                      aria-label="Alterar status da tarefa"
                      className="h-auto w-auto gap-0.5 p-0.5 border-0 bg-transparent rounded-md mt-0.5 hover:bg-[#2a2a2a] data-[size=default]:h-auto [&_svg:not([class*='size-'])]:size-3"
                    >
                      <sc.icon size={18} className={`${sc.color} ${task.status === 'em_andamento' ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                    </SelectTrigger>
                    <SelectContent align="start" alignItemWithTrigger={false}>
                      {(Object.keys(statusConfig) as TaskStatus[]).map(s => {
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

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${task.status === 'concluido' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {task.title}
                      </p>
                      <button
                        onClick={() => setEditingTask(task)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#a78bfa] transition-all shrink-0"
                        title="Editar tarefa"
                      >
                        <Edit2 size={11} />
                      </button>
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {task.is_global ? (
                        <span className="text-[11px] text-[#60a5fa] bg-[#60a5fa]/10 px-2 py-0.5 rounded-full">
                          🌐 Todos os clientes
                        </span>
                      ) : task.clients && (
                        <span className="text-[11px] text-[#a78bfa] bg-[#7c3aed]/10 px-2 py-0.5 rounded-full">
                          {task.clients.name}
                        </span>
                      )}
                      <span className={`text-[11px] font-medium ${pc.color}`}>{pc.label}</span>
                      {task.due_date && (
                        <span className={`flex items-center gap-1 text-[11px] ${isOverdue ? 'text-[#ef4444]' : 'text-muted-foreground'}`}>
                          {isOverdue && <AlertCircle size={10} />}
                          <Calendar size={10} />
                          {formatDate(task.due_date)}
                        </span>
                      )}
                      <AssigneeAvatars assignees={task.assignees} size={18} />
                    </div>
                  </div>

                  {/* Expand checklist */}
                  <button
                    onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors mt-0.5"
                    title="Checklist"
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#ef4444] transition-all mt-0.5"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {isExpanded && <TaskChecklist taskId={task.id} />}
              </div>
            )
          })}
        </div>
      )}

      {showNew && (
        <NewTaskModal
          clients={clients}
          members={members}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load() }}
        />
      )}

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          clients={clients}
          members={members}
          onClose={() => setEditingTask(null)}
          onSaved={() => { setEditingTask(null); load() }}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); load() }}
        />
      )}
    </div>
  )
}

function NewTaskModal({ clients, members, onClose, onCreated }: {
  clients: Client[]
  members: Member[]
  onClose: () => void
  onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const title = (data.get('title') as string ?? '').trim()
    const description = (data.get('description') as string ?? '').trim()
    const clientRaw = (data.get('client_id') as string ?? '')
    const is_global = clientRaw === 'todos'
    const client_id = is_global ? null : clientRaw || null
    const priority = (data.get('priority') as string ?? 'media')
    const due_date = (data.get('due_date') as string ?? '') || null

    if (!title) { setError('Informe o título'); return }
    setSaving(true)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: description || null, client_id, is_global, assignee_ids: assigneeIds, priority, due_date }),
    })
    if (!res.ok) { setError('Erro ao criar tarefa'); setSaving(false); return }
    onCreated()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold mb-5">Nova tarefa</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Título *</label>
            <input
              type="text"
              name="title"
              placeholder="Ex: Criar relatório mensal"
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Descrição</label>
            <textarea
              name="description"
              rows={2}
              placeholder="Detalhes opcionais..."
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#7c3aed] transition-colors resize-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Cliente</label>
            <select
              name="client_id"
              defaultValue=""
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
            >
              <option value="">— Nenhum cliente —</option>
              <option value="todos">🌐 Todos os clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Responsáveis</label>
            <AssigneeMultiSelect members={members} value={assigneeIds} onChange={setAssigneeIds} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Prioridade</label>
              <select
                name="priority"
                defaultValue="media"
                className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Prazo</label>
              <input
                type="date"
                name="due_date"
                className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
              />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-[#ef4444]">
              <AlertCircle size={12} /> {error}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-[#2a2a2a] text-sm py-2.5 rounded-lg hover:bg-[#222222] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm py-2.5 rounded-lg transition-colors disabled:opacity-60">
              {saving ? 'Criando...' : 'Criar tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditTaskModal({ task, clients, members, onClose, onSaved }: {
  task: Task
  clients: Client[]
  members: Member[]
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assignees?.map(a => a.id) ?? [])
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? '',
    client_id: task.is_global ? 'todos' : (task.client_id ?? ''),
    priority: task.priority,
    due_date: task.due_date ?? '',
    status: task.status,
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const title = form.title.trim()
    if (!title) { setError('Informe o título'); return }
    setSaving(true)
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description: form.description.trim() || null,
        client_id: form.client_id === 'todos' ? null : form.client_id || null,
        is_global: form.client_id === 'todos',
        assignee_ids: assigneeIds,
        priority: form.priority,
        due_date: form.due_date || null,
        status: form.status,
      }),
    })
    if (!res.ok) { setError('Erro ao salvar'); setSaving(false); return }
    onSaved()
  }

  const inputCls = 'w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors'

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">Editar tarefa</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Título *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Descrição</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              placeholder="Detalhes opcionais..." className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Cliente</label>
            <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={inputCls}>
              <option value="">— Nenhum cliente —</option>
              <option value="todos">🌐 Todos os clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Responsáveis</label>
            <AssigneeMultiSelect members={members} value={assigneeIds} onChange={setAssigneeIds} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Prioridade</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value)} className={inputCls}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Prazo</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
              <option value="pendente">Pendente</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluido">Concluído</option>
            </select>
          </div>
          {error && <p className="text-xs text-[#ef4444] flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 border border-[#2a2a2a] text-sm py-2.5 rounded-lg hover:bg-[#222222] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm py-2.5 rounded-lg transition-colors disabled:opacity-60">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function downloadTemplate() {
  const csv = [
    'Tarefa,Responsavel,Prazo,Prioridade,Cliente,Descricao',
    'Criar relatório mensal,Gustavo,2026-09-05,alta,iMoowie,Relatório de resultados agosto',
    'Post feed semana 3,Julia,2026-09-08,media,,',
    'Reunião com cliente,Thomas,2026-09-10,alta,Valure Contabilidade,Apresentar proposta',
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'modelo-importacao-tarefas.csv'; a.click()
  URL.revokeObjectURL(url)
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file) return
    setStatus('loading')
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/tasks/import', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { setErrorMsg(data.error ?? 'Erro ao importar'); setStatus('error'); return }
      setResult({ created: data.created, skipped: data.skipped })
      setStatus('done')
    } catch {
      setErrorMsg('Erro de conexão'); setStatus('error')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">Importar tarefas</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        {status === 'idle' && (
          <div className="space-y-4">
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-4 text-xs text-muted-foreground space-y-1.5">
              <p className="text-foreground font-medium text-sm mb-2">Como funciona</p>
              <p>1. Baixe o modelo e preencha com suas tarefas</p>
              <p>2. Colunas: <span className="text-[#a78bfa]">Tarefa, Responsavel, Prazo, Prioridade, Cliente</span></p>
              <p>3. Prazo no formato <span className="text-[#a78bfa]">DD/MM/AAAA</span> ou <span className="text-[#a78bfa]">AAAA-MM-DD</span></p>
              <p>4. Prioridade: <span className="text-[#a78bfa]">alta, media ou baixa</span></p>
            </div>

            <button
              onClick={downloadTemplate}
              className="w-full flex items-center justify-center gap-2 border border-[#7c3aed]/40 text-[#a78bfa] hover:bg-[#7c3aed]/10 rounded-lg py-2.5 text-sm transition-colors"
            >
              <Download size={14} />
              Baixar modelo CSV
            </button>

            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-[#2a2a2a] hover:border-[#7c3aed]/50 rounded-xl py-8 text-muted-foreground hover:text-foreground transition-colors group"
            >
              <FileSpreadsheet size={28} strokeWidth={1.5} className="group-hover:text-[#a78bfa] transition-colors" />
              <div className="text-center">
                <p className="text-sm font-medium">Clique para selecionar o arquivo</p>
                <p className="text-xs mt-0.5">CSV ou Excel (.xlsx, .xls)</p>
              </div>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>
        )}

        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-8 h-8 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Importando tarefas...</p>
          </div>
        )}

        {status === 'done' && result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="w-12 h-12 rounded-full bg-[#22c55e]/15 flex items-center justify-center">
                <Check size={24} className="text-[#22c55e]" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold">{result.created} {result.created === 1 ? 'tarefa criada' : 'tarefas criadas'}</p>
                {result.skipped > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">{result.skipped} linha{result.skipped > 1 ? 's' : ''} ignorada{result.skipped > 1 ? 's' : ''} (sem título)</p>
                )}
              </div>
            </div>
            <button
              onClick={onImported}
              className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm py-2.5 rounded-lg transition-colors"
            >
              Ver tarefas
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="w-12 h-12 rounded-full bg-[#ef4444]/15 flex items-center justify-center">
                <AlertCircle size={24} className="text-[#ef4444]" />
              </div>
              <div className="text-center">
                <p className="text-base font-semibold">Erro ao importar</p>
                <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 border border-[#2a2a2a] text-sm py-2.5 rounded-lg hover:bg-[#222222] transition-colors">
                Fechar
              </button>
              <button onClick={() => setStatus('idle')} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm py-2.5 rounded-lg transition-colors">
                Tentar de novo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
