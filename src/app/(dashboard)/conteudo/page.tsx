'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Plus, X, ChevronLeft, ChevronRight, List, CalendarDays,
  Trash2, BarChart2, TrendingUp, ImageIcon, Share2, Copy, Check, RefreshCw,
  Download, Play,
} from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid,
} from 'recharts'

// â"€â"€ tipos â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
interface Client { id: string; name: string; status: string }

interface ContentPost {
  id: string
  client_id: string | null
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
  media_urls: string[] | null
  rejection_reason: string | null
  created_at: string
  clients?: { id: string; name: string } | null
}

// â"€â"€ constantes â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

const PARTNERS = ['Gustavo', 'Thomas', 'Gabriel', 'Julia', 'Mariana']

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

// â"€â"€ helpers â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function pColor(key: string)  { return PLATFORMS.find(p => p.key === key)?.color ?? '#6b7280' }
function pLabel(key: string)  { return PLATFORMS.find(p => p.key === key)?.label ?? key }
function sInfo(key: string)   { return STATUSES.find(s => s.key === key) ?? { key, label: key, color: '#6b7280' } }
function postDate(post: ContentPost) {
  return post.scheduled_date ?? (post.published_at ? post.published_at.split('T')[0] : null)
}
// Converte link de compartilhamento do Google Drive para URL direta de imagem
function toDirectImageUrl(url: string): string {
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)
  if (driveMatch) return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`
  return url
}

const VIDEO_EXTS = ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv']
function isVideoUrl(url: string): boolean {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase()
  return !!ext && VIDEO_EXTS.includes(ext)
}

// Mapa de extensão → MIME pra quando o navegador não identifica o file.type
// (comum em HEIC de iPhone e alguns vídeos) — usado tanto na hora de pedir a
// URL assinada quanto no PUT direto pro R2, sempre o MESMO valor resolvido.
const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/x-m4v',
  avi: 'video/x-msvideo', mkv: 'video/x-matroska',
}
function resolveContentType(file: File): string {
  if (file.type) return file.type
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_MIME[ext] ?? 'application/octet-stream'
}

const MAX_IMAGE_MB = 15
const MAX_VIDEO_MB = 300

// ── MediaLightbox ──────────────────────────────────────────────────────────────────────────────────
function MediaLightbox({ urls, index, onIndexChange, onClose }: {
  urls: string[]; index: number; onIndexChange: (i: number) => void; onClose: () => void
}) {
  const [downloading, setDownloading] = useState(false)
  const url = urls[index]
  const video = isVideoUrl(url)

  async function download() {
    setDownloading(true)
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = url.split('/').pop()?.split('?')[0] || 'arquivo'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(url, '_blank')
    }
    setDownloading(false)
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-10 transition-colors">
        <X size={18} />
      </button>
      <button onClick={e => { e.stopPropagation(); download() }} disabled={downloading}
        className="absolute top-4 left-4 flex items-center gap-1.5 px-3 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium z-10 transition-colors disabled:opacity-50">
        <Download size={14} /> {downloading ? 'Baixando...' : 'Baixar'}
      </button>
      {urls.length > 1 && (
        <>
          <button onClick={e => { e.stopPropagation(); onIndexChange((index - 1 + urls.length) % urls.length) }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-10 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={e => { e.stopPropagation(); onIndexChange((index + 1) % urls.length) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center z-10 transition-colors">
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/70 bg-black/50 px-2.5 py-1 rounded-full">
            {index + 1} / {urls.length}
          </div>
        </>
      )}
      {video ? (
        <video src={url} controls autoPlay className="max-w-full max-h-full" onClick={e => e.stopPropagation()} />
      ) : (
        <img src={toDirectImageUrl(url)} alt="" className="max-w-full max-h-full object-contain" onClick={e => e.stopPropagation()} />
      )}
    </div>
  )
}

// ── CarouselUpload ─────────────────────────────────────────────────────────────────────────────────
const MAX_IMAGES = 10
function CarouselUpload({ values, onChange }: { values: string[]; onChange: (urls: string[]) => void }) {
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList) {
    setUploading(true)
    setUploadErr(null)
    const newUrls: string[] = []
    const toUpload = Array.from(files).slice(0, MAX_IMAGES - values.length)
    for (const file of toUpload) {
      const isVideo = file.type.startsWith('video/') || VIDEO_EXTS.includes(file.name.split('.').pop()?.toLowerCase() ?? '')
      const maxBytes = (isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB) * 1024 * 1024
      if (file.size > maxBytes) {
        setUploadErr(`"${file.name}" é muito grande (máx. ${isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB}MB)`)
        continue
      }
      try {
        // resolve o content-type UMA vez e reusa o mesmo valor nos dois passos —
        // se divergir entre o presign e o PUT, o R2 recusa o upload
        const contentType = resolveContentType(file)

        // 1) pede uma URL assinada pro servidor (payload pequeno, só o nome do arquivo)
        const presignRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, contentType }),
        })
        const presignJson = await presignRes.json()
        if (!presignRes.ok) { setUploadErr(presignJson.error ?? `Erro ${presignRes.status}`); continue }

        // 2) envia o arquivo direto pro R2, sem passar pela função da Vercel
        const putRes = await fetch(presignJson.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: file,
        })
        if (putRes.ok) newUrls.push(presignJson.publicUrl)
        else setUploadErr(`Erro ao enviar "${file.name}" (${putRes.status})`)
      } catch {
        setUploadErr('Falha na conexão')
      }
    }
    if (newUrls.length) onChange([...values, ...newUrls])
    setUploading(false)
  }

  function remove(i: number) { onChange(values.filter((_, idx) => idx !== i)) }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="image/*,video/*" multiple className="hidden"
        onChange={e => { if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = '' } }} />
      {values.length > 0 ? (
        <div className="flex gap-2 flex-wrap">
          {values.map((url, i) => {
            const video = isVideoUrl(url)
            return (
              <div key={i} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-[#2a2a2a] shrink-0">
                <button type="button" onClick={() => setLightboxIndex(i)} className="w-full h-full block">
                  {video ? (
                    <video src={url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                  ) : (
                    <img src={toDirectImageUrl(url)} alt="" className="w-full h-full object-cover"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = '0.3' }} />
                  )}
                </button>
                {video && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                      <Play size={11} className="text-white ml-0.5" fill="white" />
                    </div>
                  </div>
                )}
                {i === 0 && values.length > 1 && (
                  <div className="absolute bottom-0.5 left-0.5 bg-black/70 text-[8px] text-white px-1 rounded">capa</div>
                )}
                <button onClick={() => remove(i)}
                  className="absolute top-0.5 right-0.5 bg-black/70 hover:bg-[#ef4444]/80 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={8} />
                </button>
              </div>
            )
          })}
          {values.length < MAX_IMAGES && (
            <button onClick={() => inputRef.current?.click()} disabled={uploading}
              className="w-20 h-20 border border-dashed border-[#2a2a2a] hover:border-[#7c3aed] rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-[#a78bfa] transition-colors shrink-0">
              {uploading
                ? <div className="w-4 h-4 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
                : <><Plus size={16} /><span className="text-[9px]">Adicionar</span></>}
            </button>
          )}
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={uploading}
          className="w-full border border-dashed border-[#2a2a2a] hover:border-[#7c3aed] rounded-lg py-6 flex flex-col items-center gap-2 text-muted-foreground hover:text-[#a78bfa] transition-colors">
          {uploading
            ? <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
            : <><ImageIcon size={20} /><span className="text-xs">Clique para fazer upload</span><span className="text-[10px] opacity-50">Fotos ou vídeos — até {MAX_IMAGES} arquivos (carrossel)</span></>}
        </button>
      )}
      {values.length > 1 && <p className="text-[10px] text-[#a78bfa]">⊞ Carrossel · {values.length} arquivos · o primeiro é a capa</p>}
      {uploadErr && <p className="text-[11px] text-[#ef4444]">{uploadErr}</p>}
      {lightboxIndex !== null && (
        <MediaLightbox urls={values} index={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  )
}

// â"€â"€ PostPanel â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function PostPanel({ post, clients, onClose, onSaved, onDeleted }: {
  post: ContentPost
  clients: Client[]
  onClose: () => void
  onSaved: (p: ContentPost) => void
  onDeleted: () => void
}) {
  const [form, setForm] = useState({
    ...post,
    media_urls: post.media_urls?.length ? post.media_urls : (post.media_url ? [post.media_url] : []),
  })
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
            placeholder="Titulo do post"
            className="w-full text-lg font-semibold bg-transparent border-b border-[#2a2a2a] pb-2 focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/30"
          />

          {/* motivo da reprovação (informado pelo cliente no link público) */}
          {form.status === 'reprovado' && form.rejection_reason && (
            <div className="bg-[#ef4444]/10 border border-[#ef4444]/25 rounded-lg p-3 space-y-1">
              <p className="text-[10px] text-[#ef4444] font-medium uppercase tracking-wider">Reprovado pelo cliente — o que alterar</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{form.rejection_reason}</p>
            </div>
          )}

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
                value={form.client_id ?? ''}
                onChange={e => { const v = e.target.value || null; setForm(f => ({ ...f, client_id: v })); save({ client_id: v }) }}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                <option value="">Aura MKT.CLUB</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
            {/* responsável */}
            <div className="col-span-2">
              <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Responsável</label>
              <select
                value={form.responsible ?? ''}
                onChange={e => { const v = e.target.value || null; setForm(f => ({ ...f, responsible: v })); save({ responsible: v }) }}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
              >
                <option value="">Sem responsável</option>
                {PARTNERS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* imagens / carrossel */}
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">
              {(form.media_urls?.length ?? 0) > 1 ? `Carrossel (${form.media_urls?.length} imagens)` : 'Imagem do post'}
            </label>
            <CarouselUpload
              values={form.media_urls ?? []}
              onChange={urls => {
                setForm(f => ({ ...f, media_urls: urls, media_url: urls[0] ?? null }))
                save({ media_urls: urls, media_url: urls[0] ?? null })
              }}
            />
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
              placeholder="Briefing, links de referencia, observacoes..."
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

// â"€â"€ NewPostModal â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function NewPostModal({ clients, activeClientId, onClose, onCreated }: {
  clients: Client[]
  activeClientId: string | null
  onClose: () => void
  onCreated: (p: ContentPost) => void
}) {
  const [form, setForm] = useState({
    client_id:      activeClientId ?? '',
    title:          '',
    platform:       'instagram',
    status:         'rascunho',
    scheduled_date: '',
    caption:        '',
    media_urls:     [] as string[],
    responsible:    '',
  })
  const [saving, setSaving]   = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)

  async function create() {
    if (!form.title.trim()) return
    setSaving(true)
    setCreateErr(null)
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:      form.client_id      || null,
        title:          form.title,
        platform:       form.platform,
        status:         form.status,
        scheduled_date: form.scheduled_date || null,
        caption:        form.caption        || null,
        media_urls:     form.media_urls,
        media_url:      form.media_urls[0]  || null,
        responsible:    form.responsible    || null,
        result: {},
      }),
    })
    if (res.ok) { const post = await res.json(); onCreated(post) }
    else { const j = await res.json().catch(() => ({})); setCreateErr(j.error ?? `Erro ${res.status}`) }
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
              placeholder="Ex: Feed semana 3 - Campanha verao"
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
                <option value="">Aura MKT.CLUB</option>
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
            <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Imagens do post</label>
            <CarouselUpload
              values={form.media_urls}
              onChange={urls => setForm(f => ({ ...f, media_urls: urls }))}
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Legenda (opcional)</label>
            <textarea
              value={form.caption}
              onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
              rows={2}
              placeholder="Previa da legenda..."
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors resize-none placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {createErr && (
          <p className="mt-4 text-xs text-[#ef4444] bg-[#ef4444]/10 rounded-lg px-3 py-2">{createErr}</p>
        )}
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-[#2a2a2a] rounded-lg transition-colors">
            Cancelar
          </button>
          <button
            onClick={create}
            disabled={saving || !form.title.trim()}
            className="flex-1 py-2.5 text-sm bg-[#7c3aed] hover:bg-[#6d28d9] text-white rounded-lg transition-colors disabled:opacity-40 font-medium"
          >
            {saving ? 'Criando...' : 'Criar Post'}
          </button>
        </div>
      </div>
    </div>
  )
}

// â"€â"€ ContentCalendar â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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
                        title={`${post.title} - ${sInfo(post.status).label}`}
                      >
                        {(() => {
                          const thumb = post.media_urls?.[0] ?? post.media_url
                          const count = post.media_urls?.length ?? (post.media_url ? 1 : 0)
                          return thumb ? (
                            <div className="relative">
                              {isVideoUrl(thumb) ? (
                                <video src={thumb} className="w-full h-14 object-cover" muted playsInline preload="metadata" />
                              ) : (
                                <img src={toDirectImageUrl(thumb)} alt="" className="w-full h-14 object-cover"
                                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                              )}
                              {count > 1 && (
                                <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-[8px] text-white px-1 rounded">⊞ {count}</span>
                              )}
                            </div>
                          ) : null
                        })()}
                        <div className="flex items-center justify-between px-1.5 py-0.5 gap-1">
                          <p
                            className="text-[10px] truncate leading-tight font-medium flex-1"
                            style={{ color: pColor(post.platform) }}
                          >
                            {post.title}
                          </p>
                          {post.responsible && (
                            <span className="text-[8px] text-muted-foreground shrink-0 leading-tight">
                              {post.responsible.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
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

// â"€â"€ ContentList â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
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

              {/* responsável */}
              {post.responsible && (
                <span className="hidden sm:inline shrink-0 text-[10px] text-muted-foreground bg-[#1a1a1a] px-2 py-0.5 rounded-full whitespace-nowrap">
                  {post.responsible}
                </span>
              )}

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

            </button>
          )
        })}
      </div>
    </div>
  )
}

// â"€â"€ MetricasView â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
function aggMonth(posts: ContentPost[], y: number, m: number) {
  const filtered = posts.filter(p => {
    if (p.status !== 'publicado') return false
    const d = p.published_at ? p.published_at.split('T')[0] : p.scheduled_date
    if (!d) return false
    const [py, pm] = d.split('-').map(Number)
    return py === y && pm - 1 === m
  })
  const curtidas     = filtered.reduce((s, p) => s + (p.result?.curtidas     ?? 0), 0)
  const comentarios  = filtered.reduce((s, p) => s + (p.result?.comentarios  ?? 0), 0)
  const salvamentos  = filtered.reduce((s, p) => s + (p.result?.salvamentos  ?? 0), 0)
  const alcance      = filtered.reduce((s, p) => s + (p.result?.alcance      ?? 0), 0)
  const impressoes   = filtered.reduce((s, p) => s + (p.result?.impressoes   ?? 0), 0)
  const engagements  = curtidas + comentarios + salvamentos
  const rate         = alcance > 0 ? parseFloat((engagements / alcance * 100).toFixed(2)) : 0
  return { total: filtered.length, curtidas, comentarios, salvamentos, alcance, impressoes, engagements, rate, posts: filtered }
}

function MetricasView({ posts, month, year }: { posts: ContentPost[]; month: number; year: number }) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, month - (5 - i), 1)
    return { year: d.getFullYear(), month: d.getMonth(), label: MONTH_NAMES[d.getMonth()].slice(0, 3) }
  })

  const chartData = months.map(m => {
    const a = aggMonth(posts, m.year, m.month)
    return { name: m.label, taxa: a.rate, curtidas: a.curtidas, posts: a.total }
  })

  const cur = aggMonth(posts, year, month)
  const prev = aggMonth(posts, month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1)
  const rateDiff = cur.rate - prev.rate

  const noData = cur.total === 0 && chartData.every(d => d.taxa === 0 && d.curtidas === 0)

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Posts publicados',   value: String(cur.total),                          color: '#22c55e' },
          { label: 'Curtidas totais',    value: cur.curtidas.toLocaleString('pt-BR'),        color: '#e1306c' },
          { label: 'Alcance total',      value: cur.alcance.toLocaleString('pt-BR'),         color: '#a78bfa' },
          { label: 'Taxa de engajamento',value: cur.rate.toFixed(2) + '%',                  color: '#f59e0b',
            sub: prev.rate > 0 ? (rateDiff >= 0 ? '+' : '') + rateDiff.toFixed(2) + '% vs mês ant.' : undefined },
        ].map(k => (
          <div key={k.label} className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
            <p className="text-[11px] text-muted-foreground mb-1">{k.label}</p>
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
            {'sub' in k && k.sub && (
              <p className={`text-[10px] mt-1 ${rateDiff >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{k.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Engagement rate trend */}
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={13} className="text-[#a78bfa]" />
            <h3 className="text-sm font-medium">Taxa de engajamento â€" 6 meses</h3>
          </div>
          {noData ? (
            <div className="h-[180px] flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Publique posts com resultados para ver o gráfico</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#555' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#555' }} axisLine={false} tickLine={false} tickFormatter={v => v + '%'} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: unknown) => [Number(v).toFixed(2) + '%', 'Engajamento']}
                  labelStyle={{ color: '#888' }}
                />
                <Area type="monotone" dataKey="taxa" stroke="#7c3aed" strokeWidth={2} fill="url(#engGrad)" dot={{ fill: '#7c3aed', r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Curtidas bar chart */}
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={13} className="text-[#e1306c]" />
            <h3 className="text-sm font-medium">Curtidas â€" 6 meses</h3>
          </div>
          {noData ? (
            <div className="h-[180px] flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Sem dados ainda</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#555' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#555' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: unknown) => [Number(v).toLocaleString('pt-BR'), 'Curtidas']}
                  labelStyle={{ color: '#888' }}
                />
                <Bar dataKey="curtidas" fill="#e1306c" fillOpacity={0.8} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Posts table */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
          <h3 className="text-sm font-medium">Posts publicados neste mês</h3>
          <span className="text-xs text-muted-foreground">{cur.total} post{cur.total !== 1 ? 's' : ''}</span>
        </div>
        {cur.posts.length === 0 ? (
          <div className="flex items-center justify-center h-24">
            <p className="text-sm text-muted-foreground">Nenhum post publicado neste mês</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1a1a1a]">
            {cur.posts.map(post => {
              const c   = post.result?.curtidas    ?? 0
              const al  = post.result?.alcance     ?? 0
              const co  = post.result?.comentarios ?? 0
              const sa  = post.result?.salvamentos ?? 0
              const rate = al > 0 ? ((c + co + sa) / al * 100).toFixed(1) : null
              return (
                <div key={post.id} className="px-5 py-3 flex items-center gap-3">
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: pColor(post.platform) + '28', color: pColor(post.platform) }}>
                    {pLabel(post.platform)}
                  </span>
                  <p className="text-sm flex-1 truncate">{post.title}</p>
                  <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    {c  > 0 && <span>â™¥ {c.toLocaleString('pt-BR')}</span>}
                    {al > 0 && <span>ðŸ' {al.toLocaleString('pt-BR')}</span>}
                    {co > 0 && <span>ðŸ'¬ {co.toLocaleString('pt-BR')}</span>}
                  </div>
                  {rate && (
                    <span className="text-[11px] font-semibold text-[#f59e0b] shrink-0">{rate}%</span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── ShareModal ────────────────────────────────────────────────────────────────
function ShareModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadToken = useCallback(async () => {
    const res = await fetch(`/api/clients/${client.id}/share-link`).catch(() => null)
    if (res?.ok) { const d = await res.json(); setToken(d.token) }
    setLoading(false)
  }, [client.id])

  useEffect(() => { loadToken() }, [loadToken])

  const url = token ? `${window.location.origin}/publico/${token}` : ''

  function copyLink() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function regenerate() {
    if (!confirm('Isso invalida o link atual — quem tiver o link antigo perde o acesso. Continuar?')) return
    setRegenerating(true)
    const res = await fetch(`/api/clients/${client.id}/share-link`, { method: 'POST' })
    if (res.ok) { const d = await res.json(); setToken(d.token) }
    setRegenerating(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 size={15} className="text-[#a78bfa]" />
            <h2 className="text-sm font-semibold">Compartilhar calendário — {client.name}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
        </div>
        <p className="text-xs text-muted-foreground">
          Link público, sem login. Mostra só o calendário de conteúdo de <strong>{client.name}</strong> — o cliente pode ver e aprovar/reprovar cada post.
        </p>
        {loading ? (
          <div className="h-10 bg-[#111111] rounded-lg animate-pulse" />
        ) : (
          <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-xs text-foreground break-all">{url}</div>
        )}
        <div className="flex gap-2">
          <button
            onClick={copyLink}
            disabled={loading}
            className={`flex-1 flex items-center justify-center gap-2 text-sm py-2.5 rounded-lg border transition-all disabled:opacity-50 ${
              copied ? 'border-[#22c55e]/40 text-[#22c55e] bg-[#22c55e]/5' : 'border-[#2a2a2a] hover:bg-[#222222]'
            }`}
          >
            {copied ? <><Check size={13} /> Copiado!</> : <><Copy size={13} /> Copiar link</>}
          </button>
          <button
            onClick={regenerate}
            disabled={loading || regenerating}
            title="Gerar novo link (invalida o atual)"
            className="flex items-center justify-center gap-2 text-sm px-3 py-2.5 rounded-lg border border-[#2a2a2a] text-muted-foreground hover:text-foreground hover:bg-[#222222] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={regenerating ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── ConteudoPage ─────────────────────────────────────────────────────────────
export default function ConteudoPage() {
  const [clients, setClients]         = useState<Client[]>([])
  const [posts, setPosts]             = useState<ContentPost[]>([])
  const [loading, setLoading]         = useState(true)
  const [activeClient, setActiveClient] = useState<string>('todos')
  const [viewMode, setViewMode]       = useState<'calendario' | 'lista' | 'metricas'>('calendario')
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedPost, setSelectedPost]     = useState<ContentPost | null>(null)
  const [showNew, setShowNew]               = useState(false)
  const [showShare, setShowShare]           = useState(false)
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
            <div className="flex items-center gap-2">
              {!isAllClients && activeClientObj && (
                <button
                  onClick={() => setShowShare(true)}
                  className="flex items-center gap-2 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-sm px-4 py-2.5 rounded-xl transition-colors font-medium text-muted-foreground hover:text-foreground"
                >
                  <Share2 size={15} />
                  <span className="hidden sm:inline">Compartilhar</span>
                </button>
              )}
              <button
                onClick={() => setShowNew(true)}
                className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm px-4 py-2.5 rounded-xl transition-colors font-medium"
              >
                <Plus size={16} />
                Novo Post
              </button>
            </div>
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
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
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                  viewMode === 'calendario'
                    ? 'bg-[#7c3aed]/15 text-[#a78bfa]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CalendarDays size={14} />
                <span className="hidden sm:inline">Calendário</span>
              </button>
              <button
                onClick={() => setViewMode('lista')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                  viewMode === 'lista'
                    ? 'bg-[#7c3aed]/15 text-[#a78bfa]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <List size={14} />
                <span className="hidden sm:inline">Lista</span>
              </button>
              <button
                onClick={() => setViewMode('metricas')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                  viewMode === 'metricas'
                    ? 'bg-[#7c3aed]/15 text-[#a78bfa]'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TrendingUp size={14} />
                <span className="hidden sm:inline">Métricas</span>
              </button>
            </div>

            {(viewMode === 'calendario' || viewMode === 'metricas') && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={prevMonth}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] rounded-lg transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-medium text-center min-w-[100px] sm:w-[160px]">
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
          ) : viewMode === 'metricas' ? (
            <MetricasView
              posts={posts}
              month={currentMonth.month}
              year={currentMonth.year}
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

      {showShare && activeClientObj && (
        <ShareModal client={activeClientObj} onClose={() => setShowShare(false)} />
      )}
    </>
  )
}
