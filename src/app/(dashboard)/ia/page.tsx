'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getRole, ROLE_NAME } from '@/lib/roles'
import {
  Sparkles, Bot, Zap, Brain, GitBranch, FileText, Workflow,
  Search, Plus, X, Copy, Check, ExternalLink, Star, StarOff,
  Trash2, ChevronRight, Tag, Clock, TrendingUp, Paperclip, Download, Pencil
} from 'lucide-react'

// ── tipos ──────────────────────────────────────────────────────────────────────
interface AIResource {
  id: string
  title: string
  description: string | null
  category: string
  content: string | null
  link: string | null
  tags: string[]
  author: string | null
  uses_count: number
  featured: boolean
  file_path: string | null
  file_name: string | null
  created_at: string
  updated_at: string
}

// ── categorias ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'prompt',    label: 'Prompt',     icon: Sparkles,   color: '#a78bfa', bg: '#a78bfa18' },
  { key: 'gpt',       label: 'GPT',        icon: Bot,        color: '#60a5fa', bg: '#60a5fa18' },
  { key: 'automacao', label: 'Automação',  icon: Zap,        color: '#f97316', bg: '#f9731618' },
  { key: 'agente',    label: 'Agente',     icon: Brain,      color: '#f472b6', bg: '#f472b618' },
  { key: 'fluxo',     label: 'Fluxo',      icon: GitBranch,  color: '#34d399', bg: '#34d39918' },
  { key: 'template',  label: 'Template',   icon: FileText,   color: '#fbbf24', bg: '#fbbf2418' },
  { key: 'processo',  label: 'Processo',   icon: Workflow,   color: '#94a3b8', bg: '#94a3b818' },
]

function getCat(key: string) {
  return CATEGORIES.find(c => c.key === key) ?? CATEGORIES[0]
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7)  return `${days}d atrás`
  if (days < 30) return `${Math.floor(days / 7)}sem atrás`
  return `${Math.floor(days / 30)}m atrás`
}

// ── Card ──────────────────────────────────────────────────────────────────────
function ResourceCard({ item, onClick, onToggleFeatured }: {
  item: AIResource
  onClick: () => void
  onToggleFeatured: (item: AIResource) => void
}) {
  const cat = getCat(item.category)
  const Icon = cat.icon
  const [copied, setCopied] = useState(false)

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    const text = item.content || item.link || item.title
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      onClick={onClick}
      className="group relative bg-[#111111] border border-[#1f1f1f] rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:border-[#2a2a2a] hover:bg-[#141414] hover:-translate-y-0.5"
      style={{ boxShadow: `0 0 0 0 ${cat.color}00`, transition: 'box-shadow 0.2s, transform 0.15s, border-color 0.15s, background-color 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 20px -4px ${cat.color}30` }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: cat.bg }}>
            <Icon size={15} style={{ color: cat.color }} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">{item.title}</p>
            <span className="text-[10px] font-medium" style={{ color: cat.color }}>{cat.label}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {(item.content || item.link) && (
            <button onClick={handleCopy} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#222] transition-colors" title="Copiar">
              {copied ? <Check size={13} className="text-[#34d399]" /> : <Copy size={13} className="text-muted-foreground" />}
            </button>
          )}
          {item.link && (
            <a href={item.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#222] transition-colors">
              <ExternalLink size={13} className="text-muted-foreground" />
            </a>
          )}
          <button onClick={e => { e.stopPropagation(); onToggleFeatured(item) }}
            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#222] transition-colors" title={item.featured ? 'Remover destaque' : 'Destacar'}>
            {item.featured
              ? <Star size={13} className="text-[#fbbf24] fill-[#fbbf24]" />
              : <StarOff size={13} className="text-muted-foreground" />}
          </button>
        </div>
      </div>

      {/* Description */}
      {item.description && (
        <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">{item.description}</p>
      )}

      {/* Content preview */}
      {item.content && (
        <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg px-3 py-2 mb-3">
          <p className="text-[11px] text-muted-foreground font-mono line-clamp-2 leading-relaxed">{item.content}</p>
        </div>
      )}

      {/* Tags */}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {item.tags.slice(0, 4).map(tag => (
            <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a1a] text-muted-foreground">{tag}</span>
          ))}
          {item.tags.length > 4 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a1a] text-muted-foreground">+{item.tags.length - 4}</span>}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {item.author && (
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full bg-[#7c3aed]/30 flex items-center justify-center text-[8px] font-bold text-[#a78bfa]">
                {item.author[0]?.toUpperCase()}
              </div>
              <span className="text-[10px] text-muted-foreground">{item.author}</span>
            </div>
          )}
          {item.file_name && (
            <span className="flex items-center gap-0.5 text-[10px] text-[#34d399]">
              <Paperclip size={9} /> {item.file_name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {item.uses_count > 0 && (
            <span className="flex items-center gap-0.5"><TrendingUp size={9} /> {item.uses_count}</span>
          )}
          <span>{timeAgo(item.created_at)}</span>
        </div>
      </div>

      <ChevronRight size={12} className="absolute right-3 bottom-3 text-[#2a2a2a] group-hover:text-muted-foreground transition-colors" />
    </div>
  )
}

// ── Painel lateral ─────────────────────────────────────────────────────────────
function ResourcePanel({ item, onClose, onUpdate, onDelete }: {
  item: AIResource
  onClose: () => void
  onUpdate: (updated: AIResource) => void
  onDelete: (id: string) => void
}) {
  const cat = getCat(item.category)
  const Icon = cat.icon
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [editing, setEditing] = useState(false)

  async function downloadFile() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/ia/${item.id}`).then(r => r.json())
      if (res.url) {
        const blob = await fetch(res.url).then(r => r.blob())
        const objUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = objUrl
        a.download = item.file_name ?? 'arquivo'
        a.click()
        URL.revokeObjectURL(objUrl)
      }
    } finally {
      setDownloading(false)
    }
  }

  async function handleUse() {
    const text = item.content || item.link || ''
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    // incrementa uses_count
    const res = await fetch(`/api/ia/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uses_count: item.uses_count + 1 }),
    })
    if (res.ok) onUpdate(await res.json())
  }

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/ia/${item.id}`, { method: 'DELETE' })
    onDelete(item.id)
  }

  async function toggleFeatured() {
    const res = await fetch(`/api/ia/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured: !item.featured }),
    })
    if (res.ok) onUpdate(await res.json())
  }

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="absolute right-0 top-0 h-full w-full max-w-lg bg-[#0d0d0d] border-l border-[#1f1f1f] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-[#1a1a1a]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: cat.bg }}>
              <Icon size={18} style={{ color: cat.color }} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold leading-tight">{item.title}</h2>
              <span className="text-xs font-medium" style={{ color: cat.color }}>{cat.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={toggleFeatured} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#1a1a1a] transition-colors" title={item.featured ? 'Remover destaque' : 'Destacar'}>
              {item.featured ? <Star size={15} className="text-[#fbbf24] fill-[#fbbf24]" /> : <StarOff size={15} className="text-muted-foreground" />}
            </button>
            <button onClick={() => setEditing(true)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#1a1a1a] transition-colors" title="Editar recurso">
              <Pencil size={14} className="text-muted-foreground" />
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#1a1a1a] transition-colors">
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {item.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
          )}

          {/* Prompt / Conteúdo */}
          {item.content && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Conteúdo / Prompt</p>
              <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
                <p className="text-sm font-mono leading-relaxed whitespace-pre-wrap text-foreground/90">{item.content}</p>
              </div>
            </div>
          )}

          {/* Link externo */}
          {item.link && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Link</p>
              <a href={item.link} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 bg-[#111111] border border-[#1f1f1f] rounded-xl px-4 py-3 text-sm text-[#60a5fa] hover:border-[#60a5fa]/30 transition-colors group">
                <ExternalLink size={14} />
                <span className="truncate flex-1">{item.link}</span>
                <ChevronRight size={13} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            </div>
          )}

          {/* Arquivo anexo */}
          {item.file_name && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1"><Paperclip size={9} /> Arquivo anexo</p>
              <button
                onClick={downloadFile}
                disabled={downloading}
                className="w-full flex items-center gap-3 bg-[#111111] border border-[#1f1f1f] hover:border-[#34d399]/30 rounded-xl px-4 py-3 transition-colors group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#34d399]/10 flex items-center justify-center shrink-0">
                  <Download size={14} className="text-[#34d399]" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate text-foreground">{item.file_name}</p>
                  <p className="text-[10px] text-muted-foreground">{downloading ? 'Baixando...' : 'Clique para baixar'}</p>
                </div>
              </button>
            </div>
          )}

          {/* Tags */}
          {item.tags.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1"><Tag size={9} /> Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {item.tags.map(tag => (
                  <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] text-muted-foreground">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3">
            {item.author && (
              <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-1">Adicionado por</p>
                <p className="text-sm font-medium">{item.author}</p>
              </div>
            )}
            <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><Clock size={9} /> Adicionado</p>
              <p className="text-sm font-medium">{timeAgo(item.created_at)}</p>
            </div>
            {item.uses_count > 0 && (
              <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-3">
                <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1"><TrendingUp size={9} /> Usos</p>
                <p className="text-sm font-medium">{item.uses_count}×</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1a1a1a] flex items-center gap-2">
          {item.file_name && (
            <button onClick={downloadFile} disabled={downloading}
              className="flex items-center justify-center gap-2 border border-[#2a2a2a] hover:border-[#34d399]/40 hover:text-[#34d399] text-muted-foreground text-sm py-2.5 px-4 rounded-xl transition-colors">
              {downloading ? <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" /> : <Download size={14} />}
            </button>
          )}
          {(item.content || item.link) && (
            <button onClick={handleUse}
              className="flex-1 flex items-center justify-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar e usar</>}
            </button>
          )}
          {item.link && (
            <a href={item.link} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 border border-[#2a2a2a] hover:border-[#3a3a3a] text-sm font-medium py-2.5 px-4 rounded-xl transition-colors">
              <ExternalLink size={14} />
            </a>
          )}
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center justify-center gap-2 border border-[#2a2a2a] hover:border-[#ef4444]/40 hover:text-[#ef4444] text-muted-foreground text-sm py-2.5 px-4 rounded-xl transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {editing && (
        <EditItemModal
          item={item}
          onClose={() => setEditing(false)}
          onSaved={(updated) => { onUpdate(updated); setEditing(false) }}
        />
      )}
    </div>
  )
}

// ── Modal editar item ──────────────────────────────────────────────────────────
function EditItemModal({ item, onClose, onSaved }: {
  item: AIResource
  onClose: () => void
  onSaved: (updated: AIResource) => void
}) {
  const [form, setForm] = useState({
    title: item.title,
    description: item.description ?? '',
    category: item.category,
    content: item.content ?? '',
    link: item.link ?? '',
    tags: item.tags.join(', '),
    author: item.author ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [removingFile, setRemovingFile] = useState(false)
  const [currentFileName, setCurrentFileName] = useState(item.file_name)
  const fileRef = useRef<HTMLInputElement>(null)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)

    let file_path = item.file_path
    let file_name = currentFileName

    if (selectedFile) {
      const fd = new FormData()
      fd.append('file', selectedFile)
      const up = await fetch('/api/ia/upload', { method: 'POST', body: fd })
      if (up.ok) {
        const { path, name } = await up.json()
        file_path = path
        file_name = name
      }
    } else if (removingFile) {
      file_path = null
      file_name = null
    }

    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    const res = await fetch(`/api/ia/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, tags, file_path, file_name }),
    })
    if (res.ok) onSaved(await res.json())
    setSaving(false)
  }

  const selectedCat = getCat(form.category)
  const SelIcon = selectedCat.icon

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <form onSubmit={handleSubmit}
        className="relative bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1a1a1a]">
          <h3 className="text-base font-semibold">Editar recurso</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Categoria */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Categoria</p>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map(cat => {
                const CIcon = cat.icon
                const active = form.category === cat.key
                return (
                  <button key={cat.key} type="button" onClick={() => set('category', cat.key)}
                    className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-center transition-all"
                    style={{ borderColor: active ? cat.color + '60' : '#1f1f1f', background: active ? cat.bg : 'transparent' }}>
                    <CIcon size={14} style={{ color: active ? cat.color : '#555' }} strokeWidth={1.8} />
                    <span className="text-[10px]" style={{ color: active ? cat.color : '#555' }}>{cat.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Título */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Título *</p>
            <div className="flex items-center gap-2 bg-[#111111] border border-[#1f1f1f] rounded-xl px-3 py-2.5 focus-within:border-[#7c3aed]/50">
              <SelIcon size={14} style={{ color: selectedCat.color }} strokeWidth={1.8} />
              <input autoFocus value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="Nome do recurso" required
                className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none" />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Descrição</p>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={2} placeholder="Para que serve, como usar..."
              className="w-full bg-[#111111] border border-[#1f1f1f] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed]/50 placeholder:text-muted-foreground resize-none" />
          </div>

          {/* Conteúdo */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">
              {form.category === 'prompt' || form.category === 'template' ? 'Prompt / Template' : 'Conteúdo / Instruções'}
            </p>
            <textarea value={form.content} onChange={e => set('content', e.target.value)}
              rows={4} placeholder="Cole o prompt, instruções ou descrição detalhada..."
              className="w-full bg-[#111111] border border-[#1f1f1f] rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#7c3aed]/50 placeholder:text-muted-foreground resize-none" />
          </div>

          {/* Link */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Link externo</p>
            <input type="url" value={form.link} onChange={e => set('link', e.target.value)}
              placeholder="https://..."
              className="w-full bg-[#111111] border border-[#1f1f1f] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed]/50 placeholder:text-muted-foreground" />
          </div>

          {/* Tags + Autor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Tags</p>
              <input value={form.tags} onChange={e => set('tags', e.target.value)}
                placeholder="copywriting, social"
                className="w-full bg-[#111111] border border-[#1f1f1f] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed]/50 placeholder:text-muted-foreground" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Adicionado por</p>
              <input value={form.author} onChange={e => set('author', e.target.value)}
                placeholder="Seu nome"
                className="w-full bg-[#111111] border border-[#1f1f1f] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed]/50 placeholder:text-muted-foreground" />
            </div>
          </div>

          {/* Arquivo */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Arquivo anexo <span className="normal-case">(opcional)</span></p>
            <input ref={fileRef} type="file" className="hidden"
              onChange={e => { setSelectedFile(e.target.files?.[0] ?? null); setRemovingFile(false) }} />
            {selectedFile ? (
              <div className="flex items-center gap-3 bg-[#111111] border border-[#34d399]/30 rounded-xl px-3 py-2.5">
                <Paperclip size={13} className="text-[#34d399] shrink-0" />
                <span className="flex-1 text-sm truncate">{selectedFile.name}</span>
                <button type="button" onClick={() => { setSelectedFile(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="text-muted-foreground hover:text-foreground transition-colors"><X size={13} /></button>
              </div>
            ) : currentFileName && !removingFile ? (
              <div className="flex items-center gap-3 bg-[#111111] border border-[#1f1f1f] rounded-xl px-3 py-2.5">
                <Paperclip size={13} className="text-[#34d399] shrink-0" />
                <span className="flex-1 text-sm truncate">{currentFileName}</span>
                <button type="button" onClick={() => setRemovingFile(true)}
                  className="text-muted-foreground hover:text-[#ef4444] transition-colors" title="Remover arquivo"><X size={13} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => { fileRef.current?.click(); setRemovingFile(false) }}
                className="w-full flex items-center gap-2 bg-[#111111] border border-dashed border-[#2a2a2a] hover:border-[#34d399]/30 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Paperclip size={13} />
                {removingFile ? 'Selecionar novo arquivo' : 'Selecionar arquivo (CSV, PDF, imagem...)'}
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#1a1a1a] flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 border border-[#2a2a2a] text-sm py-2.5 rounded-xl hover:bg-[#111] transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saving || !form.title.trim()}
            className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Check size={14} /> Salvar</>}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Modal novo item ────────────────────────────────────────────────────────────
function NewItemModal({ authorName, onClose, onCreated }: {
  authorName: string
  onClose: () => void
  onCreated: (item: AIResource) => void
}) {
  const [form, setForm] = useState({
    title: '', description: '', category: 'prompt',
    content: '', link: '', tags: '', author: authorName,
  })
  const [saving, setSaving] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setSaving(true)

    let file_path: string | null = null
    let file_name: string | null = null
    if (selectedFile) {
      const fd = new FormData()
      fd.append('file', selectedFile)
      const up = await fetch('/api/ia/upload', { method: 'POST', body: fd })
      if (up.ok) {
        const { path, name } = await up.json()
        file_path = path
        file_name = name
      }
    }

    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
    const res = await fetch('/api/ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, tags, file_path, file_name }),
    })
    if (res.ok) {
      onCreated(await res.json())
      onClose()
    }
    setSaving(false)
  }

  const selectedCat = getCat(form.category)
  const SelIcon = selectedCat.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <form onSubmit={handleSubmit}
        className="relative bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#1a1a1a]">
          <h3 className="text-base font-semibold">Novo recurso de IA</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Categoria */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Categoria</p>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map(cat => {
                const CIcon = cat.icon
                const active = form.category === cat.key
                return (
                  <button key={cat.key} type="button" onClick={() => set('category', cat.key)}
                    className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-center transition-all"
                    style={{
                      borderColor: active ? cat.color + '60' : '#1f1f1f',
                      background: active ? cat.bg : 'transparent',
                    }}>
                    <CIcon size={14} style={{ color: active ? cat.color : '#555' }} strokeWidth={1.8} />
                    <span className="text-[10px]" style={{ color: active ? cat.color : '#555' }}>{cat.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Título */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Título *</p>
            <div className="flex items-center gap-2 bg-[#111111] border border-[#1f1f1f] rounded-xl px-3 py-2.5 focus-within:border-[#7c3aed]/50">
              <SelIcon size={14} style={{ color: selectedCat.color }} strokeWidth={1.8} />
              <input autoFocus value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="Nome do recurso" required
                className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none" />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Descrição</p>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              rows={2} placeholder="Para que serve, como usar..."
              className="w-full bg-[#111111] border border-[#1f1f1f] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed]/50 placeholder:text-muted-foreground resize-none" />
          </div>

          {/* Conteúdo / Prompt */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">
              {form.category === 'prompt' || form.category === 'template' ? 'Prompt / Template' : 'Conteúdo / Instruções'}
            </p>
            <textarea value={form.content} onChange={e => set('content', e.target.value)}
              rows={4} placeholder="Cole o prompt, instruções ou descrição detalhada..."
              className="w-full bg-[#111111] border border-[#1f1f1f] rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#7c3aed]/50 placeholder:text-muted-foreground resize-none" />
          </div>

          {/* Link */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Link externo</p>
            <input type="url" value={form.link} onChange={e => set('link', e.target.value)}
              placeholder="https://chatgpt.com/g/... ou Make, Zapier, etc."
              className="w-full bg-[#111111] border border-[#1f1f1f] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed]/50 placeholder:text-muted-foreground" />
          </div>

          {/* Tags + Autor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Tags</p>
              <input value={form.tags} onChange={e => set('tags', e.target.value)}
                placeholder="copywriting, social, ads"
                className="w-full bg-[#111111] border border-[#1f1f1f] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed]/50 placeholder:text-muted-foreground" />
              <p className="text-[9px] text-muted-foreground mt-1">separadas por vírgula</p>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Adicionado por</p>
              <input value={form.author} onChange={e => set('author', e.target.value)}
                placeholder="Seu nome"
                className="w-full bg-[#111111] border border-[#1f1f1f] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed]/50 placeholder:text-muted-foreground" />
            </div>
          </div>

          {/* Arquivo anexo */}
          <div>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Arquivo anexo <span className="normal-case">(opcional)</span></p>
            <input ref={fileRef} type="file" className="hidden"
              onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} />
            {selectedFile ? (
              <div className="flex items-center gap-3 bg-[#111111] border border-[#34d399]/30 rounded-xl px-3 py-2.5">
                <Paperclip size={13} className="text-[#34d399] shrink-0" />
                <span className="flex-1 text-sm truncate">{selectedFile.name}</span>
                <button type="button" onClick={() => { setSelectedFile(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="text-muted-foreground hover:text-foreground transition-colors">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full flex items-center gap-2 bg-[#111111] border border-dashed border-[#2a2a2a] hover:border-[#34d399]/30 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Paperclip size={13} />
                Selecionar arquivo (CSV, PDF, imagem...)
              </button>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#1a1a1a] flex gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 border border-[#2a2a2a] text-sm py-2.5 rounded-xl hover:bg-[#111] transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saving || !form.title.trim()}
            className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white text-sm font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Plus size={14} /> Adicionar</>}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function IAPage() {
  const [items, setItems]         = useState<AIResource[]>([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [activecat, setActivecat] = useState('todos')
  const [selected, setSelected]   = useState<AIResource | null>(null)
  const [showNew, setShowNew]     = useState(false)
  const [authorName, setAuthorName] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/ia').then(r => r.json()).then(d => {
      setItems(Array.isArray(d) ? d : [])
      setLoading(false)
    })
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const role = getRole(user?.email)
      setAuthorName(ROLE_NAME[role] || user?.email?.split('@')[0] || '')
    })
  }, [])

  // Filtro
  const filtered = items.filter(item => {
    const matchCat = activecat === 'todos' || item.category === activecat
    const q = search.toLowerCase()
    const matchSearch = !q || item.title.toLowerCase().includes(q)
      || item.description?.toLowerCase().includes(q)
      || item.content?.toLowerCase().includes(q)
      || item.tags.some(t => t.toLowerCase().includes(q))
    return matchCat && matchSearch
  })

  const featured  = items.filter(i => i.featured)
  const recent    = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3)
  const mostUsed  = [...items].filter(i => i.uses_count > 0).sort((a, b) => b.uses_count - a.uses_count).slice(0, 3)

  function onCreated(item: AIResource) {
    setItems(prev => [item, ...prev])
  }
  function onUpdate(updated: AIResource) {
    setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
    setSelected(prev => prev?.id === updated.id ? updated : prev)
  }
  function onDelete(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    setSelected(null)
  }
  function onToggleFeatured(item: AIResource) {
    fetch(`/api/ia/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featured: !item.featured }),
    }).then(r => r.json()).then(onUpdate)
  }

  // Contagens por categoria
  const counts = CATEGORIES.reduce((acc, cat) => {
    acc[cat.key] = items.filter(i => i.category === cat.key).length
    return acc
  }, {} as Record<string, number>)

  return (
    <>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#f472b6] flex items-center justify-center">
                <Brain size={16} className="text-white" strokeWidth={1.8} />
              </div>
              <h1 className="text-xl font-semibold tracking-tight">Central de IA</h1>
            </div>
            <p className="text-sm text-muted-foreground">Prompts, GPTs, automações e tudo que a equipe descobre.</p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
            <Plus size={15} /> Adicionar
          </button>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar prompts, ferramentas, automações..."
            className="w-full bg-[#111111] border border-[#1f1f1f] rounded-2xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[#7c3aed]/40 placeholder:text-muted-foreground transition-colors" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Destaques — só aparece quando não tem busca/filtro ativo */}
        {!search && activecat === 'todos' && (featured.length > 0 || recent.length > 0 || mostUsed.length > 0) && (
          <div className="space-y-6">
            {/* Em destaque */}
            {featured.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Star size={13} className="text-[#fbbf24] fill-[#fbbf24]" />
                  <h2 className="text-sm font-medium">Em destaque</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {featured.map(item => (
                    <ResourceCard key={item.id} item={item} onClick={() => setSelected(item)} onToggleFeatured={onToggleFeatured} />
                  ))}
                </div>
              </div>
            )}

            {/* Linha divisória + mais usados + recentes */}
            {(mostUsed.length > 0 || recent.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {mostUsed.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp size={13} className="text-[#34d399]" />
                      <h2 className="text-sm font-medium">Mais usados</h2>
                    </div>
                    <div className="space-y-2">
                      {mostUsed.map((item, i) => {
                        const cat = getCat(item.category)
                        const CIcon = cat.icon
                        return (
                          <div key={item.id} onClick={() => setSelected(item)}
                            className="flex items-center gap-3 bg-[#111111] border border-[#1f1f1f] rounded-xl px-4 py-3 cursor-pointer hover:border-[#2a2a2a] transition-colors group">
                            <span className="text-[11px] text-muted-foreground w-4">{i + 1}</span>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: cat.bg }}>
                              <CIcon size={13} style={{ color: cat.color }} strokeWidth={1.8} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.title}</p>
                              <p className="text-[10px] text-muted-foreground">{item.uses_count} uso{item.uses_count !== 1 ? 's' : ''}</p>
                            </div>
                            <ChevronRight size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {recent.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Clock size={13} className="text-[#60a5fa]" />
                      <h2 className="text-sm font-medium">Adicionados recentemente</h2>
                    </div>
                    <div className="space-y-2">
                      {recent.map(item => {
                        const cat = getCat(item.category)
                        const CIcon = cat.icon
                        return (
                          <div key={item.id} onClick={() => setSelected(item)}
                            className="flex items-center gap-3 bg-[#111111] border border-[#1f1f1f] rounded-xl px-4 py-3 cursor-pointer hover:border-[#2a2a2a] transition-colors group">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: cat.bg }}>
                              <CIcon size={13} style={{ color: cat.color }} strokeWidth={1.8} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.title}</p>
                              <p className="text-[10px] text-muted-foreground">{timeAgo(item.created_at)} · {cat.label}</p>
                            </div>
                            {item.author && <span className="text-[10px] text-muted-foreground shrink-0">{item.author}</span>}
                            <ChevronRight size={13} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {items.length > 0 && <div className="border-t border-[#1a1a1a]" />}
          </div>
        )}

        {/* Filtro por categoria */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button onClick={() => setActivecat('todos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
              activecat === 'todos' ? 'bg-[#7c3aed]/15 text-[#a78bfa] border border-[#7c3aed]/30' : 'bg-[#111111] border border-[#1f1f1f] text-muted-foreground hover:text-foreground'
            }`}>
            Todos <span className="opacity-60">{items.length}</span>
          </button>
          {CATEGORIES.map(cat => {
            const CIcon = cat.icon
            const active = activecat === cat.key
            return (
              <button key={cat.key} onClick={() => setActivecat(active ? 'todos' : cat.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 border"
                style={{
                  background:   active ? cat.bg : '#111111',
                  borderColor:  active ? cat.color + '40' : '#1f1f1f',
                  color:        active ? cat.color : '#888',
                }}>
                <CIcon size={11} strokeWidth={1.8} />
                {cat.label}
                {counts[cat.key] > 0 && <span style={{ opacity: 0.6 }}>{counts[cat.key]}</span>}
              </button>
            )
          })}
        </div>

        {/* Grid principal */}
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#111111] border border-[#1f1f1f] flex items-center justify-center mb-3">
              <Brain size={22} className="text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium mb-1">
              {search ? 'Nenhum resultado' : 'Biblioteca vazia'}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {search ? `Nada encontrado para "${search}"` : 'Adicione o primeiro recurso de IA da equipe'}
            </p>
            {!search && (
              <button onClick={() => setShowNew(true)}
                className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
                <Plus size={14} /> Adicionar primeiro
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(item => (
              <ResourceCard key={item.id} item={item} onClick={() => setSelected(item)} onToggleFeatured={onToggleFeatured} />
            ))}
          </div>
        )}
      </div>

      {/* Painel lateral */}
      {selected && (
        <ResourcePanel
          item={selected}
          onClose={() => setSelected(null)}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      )}

      {/* Modal novo */}
      {showNew && (
        <NewItemModal
          authorName={authorName}
          onClose={() => setShowNew(false)}
          onCreated={onCreated}
        />
      )}
    </>
  )
}
