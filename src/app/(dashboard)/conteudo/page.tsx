'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Plus, X, ChevronLeft, ChevronRight, List, CalendarDays,
  Trash2, BarChart2,
} from 'lucide-react'
import { formatDate } from '@/lib/utils/format'

// ── tipos ──────────────────────────────────────────────────────────────────────
interface Client { id: string; name: string; status: string }

interface ContentPost {
  id: string
  client_id: string
  title: string
  caption: string | null
  platform: string
  status: string
  scheduled_date: string | null
  published_at: string | null
  responsible: string | null
  result: Record<string, number>
  notes: string | null
  media_url: string | null
  created_at: string
  clients?: { id: string; name: string } | null
}

// ── constantes ─────────────────────────────────────────────────────────────────
const PLATFORMS = [
  { key: 'instagram',  label: 'Instagram',   color: '#e1306c' },
  { key: 'facebook',   label: 'Facebook',    color: '#1877f2' },
  { key: 'linkedin',   label: 'LinkedIn',    color: '#0a66c2' },
  { key: 'tiktok',     label: 'TikTok',      color: '#69c9d0' },
  { key: 'youtube',    label: 'YouTube',     color: '#ff4444' },
  { key: 'twitter',    label: 'Twitter/X',   color: '#94a3b8' },
  { key: 'pinterest',  label: 'Pinterest',   color: '#e60023' },
  { key: 'google_ads', label: 'Google Ads',  color: '#4285f4' },
  { key: 'email',      label: 'E-mail',      color: '#8b5cf6' },
]

const STATUSES = [
  { key: 'rascunho',              label: 'Rascunho',              color: '#6b7280' },
  { key: 'em_criacao',            label: 'Em criação',            color: '#f59e0b' },
  { key: 'aguardando_aprovacao',  label: 'Aguardando aprovação',  color: '#3b82f6' },
  { key: 'aprovado',              label: 'Aprovado',              color: '#8b5cf6' },
  { key: 'agendado',              label: 'Agendado',              color: '#06b6d4' },
  { key: 'publicado',             label: 'Publicado',             color: '#22c55e' },
  { key: 'reprovado',             label: 'Reprovado',             color: '#ef4444' },
]

const PARTNERS = ['Gustavo', 'Gabriel', 'Thomas']

type ResultField = { key: string; label: string }
const RESULT_FIELDS: Record<string, ResultField[]> = {
  instagram:  [
    { key: 'curtidas', label: 'Curtidas' }, { key: 'comentarios', label: 'Comentários' },
    { key: 'compartilhamentos', label: 'Compartilhamentos' }, { key: 'alcance', label: 'Alcance' },
    { key: 'impressoes', label: 'Impressões' }, { key: 'salvamentos', label: 'Salvamentos' },
  ],
  facebook:   [
    { key: 'curtidas', label: 'Curtidas' }, { key: 'comentarios', label: 'Comentários' },
    { key: 'compartilhamentos', label: 'Compartilhamentos' }, { key: 'alcance', label: 'Alcance' },
    { key: 'impressoes', label: 'Impressões' }, { key: 'cliques', label: 'Cliques' },
  ],
  linkedin:   [
    { key: 'curtidas', label: 'Curtidas' }, { key: 'comentarios', label: 'Comentários' },
    { key: 'compartilhamentos', label: 'Compartilhamentos' }, { key: 'visualizacoes', label: 'Visualizações' },
    { key: 'cliques', label: 'Cliques' },
  ],
  tiktok:     [
    { key: 'curtidas', label: 'Curtidas' }, { key: 'comentarios', label: 'Comentários' },
    { key: 'compartilhamentos', label: 'Compartilhamentos' }, { key: 'visualizacoes', label: 'Visualizações' },
    { key: 'salvamentos', label: 'Salvamentos' },
  ],
  youtube:    [
    { key: 'visualizacoes', label: 'Visualizações' }, { key: 'curtidas', label: 'Curtidas' },
    { key: 'comentarios', label: 'Comentários' }, { key: 'inscritos_ganhos', label: 'Inscritos ganhos' },
    { key: 'tempo_assistido', label: 'Tempo assistido (min)' },
  ],
  twitter:    [
    { key: 'curtidas', label: 'Curtidas' }, { key: 'retweets', label: 'Retweets' },
    { key: 'respostas', label: 'Respostas' }, { key: 'impressoes', label: 'Impressões' },
    { key: 'cliques', label: 'Cliques' },
  ],
  pinterest:  [
    { key: 'salvamentos', label: 'Salvamentos' }, { key: 'cliques', label: 'Cliques' },
    { key: 'impressoes', label: 'Impressões' },
  ],
  google_ads: [
    { key: 'cliques', label: 'Cliques' }, { key: 'impressoes', label: 'Impressões' },
    { key: 'conversoes', label: 'Conversões' }, { key: 'ctr', label: 'CTR (%)' },
  ],
  email:      [
    { key: 'enviados', label: 'Enviados' }, { key: 'aberturas', label: 'Aberturas' },
    { key: 'cliques', label: 'Cliques' }, { key: 'descadastros', label: 'Descadastros' },
  ],
}
const DEFAULT_RESULT_FIELDS: ResultField[] = [
  { key: 'alcance', label: 'Alcance' }, { key: 'impressoes', label: 'Impressões' }, { key: 'cliques', label: 'Cliques' },
]

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAY_NAMES   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

// ── helpers ────────────────────────────────────────────────────────────────────
function pColor(key: string)  { return PLATFORMS.find(p => p.key === key)?.color ?? '#6b7280' }
function pLabel(key: string)  { return PLATFORMS.find(p => p.key === key)?.label ?? key }
function sInfo(key: string)   { return STATUSES.find(s => s.key === key) ?? { key, label: key, color: '#6b7280' } }
function postDate(post: ContentPost) {
  return post.scheduled_date ?? (post.published_at ? post.published_at.split('T')[0] : null)
}

// ── PostPanel ──────────────────────────────────────────────────────────────────
function PostPanel({ post, clients, onClose, onSaved, onDeleted }: {
  post: ContentPost
  clients: Client[]
  onClose: () => void
  onSaved: (p: ContentPost) => void
  onDeleted: () => void
}) {
  const [form, setForm]       = useState({ ...post })
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isMounted = useRef(true)
  useEffect(() => () => { isMounted.current = false }, [])

  const resultFields = RESULT_FIELDS[form.platform] ?? DEFAULT_RESULT_FIELDS

  async function save(patch: Partial<ContentPost> = {}) {
    setSaving(true)
    const merged = { ...form, ...patch }
    const res = await fetch(`/api/content/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    })
    if (!isMounted.current) return
    if (res.ok) { const u = await res.json(); setForm(u); onSaved(u) }
    setSaving(false)
  }

  async function del() {
    if (!confirm(`Apagar o post "${post.title}"?`)) return
    setDeleting(true)
    await fetch(`/api/content/${post.id}`, { method: 'DELETE' })
    onDeleted()
  }

  const si = sInfo(form.status)

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="absolute right-0 top-0 h-full w-full max-w-lg bg-[#111111] border-l border-[#2a2a2a] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2a2a2a] shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: pColor(form.platform) }} />
            <span className="text-xs font-medium" style={{ color: pColor(form.platform) }}>{pLabel(form.platform)}</span>
            <span className="text-xs px-2 py-0.5 rounded-full ml-2 font-medium" style={{ background: si.color + '22', color: si.color }}>
              {si.label}
            </span>
            {saving && <div className="w-3 h-3 border border-[#7c3aed] border-t-transparent rounded-full animate-spin ml-2" />}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* título */}
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            onBlur={() => save()}
            placeholder="Título do post"
            className="w-full text-lg font-semibold bg-transparent border-b border-[#2a2a2a] pb-2 focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/30"
          />

          {/* meta grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* plataforma */}
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Plataforma</label>
              <select
                value={form.platform}
                onChange={e => { setForm(f => ({ ...f, platform: e.target.value })); save({ platform: e.target.value }) }}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                {PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            {/* status */}
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Status</label>
              <select
                value={form.status}
                onChange={e => { setForm(f => ({ ...f, status: e.target.value })); save({ status: e.target.value }) }}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
                style={{ color: si.color }}
              >
                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            {/* cliente */}
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Cliente</label>
              <select
                value={form.client_id}
                onChange={e => { setForm(f => ({ ...f, client_id: e.target.value })); save({ client_id: e.target.value }) }}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {/* responsável */}
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Responsável</label>
              <select
                value={form.responsible ?? ''}
                onChange={e => { setForm(f => ({ ...f, responsible: e.target.value || null })); save({ responsible: e.target.value || null }) }}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                <option value="">Sem responsável</option>
                {PARTNERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            {/* data agendada */}
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Data agendada</label>
              <input
                type="date"
                value={form.scheduled_date ?? ''}
                onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value || null }))}
                onBlur={() => save()}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              />
            </div>
            {/* data publicação */}
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Data publicação</label>
              <input
                type="date"
                value={form.published_at ? form.published_at.split('T')[0] : ''}
                onChange={e => setForm(f => ({ ...f, published_at: e.target.value ? e.target.value + 'T00:00:00Z' : null }))}
                onBlur={() => save()}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              />
            </div>
          </div>

          {/* imagem */}
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Imagem (URL)</label>
            <input
              type="url"
              value={form.media_url ?? ''}
              onChange={e => setForm(f => ({ ...f, media_url: e.target.value || null }))}
              onBlur={() => save()}
              placeholder="https://... (Canva, Drive, Dropbox, Imgur...)"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/40"
            />
            {form.media_url && (
              <div className="mt-2 relative rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#1a1a1a]">
                <img
                  src={form.media_url}
                  alt="Prévia"
                  className="w-full max-h-64 object-contain"
                  onError={e => { (e.currentTarget.parentElement as HTMLElement).style.display = 'none' }}
                />
              </div>
            )}
          </div>

          {/* legenda */}
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Legenda</label>
            <textarea
              value={form.caption ?? ''}
              onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
              onBlur={() => save()}
              rows={5}
              placeholder="Escreva a legenda do post aqui..."
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors resize-none placeholder:text-muted-foreground/40"
            />
          </div>

          {/* notas internas */}
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Notas internas</label>
            <textarea
              value={form.notes ?? ''}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              onBlur={() => save()}
              rows={2}
              placeholder="Briefing, links de referência, observações..."
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors resize-none placeholder:text-muted-foreground/40"
            />
          </div>

          {/* resultados */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart2 size={13} className="text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Resultados</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {resultFields.map(field => (
                <div key={field.key}>
                  <label className="block text-[10px] text-muted-foreground mb-1">{field.label}</label>
                  <input
                    type="number"
                    min="0"
                    value={form.result?.[field.key] ?? ''}
                    onChange={e => setForm(f => ({
                      ...f,
                      result: { ...f.result, [field.key]: e.target.value === '' ? 0 : Number(e.target.value) },
                    }))}
                    onBlur={() => save()}
                    placeholder="0"
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/30"
                  />
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-[#2a2a2a] shrink-0 flex items-center justify-between">
          <button
            onClick={del}
            disabled={deleting}
            className="flex items-center gap-2 text-xs text-muted-foreground/50 hover:text-[#ef4444] transition-colors"
          >
            <Trash2 size={13} />
            {deleting ? 'Apagando...' : 'Apagar post'}
          </button>
          {!saving && <span className="text-[10px] text-muted-foreground/40">Auto-salvo</span>}
        </div>
      </div>
    </div>
  )
}

// ── NewPostModal ───────────────────────────────────────────────────────────────
function NewPostModal({ clients, activeClientId, onClose, onCreated }: {
  clients: Client[]
  activeClientId: string | null
  onClose: () => void
  onCreated: (p: ContentPost) => void
}) {
  const [form, setForm] = useState({
    client_id:      activeClientId ?? clients[0]?.id ?? '',
    title:          '',
    platform:       'instagram',
    status:         'rascunho',
    scheduled_date: '',
    responsible:    '',
    caption:        '',
  })
  const [saving, setSaving] = useState(false)

  async function create() {
    if (!form.title.trim() || !form.client_id) return
    setSaving(true)
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        scheduled_date: form.scheduled_date || null,
        responsible:    form.responsible    || null,
        caption:        form.caption        || null,
        result: {},
      }),
    })
    if (res.ok) { const post = await res.json(); onCreated(post) }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold">Novo Post</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Título</label>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && create()}
              autoFocus
              placeholder="Ex: Feed semana 3 — Campanha verão"
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/40"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Cliente</label>
              <select
                value={form.client_id}
                onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Plataforma</label>
              <select
                value={form.platform}
                onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                {PLATFORMS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Responsável</label>
              <select
                value={form.responsible}
                onChange={e => setForm(f => ({ ...f, responsible: e.target.value }))}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                <option value="">Sem responsável</option>
                {PARTNERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Data agendada</label>
            <input
              type="date"
              value={form.scheduled_date}
              onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Legenda (opcional)</label>
            <textarea
              value={form.caption}
              onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
              rows={2}
              placeholder="Prévia da legenda..."
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors resize-none placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-[#2a2a2a] rounded-lg transition-colors">
            Cancelar
          </button>
          <button
            onClick={create}
            disabled={saving || !form.title.trim() || !form.client_id}
            className="flex-1 py-2.5 text-sm bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg transition-colors disabled:opacity-40 font-medium"
          >
            {saving ? 'Criando...' : 'Criar Post'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ContentCalendar ────────────────────────────────────────────────────────────
function ContentCalendar({ posts, month, year, onPostClick }: {
  posts: ContentPost[]
  month: number
  year: number
  onPostClick: (p: ContentPost) => void
}) {
  const firstDay    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today       = new Date()

  const byDay: Record<number, ContentPost[]> = {}
  for (const post of posts) {
    const d = postDate(post)
    if (!d) continue
    const [y, m, day] = d.split('-').map(Number)
    if (y === year && m - 1 === month) {
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(post)
    }
  }

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl overflow-hidden">
      {/* day headers */}
      <div className="grid grid-cols-7 border-b border-[#1f1f1f]">
        {DAY_NAMES.map(d => (
          <div key={d} className="text-center text-[10px] text-muted-foreground uppercase tracking-wider py-3">
            {d}
          </div>
        ))}
      </div>
      {/* cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const isLast = i % 7 === 6
          return (
            <div
              key={i}
              className={`min-h-[110px] p-1.5 border-b border-[#1a1a1a] ${isLast ? '' : 'border-r border-r-[#1a1a1a]'} ${day ? '' : 'bg-[#0c0c0c]'}`}
            >
              {day && (
                <>
                  <div className={`text-[11px] w-5 h-5 flex items-center justify-center rounded-full mb-1 font-medium ${
                    isToday(day) ? 'bg-[#7c3aed] text-white' : 'text-muted-foreground'
                  }`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {(byDay[day] ?? []).slice(0, 3).map(post => (
                      <button
                        key={post.id}
                        onClick={() => onPostClick(post)}
                        className="w-full text-left rounded overflow-hidden hover:opacity-80 transition-opacity"
                        style={{ background: pColor(post.platform) + '22' }}
                        title={`${post.title} · ${sInfo(post.status).label}`}
                      >
                        {post.media_url && (
                          <img
                            src={post.media_url}
                            alt=""
                            className="w-full h-14 object-cover"
                            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                          />
                        )}
                        <p
                          className="text-[10px] px-1.5 py-0.5 truncate leading-tight font-medium"
                          style={{ color: pColor(post.platform) }}
                        >
                          {post.title}
                        </p>
                      </button>
                    ))}
                    {(byDay[day]?.length ?? 0) > 3 && (
                      <p className="text-[9px] text-muted-foreground pl-1">
                        +{(byDay[day]?.length ?? 0) - 3} mais
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── ContentList ────────────────────────────────────────────────────────────────
function ContentList({ posts, showClient, onPostClick }: {
  posts: ContentPost[]
  showClient: boolean
  onPostClick: (p: ContentPost) => void
}) {
  if (posts.length === 0) {
    return (
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl flex items-center justify-center h-40">
        <p className="text-sm text-muted-foreground">Nenhum post encontrado</p>
      </div>
    )
  }

  const sorted = [...posts].sort((a, b) => {
    const da = postDate(a) ?? a.created_at
    const db = postDate(b) ?? b.created_at
    return db.localeCompare(da)
  })

  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl overflow-hidden">
      <div className="divide-y divide-[#1a1a1a]">
        {sorted.map(post => {
          const si   = sInfo(post.status)
          const date = postDate(post)
          const hasResults = post.result && Object.values(post.result).some(v => v > 0)
          const topResults = hasResults
            ? Object.entries(post.result).filter(([, v]) => v > 0).slice(0, 3)
            : []
          const rf = RESULT_FIELDS[post.platform] ?? DEFAULT_RESULT_FIELDS

          return (
            <button
              key={post.id}
              onClick={() => onPostClick(post)}
              className="w-full px-5 py-4 hover:bg-[#1a1a1a] transition-colors text-left flex items-center gap-4"
            >
              {/* plataforma */}
              <span
                className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: pColor(post.platform) + '28', color: pColor(post.platform) }}
              >
                {pLabel(post.platform)}
              </span>

              {/* main */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{post.title}</p>
                  {showClient && post.clients && (
                    <span className="text-[10px] text-muted-foreground/60 shrink-0">{post.clients.name}</span>
                  )}
                </div>
                {post.caption && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{post.caption}</p>
                )}
                {topResults.length > 0 && (
                  <p className="text-[10px] text-[#22c55e] mt-0.5">
                    {topResults.map(([k, v]) => {
                      const label = rf.find(f => f.key === k)?.label ?? k
                      return `${v.toLocaleString('pt-BR')} ${label.toLowerCase()}`
                    }).join(' · ')}
                  </p>
                )}
              </div>

              {/* status */}
              <span
                className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ background: si.color + '22', color: si.color }}
              >
                {si.label}
              </span>

              {/* data */}
              <span className="shrink-0 text-xs text-muted-foreground w-[80px] text-right">
                {date ? formatDate(date) : '—'}
              </span>

              {/* responsável */}
              <span className="shrink-0 text-xs text-muted-foreground w-[80px] text-right">
                {post.responsible ?? '—'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── ConteudoPage ───────────────────────────────────────────────────────────────
export default function ConteudoPage() {
  const [clients, setClients]         = useState<Client[]>([])
  const [posts, setPosts]             = useState<ContentPost[]>([])
  const [loading, setLoading]         = useState(true)
  const [activeClient, setActiveClient] = useState<string>('todos')
  const [viewMode, setViewMode]       = useState<'calendario' | 'lista'>('calendario')
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null)
  const [showNew, setShowNew]           = useState(false)

  const loadClients = useCallback(async () => {
    const res = await fetch('/api/clients').catch(() => null)
    if (!res?.ok) return
    const data = await res.json()
    setClients(Array.isArray(data) ? data : [])
  }, [])

  const loadPosts = useCallback(async (clientId: string) => {
    setLoading(true)
    const url = clientId === 'todos' ? '/api/content' : `/api/content?client_id=${clientId}`
    const res = await fetch(url).catch(() => null)
    if (res?.ok) { const d = await res.json(); setPosts(Array.isArray(d) ? d : []) }
    setLoading(false)
  }, [])

  useEffect(() => { loadClients() }, [loadClients])
  useEffect(() => { loadPosts(activeClient) }, [activeClient, loadPosts])

  function onSaved(updated: ContentPost) {
    setPosts(ps => ps.map(p => p.id === updated.id ? updated : p))
    setSelectedPost(prev => prev?.id === updated.id ? updated : prev)
  }

  function onDeleted() {
    if (selectedPost) setPosts(ps => ps.filter(p => p.id !== selectedPost.id))
    setSelectedPost(null)
  }

  function onCreated(post: ContentPost) {
    // Refresh the tab if it's "todos" or the matching client
    if (activeClient === 'todos' || activeClient === post.client_id) {
      setPosts(ps => [post, ...ps])
    }
    setShowNew(false)
    setSelectedPost(post)
  }

  function prevMonth() {
    setCurrentMonth(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    )
  }
  function nextMonth() {
    setCurrentMonth(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    )
  }

  const isAllClients    = activeClient === 'todos'
  const activeClientObj = clients.find(c => c.id === activeClient)

  // KPI (all loaded posts)
  const kpis = {
    total:     posts.length,
    publicado: posts.filter(p => p.status === 'publicado').length,
    agendado:  posts.filter(p => p.status === 'agendado').length,
    aprovado:  posts.filter(p => p.status === 'aprovado').length,
    aguardando: posts.filter(p => p.status === 'aguardando_aprovacao').length,
  }

  return (
    <>

          {/* header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Central de Conteúdo</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isAllClients ? 'Todos os clientes' : activeClientObj?.name ?? ''}
              </p>
            </div>
            <button
              onClick={() => setShowNew(true)}
              className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm px-4 py-2.5 rounded-xl transition-colors font-medium"
            >
              <Plus size={16} />
              Novo Post
            </button>
          </div>

          {/* client tabs */}
          <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {/* Todos */}
            <button
              onClick={() => setActiveClient('todos')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors shrink-0 ${
                isAllClients
                  ? 'bg-[#7c3aed]/15 text-[#a78bfa] font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a]'
              }`}
            >
              Todos
              {isAllClients && (
                <span className="text-[10px] bg-[#7c3aed]/20 text-[#a78bfa] px-1.5 py-0.5 rounded-full">
                  {kpis.total}
                </span>
              )}
            </button>
            {/* one tab per client */}
            {clients.map(client => {
              const isActive = activeClient === client.id
              const count = isAllClients
                ? posts.filter(p => p.client_id === client.id).length
                : (isActive ? posts.length : 0)
              return (
                <button
                  key={client.id}
                  onClick={() => setActiveClient(client.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors shrink-0 ${
                    isActive
                      ? 'bg-[#7c3aed]/15 text-[#a78bfa] font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a]'
                  }`}
                >
                  {client.name}
                  {(isActive || isAllClients) && count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-[#7c3aed]/20 text-[#a78bfa]' : 'bg-[#2a2a2a] text-muted-foreground'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Total de posts',      value: kpis.total,      color: '#a78bfa' },
              { label: 'Publicados',           value: kpis.publicado,  color: '#22c55e' },
              { label: 'Agendados',            value: kpis.agendado,   color: '#06b6d4' },
              { label: 'Aprovados',            value: kpis.aprovado,   color: '#8b5cf6' },
              { label: 'Aguard. aprovação',    value: kpis.aguardando, color: '#3b82f6' },
            ].map(card => (
              <div key={card.label} className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
                <p className="text-[11px] text-muted-foreground mb-1">{card.label}</p>
                <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center bg-[#111111] border border-[#1f1f1f] rounded-lg p-1 gap-1">
              <button
                onClick={() => setViewMode('calendario')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  viewMode === 'calendario'
                    ? 'bg-[#7c3aed]/15 text-[#a78bfa]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CalendarDays size={14} />
                Calendário
              </button>
              <button
                onClick={() => setViewMode('lista')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  viewMode === 'lista'
                    ? 'bg-[#7c3aed]/15 text-[#a78bfa]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <List size={14} />
                Lista
              </button>
            </div>

            {viewMode === 'calendario' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={prevMonth}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] rounded-lg transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium w-[160px] text-center">
                  {MONTH_NAMES[currentMonth.month]} {currentMonth.year}
                </span>
                <button
                  onClick={nextMonth}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] rounded-lg transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          {/* content area */}
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : viewMode === 'calendario' ? (
            <ContentCalendar
              posts={posts}
              month={currentMonth.month}
              year={currentMonth.year}
              onPostClick={setSelectedPost}
            />
          ) : (
            <ContentList
              posts={posts}
              showClient={isAllClients}
              onPostClick={setSelectedPost}
            />
          )}

      {selectedPost && (
        <PostPanel
          post={selectedPost}
          clients={clients}
          onClose={() => setSelectedPost(null)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}

      {showNew && (
        <NewPostModal
          clients={clients}
          activeClientId={isAllClients ? null : activeClient}
          onClose={() => setShowNew(false)}
          onCreated={onCreated}
        />
      )}
    </>
  )
}
