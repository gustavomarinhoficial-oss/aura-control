'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { formatDate } from '@/lib/utils/format'
import {
  Plus, X, Check, Trash2, ChevronRight, Calendar, User2,
  AlertCircle, CheckSquare, Square, GripVertical, ExternalLink
} from 'lucide-react'
import Link from 'next/link'

// ── tipos ────────────────────────────────────────────────────────────────────
interface CheckItem { id: string; title: string; done: boolean }

interface Project {
  id: string
  client_id: string | null
  title: string
  description: string | null
  status: string
  deadline: string | null
  owner: string | null
  responsaveis: string[]
  checklist: CheckItem[]
  created_at: string
  clients?: { id: string; name: string } | null
}

interface ClientOption { id: string; name: string }

const PARTNERS = ['Gustavo', 'Gabriel', 'Thomas']

// ── constantes ────────────────────────────────────────────────────────────────
const COLUMNS: { key: string; label: string; color: string; dot: string }[] = [
  { key: 'afazer',    label: 'A fazer',        color: 'border-[#3a3a3a]',       dot: 'bg-[#6b7280]' },
  { key: 'andamento', label: 'Em andamento',   color: 'border-[#7c3aed]/40',    dot: 'bg-[#7c3aed]' },
  { key: 'aprovacao', label: 'Em aprovação',   color: 'border-[#f59e0b]/40',    dot: 'bg-[#f59e0b]' },
  { key: 'concluido', label: 'Concluído',      color: 'border-[#22c55e]/40',    dot: 'bg-[#22c55e]' },
  { key: 'arquivo',   label: 'Arquivo',        color: 'border-[#2a2a2a]',       dot: 'bg-[#3a3a3a]' },
]

// gera uma cor de accent consistente por nome do cliente
function clientColor(name: string): string {
  const colors = ['#7c3aed','#2563eb','#059669','#d97706','#dc2626','#db2777','#0891b2','#65a30d']
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return colors[Math.abs(hash) % colors.length]
}

function genId() { return Math.random().toString(36).slice(2) }

// ── componente de card ────────────────────────────────────────────────────────
function ProjectCard({
  project, onSelect, onDragStart, onDragEnd, isDragging,
}: {
  project: Project
  onSelect: () => void
  onDragStart: () => void
  onDragEnd: () => void
  isDragging: boolean
}) {
  const today = new Date().toISOString().split('T')[0]
  const isOverdue = project.deadline && project.deadline < today && project.status !== 'concluido' && project.status !== 'arquivo'
  const daysLeft = project.deadline
    ? Math.ceil((new Date(project.deadline).getTime() - Date.now()) / 86400000)
    : null
  const done = project.checklist.filter(i => i.done).length
  const total = project.checklist.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const accent = project.clients ? clientColor(project.clients.name) : '#6b7280'

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 cursor-pointer hover:border-[#3a3a3a] transition-all group select-none ${isDragging ? 'opacity-40 scale-95' : ''}`}
    >
      {/* accent + client */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: accent }} />
        {project.clients ? (
          <span className="text-[10px] text-muted-foreground truncate">{project.clients.name}</span>
        ) : (
          <span className="text-[10px] text-muted-foreground/40 italic">Sem cliente</span>
        )}
        <GripVertical size={12} className="ml-auto text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors" />
      </div>

      {/* título */}
      <p className="text-sm font-medium leading-snug mb-3">{project.title}</p>

      {/* checklist progress */}
      {total > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">{done}/{total} tarefas</span>
            <span className="text-[10px] text-muted-foreground">{pct}%</span>
          </div>
          <div className="h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct === 100 ? '#22c55e' : accent }} />
          </div>
        </div>
      )}

      {/* footer */}
      <div className="flex items-center gap-2 flex-wrap">
        {project.deadline && (
          <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${
            isOverdue ? 'text-[#ef4444] bg-[#ef4444]/10' :
            daysLeft !== null && daysLeft <= 3 ? 'text-[#f59e0b] bg-[#f59e0b]/10' :
            'text-muted-foreground bg-[#2a2a2a]'
          }`}>
            <Calendar size={9} />
            {isOverdue ? 'Atrasado' : daysLeft === 0 ? 'Hoje' : formatDate(project.deadline)}
          </span>
        )}
        {project.responsaveis.slice(0, 3).map((r, i) => (
          <span key={i} className="text-[10px] bg-[#2a2a2a] text-muted-foreground px-1.5 py-0.5 rounded-full truncate max-w-[80px]">
            {r}
          </span>
        ))}
        {project.responsaveis.length > 3 && (
          <span className="text-[10px] text-muted-foreground">+{project.responsaveis.length - 3}</span>
        )}
      </div>
    </div>
  )
}

// ── painel de detalhe ─────────────────────────────────────────────────────────
function DetailPanel({
  project, clients, onClose, onSaved, onDeleted,
}: {
  project: Project
  clients: ClientOption[]
  onClose: () => void
  onSaved: (p: Project) => void
  onDeleted: () => void
}) {
  const [form, setForm] = useState({ ...project, owner: project.owner ?? null })
  const [newResp, setNewResp] = useState('')
  const [newTask, setNewTask] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const isMounted = useRef(true)

  useEffect(() => {
    titleRef.current?.focus()
    return () => { isMounted.current = false }
  }, [])

  async function save(patch: Partial<Project> = {}) {
    setSaving(true)
    const merged = { ...form, ...patch }
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    })
    if (!isMounted.current) return
    if (res.ok) {
      const updated = await res.json()
      setForm(updated)
      onSaved(updated)
    }
    setSaving(false)
  }

  function addResponsavel() {
    if (!newResp.trim()) return
    const updated = [...form.responsaveis, newResp.trim()]
    setForm(f => ({ ...f, responsaveis: updated }))
    setNewResp('')
    save({ responsaveis: updated })
  }

  function removeResponsavel(i: number) {
    const updated = form.responsaveis.filter((_, j) => j !== i)
    setForm(f => ({ ...f, responsaveis: updated }))
    save({ responsaveis: updated })
  }

  function addTask() {
    if (!newTask.trim()) return
    const updated = [...form.checklist, { id: genId(), title: newTask.trim(), done: false }]
    setForm(f => ({ ...f, checklist: updated }))
    setNewTask('')
    save({ checklist: updated })
  }

  function toggleTask(id: string) {
    const updated = form.checklist.map(t => t.id === id ? { ...t, done: !t.done } : t)
    setForm(f => ({ ...f, checklist: updated }))
    save({ checklist: updated })
  }

  function removeTask(id: string) {
    const updated = form.checklist.filter(t => t.id !== id)
    setForm(f => ({ ...f, checklist: updated }))
    save({ checklist: updated })
  }

  async function del() {
    if (!confirm(`Apagar o projeto "${project.title}"?`)) return
    setDeleting(true)
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    onDeleted()
  }

  const done = form.checklist.filter(t => t.done).length
  const total = form.checklist.length

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* panel */}
      <div className="w-full max-w-md bg-[#111111] border-l border-[#2a2a2a] h-full overflow-y-auto flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2a2a2a] shrink-0">
          <div className="flex items-center gap-2">
            {saving && <div className="w-3 h-3 border border-[#7c3aed] border-t-transparent rounded-full animate-spin" />}
            <span className="text-xs text-muted-foreground">{saving ? 'Salvando...' : 'Auto-salvo'}</span>
          </div>
          <div className="flex items-center gap-2">
            {project.clients && (
              <Link href={`/clientes/${project.clients.id}`} className="text-muted-foreground hover:text-[#a78bfa] transition-colors p-1.5 rounded-lg hover:bg-[#1a1a1a]">
                <ExternalLink size={14} />
              </Link>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* título */}
          <input
            ref={titleRef}
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            onBlur={() => save()}
            className="w-full text-lg font-semibold bg-transparent border-b border-[#2a2a2a] pb-2 focus:outline-none focus:border-[#7c3aed] transition-colors"
          />

          {/* meta fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Responsável</label>
              <select
                value={form.owner ?? ''}
                onChange={e => { setForm(f => ({ ...f, owner: e.target.value || null })); save({ owner: e.target.value || null }) }}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                <option value="">Sem dono</option>
                {PARTNERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Status</label>
              <select
                value={form.status}
                onChange={e => { setForm(f => ({ ...f, status: e.target.value })); save({ status: e.target.value }) }}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Cliente</label>
              <select
                value={form.client_id ?? ''}
                onChange={e => { setForm(f => ({ ...f, client_id: e.target.value || null })); save({ client_id: e.target.value || null }) }}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                <option value="">Sem cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Prazo</label>
              <input
                type="date"
                value={form.deadline ?? ''}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value || null }))}
                onBlur={() => save()}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              />
            </div>
          </div>

          {/* descrição */}
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Descrição</label>
            <textarea
              value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              onBlur={() => save()}
              rows={3}
              placeholder="Detalhes do projeto, escopo, entregas..."
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors resize-none placeholder:text-muted-foreground/40"
            />
          </div>

          {/* responsáveis */}
          <div>
            <label className="block text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">
              Responsáveis
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.responsaveis.map((r, i) => (
                <span key={i} className="flex items-center gap-1.5 text-xs bg-[#1a1a1a] border border-[#2a2a2a] px-2.5 py-1 rounded-full">
                  <User2 size={10} className="text-muted-foreground" />
                  {r}
                  <button onClick={() => removeResponsavel(i)} className="text-muted-foreground/50 hover:text-[#ef4444] transition-colors ml-0.5">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newResp}
                onChange={e => setNewResp(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addResponsavel()}
                placeholder="Nome do responsável"
                className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/40"
              />
              <button onClick={addResponsavel} className="bg-[#7c3aed]/10 hover:bg-[#7c3aed]/20 text-[#a78bfa] px-3 py-1.5 rounded-lg text-sm transition-colors">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Checklist
              </label>
              {total > 0 && (
                <span className="text-[10px] text-muted-foreground">{done}/{total} concluídas</span>
              )}
            </div>
            {total > 0 && (
              <div className="h-1 bg-[#2a2a2a] rounded-full mb-3 overflow-hidden">
                <div className="h-full bg-[#22c55e] rounded-full transition-all" style={{ width: `${Math.round((done/total)*100)}%` }} />
              </div>
            )}
            <div className="space-y-1 mb-2">
              {form.checklist.map(task => (
                <div key={task.id} className="flex items-center gap-2 group/task py-1">
                  <button onClick={() => toggleTask(task.id)} className="shrink-0 text-muted-foreground hover:text-[#22c55e] transition-colors">
                    {task.done ? <CheckSquare size={15} className="text-[#22c55e]" /> : <Square size={15} />}
                  </button>
                  <span className={`flex-1 text-sm ${task.done ? 'line-through text-muted-foreground' : ''}`}>{task.title}</span>
                  <button onClick={() => removeTask(task.id)} className="opacity-0 group-hover/task:opacity-100 text-muted-foreground/50 hover:text-[#ef4444] transition-all">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTask()}
                placeholder="Nova tarefa do checklist"
                className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/40"
              />
              <button onClick={addTask} className="bg-[#7c3aed]/10 hover:bg-[#7c3aed]/20 text-[#a78bfa] px-3 py-1.5 rounded-lg text-sm transition-colors">
                <Plus size={14} />
              </button>
            </div>
          </div>

        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-[#2a2a2a] shrink-0">
          <button
            onClick={del}
            disabled={deleting}
            className="flex items-center gap-2 text-xs text-muted-foreground/50 hover:text-[#ef4444] transition-colors"
          >
            <Trash2 size={13} />
            {deleting ? 'Apagando...' : 'Apagar projeto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── modal novo projeto ────────────────────────────────────────────────────────
function NewProjectModal({ clients, onClose, onCreated }: {
  clients: ClientOption[]
  onClose: () => void
  onCreated: (p: Project) => void
}) {
  const [form, setForm] = useState({ title: '', client_id: '', deadline: '', status: 'afazer', owner: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    if (!form.title.trim()) return setError('Informe o título do projeto')
    setSaving(true)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, client_id: form.client_id || null, deadline: form.deadline || null }),
    })
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Erro'); setSaving(false); return }
    const project = await res.json()
    onCreated(project)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Novo projeto</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Título</label>
            <input
              autoFocus
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && create()}
              placeholder="Ex: Identidade Visual, Gestão de Tráfego..."
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Responsável</label>
              <select
                value={form.owner}
                onChange={e => setForm(f => ({ ...f, owner: e.target.value }))}
                className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                <option value="">Sem dono</option>
                {PARTNERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Coluna inicial</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Cliente (opcional)</label>
              <select
                value={form.client_id}
                onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                <option value="">Sem cliente</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Prazo (opcional)</label>
            <input
              type="date"
              value={form.deadline}
              onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
            />
          </div>
        </div>

        {error && <p className="text-xs text-[#ef4444] flex items-center gap-1"><AlertCircle size={12} />{error}</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 border border-[#2a2a2a] text-sm py-2.5 rounded-lg hover:bg-[#222222] transition-colors">Cancelar</button>
          <button onClick={create} disabled={saving}
            className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm py-2.5 rounded-lg transition-colors disabled:opacity-60 font-medium">
            {saving ? 'Criando...' : 'Criar projeto'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── página principal ──────────────────────────────────────────────────────────
export default function ProjetosPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Project | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [activeDrag, setActiveDrag]  = useState<Project | null>(null)
  const [dragPos, setDragPos]        = useState({ x: 0, y: 0 })
  const [overCol, setOverCol]        = useState<string | null>(null)
  const pendingDrag = useRef<{ project: Project; x: number; y: number; pointerId: number; el: Element } | null>(null)
  const isDraggingRef = useRef(false)
  const overColRef    = useRef<string | null>(null)
  const colRefs       = useRef<Map<string, Element>>(new Map())
  const [filterStatus, setFilterStatus] = useState<string>('todos')
  const [activeOwner, setActiveOwner] = useState<string>('todos')

  const load = useCallback(async () => {
    setLoading(true)
    const [pRes, cRes] = await Promise.all([
      fetch('/api/projects').then(r => r.json()).catch(() => []),
      fetch('/api/clients').then(r => r.json()).catch(() => []),
    ])
    setProjects(Array.isArray(pRes) ? pRes : [])
    setClients(Array.isArray(cRes) ? cRes.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })) : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── drag & drop (pointer events — funciona em touch + mouse) ──────────────
  function startDrag(e: React.PointerEvent, project: Project) {
    pendingDrag.current = { project, x: e.clientX, y: e.clientY, pointerId: e.pointerId, el: e.currentTarget as Element }
    isDraggingRef.current = false
  }

  function moveDrag(e: React.PointerEvent) {
    const p = pendingDrag.current
    if (!p) return
    if (!isDraggingRef.current && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return
    if (!isDraggingRef.current) { isDraggingRef.current = true; p.el.setPointerCapture(p.pointerId) }
    setActiveDrag(p.project)
    setDragPos({ x: e.clientX, y: e.clientY })
    let found: string | null = null
    for (const [col, el] of colRefs.current.entries()) {
      const r = el.getBoundingClientRect()
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { found = col; break }
    }
    overColRef.current = found
    setOverCol(found)
  }

  function endDrag() {
    const p = pendingDrag.current
    if (isDraggingRef.current && p && overColRef.current && overColRef.current !== p.project.status) {
      const colKey = overColRef.current
      setProjects(ps => ps.map(pr => pr.id === p.project.id ? { ...pr, status: colKey } : pr))
      fetch(`/api/projects/${p.project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: colKey }),
      })
    }
    pendingDrag.current = null; isDraggingRef.current = false
    setActiveDrag(null); setOverCol(null); overColRef.current = null
  }

  function onSaved(updated: Project) {
    setProjects(ps => ps.map(p => p.id === updated.id ? updated : p))
    // functional update: don't reopen the panel if it was already closed
    setSelected(prev => prev?.id === updated.id ? updated : prev)
  }

  function onDeleted() {
    if (selected) setProjects(ps => ps.filter(p => p.id !== selected.id))
    setSelected(null)
  }

  function onCreated(p: Project) {
    setProjects(ps => [p, ...ps])
    setShowNew(false)
    setSelected(p)
  }

  function renderColumn(col: typeof COLUMNS[number]) {
    const colProjects = projects.filter(p =>
      p.status === col.key &&
      (filterStatus === 'todos' || filterStatus === col.key) &&
      (activeOwner === 'todos' || p.owner === activeOwner)
    )
    const isDragTarget = overCol === col.key
    return (
      <div
        key={col.key}
        ref={el => { if (el) colRefs.current.set(col.key, el); else colRefs.current.delete(col.key) }}
        className="flex flex-col"
      >
        {/* column header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${col.dot}`} />
            <span className="text-sm font-medium">{col.label}</span>
            <span className="text-xs text-muted-foreground bg-[#1a1a1a] px-1.5 py-0.5 rounded-full">
              {colProjects.length}
            </span>
          </div>
          <button onClick={() => setShowNew(true)} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors p-0.5">
            <Plus size={14} />
          </button>
        </div>
        {/* drop zone */}
        <div className={`rounded-xl border-2 border-dashed transition-all p-2 space-y-2 min-h-[80px] md:min-h-[160px] ${
          isDragTarget ? 'border-[#7c3aed]/60 bg-[#7c3aed]/5' : 'border-transparent'
        }`}>
          {colProjects.length === 0 && !isDragTarget && (
            <div className="flex items-center justify-center h-10 md:h-20 text-xs text-muted-foreground/30">Vazio</div>
          )}
          {colProjects.map(project => (
            <div
              key={project.id}
              onPointerDown={e => startDrag(e, project)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onClick={() => { if (!isDraggingRef.current) setSelected(project) }}
              style={{ touchAction: 'none', opacity: activeDrag?.id === project.id ? 0.35 : 1 }}
            >
              <ProjectCard
                project={project}
                onSelect={() => {}}
                onDragStart={() => {}}
                onDragEnd={() => {}}
                isDragging={false}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // stats
  const total = projects.filter(p => p.status !== 'arquivo').length
  const overdue = projects.filter(p => {
    const today = new Date().toISOString().split('T')[0]
    return p.deadline && p.deadline < today && p.status !== 'concluido' && p.status !== 'arquivo'
  }).length
  const done = projects.filter(p => p.status === 'concluido').length

  return (
    <div className="flex flex-col md:h-full -mx-4 -my-6 md:-mx-8 md:-my-8 md:overflow-hidden">

      {/* header */}
      <div className="border-b border-[#2a2a2a] bg-[#0d0d0d] shrink-0">
        <div className="flex items-center justify-between px-4 md:px-6 pt-5 pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Projetos</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{total} ativos · {done} concluídos{overdue > 0 ? ` · ${overdue} atrasados` : ''}</p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus size={14} /> Novo projeto
          </button>
        </div>
        {/* abas por sócio */}
        <div className="flex px-4 md:px-6 gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {[['todos', 'Todos os projetos'], ...PARTNERS.map(p => [p, p])].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveOwner(key)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeOwner === key
                  ? 'border-[#7c3aed] text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              {key !== 'todos' && (
                <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeOwner === key ? 'bg-[#7c3aed]/20 text-[#a78bfa]' : 'bg-[#1a1a1a] text-muted-foreground'
                }`}>
                  {projects.filter(p => p.owner === key && p.status !== 'arquivo').length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* kanban board */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 md:p-6 space-y-3 md:space-y-4">
          {/* mobile: stack vertical · desktop: grid */}
          <div className="flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-4">
            {COLUMNS.slice(0, 3).map(col => renderColumn(col))}
          </div>
          <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
            {COLUMNS.slice(3).map(col => renderColumn(col))}
          </div>
        </div>
      )}

      {/* Ghost card during drag */}
      {activeDrag && (
        <div
          style={{
            position: 'fixed',
            left: dragPos.x - 100,
            top: dragPos.y - 28,
            width: 200,
            zIndex: 9999,
            pointerEvents: 'none',
            transform: 'rotate(2deg)',
          }}
          className="bg-[#1a1a1a] border border-[#7c3aed] rounded-xl p-4 shadow-2xl opacity-90"
        >
          <p className="text-sm font-medium truncate">{activeDrag.title}</p>
          {activeDrag.clients && (
            <p className="text-[10px] text-muted-foreground mt-1 truncate">{activeDrag.clients.name}</p>
          )}
        </div>
      )}

      {/* detail panel */}
      {selected && (
        <DetailPanel
          project={selected}
          clients={clients}
          onClose={() => setSelected(null)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}

      {/* new project modal */}
      {showNew && (
        <NewProjectModal
          clients={clients}
          onClose={() => setShowNew(false)}
          onCreated={onCreated}
        />
      )}
    </div>
  )
}
