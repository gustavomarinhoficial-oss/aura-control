'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Circle, Loader2, CheckCircle2, Trash2, AlertCircle, Calendar, ChevronDown, ChevronRight, Check, Edit2 } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
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
  const [tasks, setTasks] = useState<Task[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [filterStatus, setFilterStatus] = useState<TaskStatus | 'todas'>('todas')
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

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

  function startEditTitle(task: Task) {
    setEditingTaskId(task.id)
    setEditTitle(task.title)
  }

  async function saveTitle(id: string) {
    const title = editTitle.trim()
    if (!title) { setEditingTaskId(null); return }
    setTasks(prev => prev.map(t => t.id === id ? { ...t, title } : t))
    setEditingTaskId(null)
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
  }

  const filtered = filterStatus === 'todas' ? tasks : tasks.filter(t => t.status === filterStatus)

  const counts = {
    pendente: tasks.filter(t => t.status === 'pendente').length,
    em_andamento: tasks.filter(t => t.status === 'em_andamento').length,
    concluido: tasks.filter(t => t.status === 'concluido').length,
  }

  const today = new Date().toISOString().split('T')[0]
  const overdueCount = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'concluido').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {counts.pendente + counts.em_andamento} abertas · {counts.concluido} concluídas
            {overdueCount > 0 && <span className="text-[#ef4444] ml-2">· {overdueCount} atrasadas</span>}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={14} />
          Nova tarefa
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1 w-fit">
        {([['todas', 'Todas'], ['pendente', 'Pendentes'], ['em_andamento', 'Em andamento'], ['concluido', 'Concluídas']] as const).map(([val, lbl]) => (
          <button
            key={val}
            onClick={() => setFilterStatus(val)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filterStatus === val ? 'bg-[#2a2a2a] text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {lbl}
          </button>
        ))}
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
              {filterStatus !== 'todas' ? 'Sem tarefas nesta categoria' : 'Crie sua primeira tarefa'}
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
                className={`group bg-[#1a1a1a] border rounded-xl px-5 py-4 transition-colors ${
                  task.status === 'concluido' ? 'border-[#2a2a2a] opacity-60' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Status toggle */}
                  <div className="relative mt-0.5">
                    <select
                      value={task.status}
                      onChange={e => updateStatus(task.id, e.target.value as TaskStatus)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="em_andamento">Em andamento</option>
                      <option value="concluido">Concluído</option>
                    </select>
                    <sc.icon size={18} className={`${sc.color} ${task.status === 'em_andamento' ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {editingTaskId === task.id ? (
                        <input
                          autoFocus
                          type="text"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          onBlur={() => saveTitle(task.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveTitle(task.id)
                            if (e.key === 'Escape') setEditingTaskId(null)
                          }}
                          className="flex-1 text-sm font-medium bg-[#111111] border border-[#7c3aed]/50 rounded px-2 py-0.5 focus:outline-none focus:border-[#7c3aed] text-foreground"
                        />
                      ) : (
                        <p
                          className={`text-sm font-medium ${task.status === 'concluido' ? 'line-through text-muted-foreground' : 'text-foreground'}`}
                        >
                          {task.title}
                        </p>
                      )}
                      {editingTaskId !== task.id && (
                        <button
                          onClick={() => startEditTitle(task)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#a78bfa] transition-all shrink-0"
                          title="Editar título"
                        >
                          <Edit2 size={11} />
                        </button>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {task.clients && (
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
                      {task.members && <MemberAvatar member={task.members} size={18} />}
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

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const title = (data.get('title') as string ?? '').trim()
    const description = (data.get('description') as string ?? '').trim()
    const client_id = (data.get('client_id') as string ?? '') || null
    const assignee_id = (data.get('assignee_id') as string ?? '') || null
    const priority = (data.get('priority') as string ?? 'media')
    const due_date = (data.get('due_date') as string ?? '') || null

    if (!title) { setError('Informe o título'); return }
    setSaving(true)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: description || null, client_id, assignee_id, priority, due_date }),
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Cliente</label>
              <select
                name="client_id"
                defaultValue=""
                className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                <option value="">Nenhum</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Responsável</label>
              <select
                name="assignee_id"
                defaultValue=""
                className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                <option value="">Nenhum</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
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
