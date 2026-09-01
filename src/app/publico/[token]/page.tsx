'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Check, X, RefreshCw, Loader2, CalendarDays, ChevronDown, ChevronRight,
  ChevronLeft, List, AlertCircle, Expand, Play, Paperclip, Lock,
} from 'lucide-react'

interface Post {
  id: string
  title: string
  caption: string | null
  platform: string
  status: string
  scheduled_date: string | null
  scheduled_time: string | null
  published_at: string | null
  media_url: string | null
  media_urls: string[] | null
  rejection_reason: string | null
  rejection_images: string[] | null
  created_at: string
}

interface ClientInfo { id: string; name: string }

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', tiktok: 'TikTok',
  youtube: 'YouTube', twitter: 'Twitter/X', pinterest: 'Pinterest', google_ads: 'Google Ads', email: 'E-mail',
}
const PLATFORM_COLOR: Record<string, string> = {
  instagram: '#e1306c', facebook: '#1877f2', linkedin: '#0a66c2', tiktok: '#69c9d0',
  youtube: '#ff4444', twitter: '#94a3b8', pinterest: '#e60023', google_ads: '#4285f4', email: '#8b5cf6',
}
const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  rascunho:              { label: 'Rascunho',              color: '#6b7280' },
  em_criacao:            { label: 'Em criação',             color: '#f59e0b' },
  aguardando_aprovacao:  { label: 'Aguardando aprovação',   color: '#3b82f6' },
  ajustado:              { label: 'Ajustado — revise novamente', color: '#f97316' },
  aprovado:              { label: 'Aprovado',               color: '#22c55e' },
  agendado:              { label: 'Agendado',               color: '#06b6d4' },
  publicado:             { label: 'Publicado',              color: '#16a34a' },
  reprovado:             { label: 'Reprovado',              color: '#ef4444' },
}
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAY_NAMES = ['D','S','T','Q','Q','S','S']

function formatDateLong(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function postMedia(post: Post): string[] {
  if (post.media_urls && post.media_urls.length > 0) return post.media_urls
  if (post.media_url) return [post.media_url]
  return []
}

const VIDEO_EXTS = ['mp4', 'mov', 'webm', 'm4v', 'avi', 'mkv']
function isVideoUrl(url: string): boolean {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase()
  return !!ext && VIDEO_EXTS.includes(ext)
}

// ── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ images, index, onIndexChange, onClose }: { images: string[]; index: number; onIndexChange: (i: number) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] bg-black/95 flex items-center justify-center" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
      >
        <X size={18} />
      </button>

      {images.length > 1 && (
        <>
          <button
            onClick={e => { e.stopPropagation(); onIndexChange((index - 1 + images.length) % images.length) }}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onIndexChange((index + 1) % images.length) }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 text-xs text-white/70 bg-black/50 px-2.5 py-1 rounded-full">
            {index + 1} / {images.length}
          </div>
        </>
      )}

      {isVideoUrl(images[index]) ? (
        <video
          src={images[index]}
          controls
          autoPlay
          className="max-w-full max-h-full"
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <img
          src={images[index]}
          alt=""
          className="max-w-full max-h-full object-contain"
          onClick={e => e.stopPropagation()}
        />
      )}
    </div>
  )
}

// ── upload de prints (cliente anexa direto do link público) ──────────────────
async function uploadImage(file: File): Promise<string | null> {
  try {
    const contentType = file.type || 'image/jpeg'
    const presignRes = await fetch('/api/upload', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType }),
    })
    const presign = await presignRes.json()
    if (!presignRes.ok) return null
    const putRes = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
    return putRes.ok ? presign.publicUrl : null
  } catch {
    return null
  }
}

// ── RejectModal ──────────────────────────────────────────────────────────────
function RejectModal({ onConfirm, onClose, saving }: { onConfirm: (reason: string, images: string[]) => void; onClose: () => void; saving: boolean }) {
  const [reason, setReason] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files: FileList) {
    setUploading(true)
    const uploaded: string[] = []
    for (const file of Array.from(files).slice(0, 6 - images.length)) {
      const url = await uploadImage(file)
      if (url) uploaded.push(url)
    }
    if (uploaded.length) setImages(imgs => [...imgs, ...uploaded])
    setUploading(false)
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-[#161616] border border-[#262626] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-5 space-y-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-[#ef4444]" />
          <h3 className="text-sm font-semibold text-white">Por que está reprovando?</h3>
        </div>
        <p className="text-xs text-[#7a7a7a]">Conta pra gente o que precisa mudar — assim já ajustamos certinho.</p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={4}
          autoFocus
          placeholder="Ex: trocar a foto, mudar o texto da legenda, cor não combina..."
          className="w-full bg-[#0d0d0d] border border-[#262626] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#5a5a5a] focus:outline-none focus:border-[#ef4444] transition-colors resize-none"
        />

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-[#9ca3af] cursor-pointer w-fit hover:text-white transition-colors">
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={e => { if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = '' } }} />
            <Paperclip size={13} />
            {uploading ? 'Enviando print...' : 'Anexar print (opcional)'}
          </label>
          {images.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {images.map((url, i) => (
                <div key={i} className="relative w-14 h-14 rounded-lg overflow-hidden border border-[#2a2a2a] shrink-0">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => setImages(imgs => imgs.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 bg-black/70 hover:bg-[#ef4444]/80 text-white rounded-full w-4 h-4 flex items-center justify-center">
                    <X size={8} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 border border-[#2a2a2a] text-white text-sm py-2.5 rounded-xl hover:bg-[#1f1f1f] transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim(), images)}
            disabled={!reason.trim() || saving || uploading}
            className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white text-sm py-2.5 rounded-xl transition-colors disabled:opacity-40 font-medium"
          >
            {saving ? 'Enviando...' : 'Reprovar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PostCard ─────────────────────────────────────────────────────────────────
function PostCard({ post, onApprove, onReject, acting, canReview }: {
  post: Post
  onApprove: (id: string) => void
  onReject: (id: string) => void
  acting: boolean
  canReview: boolean
}) {
  const media = postMedia(post)
  const st = STATUS_LABEL[post.status] ?? { label: post.status, color: '#6b7280' }
  const canAct = canReview && post.status !== 'publicado'
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [rejectionLightboxIndex, setRejectionLightboxIndex] = useState<number | null>(null)

  return (
    <div className="bg-[#161616] border border-[#262626] rounded-2xl overflow-hidden">
      {media.length > 0 && (
        <button
          onClick={() => setLightboxIndex(0)}
          className="relative w-full aspect-[4/3] bg-[#0d0d0d] block group"
        >
          {isVideoUrl(media[0]) ? (
            <video src={media[0]} className="w-full h-full object-cover" muted playsInline preload="metadata" />
          ) : (
            <img src={media[0]} alt={post.title} className="w-full h-full object-cover" />
          )}
          {isVideoUrl(media[0]) ? (
            <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                <Play size={20} className="text-white ml-0.5" fill="white" />
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-black/0 group-active:bg-black/20 transition-colors flex items-center justify-center">
              <div className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Expand size={15} className="text-white" />
              </div>
            </div>
          )}
          {media.length > 1 && (
            <span className="absolute bottom-2 right-2 bg-black/70 text-[10px] text-white px-1.5 py-0.5 rounded-full">
              ⊞ {media.length}
            </span>
          )}
        </button>
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: PLATFORM_COLOR[post.platform] ?? '#9ca3af' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: PLATFORM_COLOR[post.platform] ?? '#9ca3af' }} />
            {PLATFORM_LABEL[post.platform] ?? post.platform}
          </span>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: st.color + '20', color: st.color }}>
            {st.label}
          </span>
        </div>

        <p className="text-base font-semibold leading-snug">{post.title}</p>
        {post.caption && <p className="text-sm text-[#b3b3b3] leading-relaxed whitespace-pre-wrap">{post.caption}</p>}

        {post.scheduled_date && (
          <p className="text-xs text-[#7a7a7a] flex items-center gap-1.5">
            <CalendarDays size={12} />
            {formatDateLong(post.scheduled_date)}{post.scheduled_time && ` às ${post.scheduled_time.slice(0, 5)}`}
          </p>
        )}

        {(post.status === 'reprovado' || post.status === 'ajustado') && post.rejection_reason && (() => {
          const isAdjusted = post.status === 'ajustado'
          const tone = isAdjusted ? '#f97316' : '#ef4444'
          return (
            <div className="rounded-lg p-2.5 space-y-2" style={{ background: tone + '1a', border: `1px solid ${tone}33` }}>
              <p className="text-[10px] font-medium uppercase tracking-wider mb-0.5" style={{ color: tone }}>
                {isAdjusted ? 'Já ajustamos — o que você pediu' : 'Seu motivo'}
              </p>
              <p className="text-xs text-[#e5e5e5] whitespace-pre-wrap">{post.rejection_reason}</p>
              {(post.rejection_images?.length ?? 0) > 0 && (
                <div className="flex gap-1.5 flex-wrap pt-0.5">
                  {post.rejection_images!.map((url, i) => (
                    <button key={i} onClick={() => setRejectionLightboxIndex(i)}
                      className="w-12 h-12 rounded-lg overflow-hidden shrink-0 hover:opacity-80 transition-opacity" style={{ border: `1px solid ${tone}40` }}>
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {canAct && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onApprove(post.id)}
              disabled={acting}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 ${
                post.status === 'aprovado'
                  ? 'bg-[#22c55e] text-white'
                  : 'bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 border border-[#22c55e]/25'
              }`}
            >
              <Check size={15} /> {post.status === 'aprovado' ? 'Aprovado' : 'Aprovar'}
            </button>
            <button
              onClick={() => onReject(post.id)}
              disabled={acting}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 ${
                post.status === 'reprovado'
                  ? 'bg-[#ef4444] text-white'
                  : 'bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20 border border-[#ef4444]/25'
              }`}
            >
              <X size={15} /> {post.status === 'reprovado' ? 'Reprovado' : 'Reprovar'}
            </button>
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <Lightbox images={media} index={lightboxIndex} onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
      {rejectionLightboxIndex !== null && post.rejection_images && (
        <Lightbox images={post.rejection_images} index={rejectionLightboxIndex} onIndexChange={setRejectionLightboxIndex} onClose={() => setRejectionLightboxIndex(null)} />
      )}
    </div>
  )
}

// ── CalendarView ─────────────────────────────────────────────────────────────
function CalendarView({ posts, onApprove, onReject, actingId, canReview }: {
  posts: Post[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  actingId: string | null
  canReview: boolean
}) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getMonth() === month && now.getFullYear() === year ? now.getDate() : null)

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const byDay: Record<number, Post[]> = {}
  for (const post of posts) {
    if (!post.scheduled_date) continue
    const [y, m, d] = post.scheduled_date.split('-').map(Number)
    if (y === year && m - 1 === month) {
      if (!byDay[d]) byDay[d] = []
      byDay[d].push(post)
    }
  }

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  function prevMonth() {
    setSelectedDay(null)
    if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    setSelectedDay(null)
    if (month === 11) { setYear(y => y + 1); setMonth(0) } else setMonth(m => m + 1)
  }

  const selectedPosts = selectedDay ? (byDay[selectedDay] ?? []) : []

  return (
    <div className="space-y-4">
      <div className="bg-[#161616] border border-[#262626] rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-3 border-b border-[#262626]">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#222] text-[#9ca3af] hover:text-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <p className="text-sm font-semibold">{MONTH_NAMES[month]} {year}</p>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#222] text-[#9ca3af] hover:text-white transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 border-b border-[#1f1f1f]">
          {DAY_NAMES.map((d, i) => (
            <div key={i} className="text-center text-[10px] text-[#6a6a6a] font-medium py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const dayStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : ''
            const isToday = dayStr === todayStr
            const isSelected = day !== null && selectedDay === day
            const dayPosts = day ? (byDay[day] ?? []) : []
            return (
              <button
                key={i}
                disabled={!day}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`min-h-[52px] p-1 flex flex-col items-center gap-0.5 border-b border-r border-[#1a1a1a] transition-colors ${
                  isSelected ? 'bg-[#7c3aed]/15' : day ? 'hover:bg-[#1c1c1c]' : ''
                }`}
              >
                {day && (
                  <>
                    <span className={`text-[11px] w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-[#7c3aed] text-white font-semibold' : 'text-[#9ca3af]'}`}>
                      {day}
                    </span>
                    <div className="flex gap-0.5 flex-wrap justify-center">
                      {dayPosts.slice(0, 3).map(p => (
                        <span key={p.id} className="w-1.5 h-1.5 rounded-full" style={{ background: (STATUS_LABEL[p.status] ?? STATUS_LABEL.rascunho).color }} />
                      ))}
                    </div>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="space-y-3">
          <p className="text-xs text-[#7a7a7a]">
            {selectedPosts.length === 0 ? 'Nenhum post nesse dia' : `${selectedPosts.length} post${selectedPosts.length !== 1 ? 's' : ''} — ${selectedDay} de ${MONTH_NAMES[month]}`}
          </p>
          {selectedPosts.map(post => (
            <PostCard key={post.id} post={post} onApprove={onApprove} onReject={onReject} acting={actingId === post.id} canReview={canReview} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function PublicCalendarPage() {
  const params = useParams<{ token: string }>()
  const token = params.token

  const [client, setClient] = useState<ClientInfo | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)
  const [viewMode, setViewMode] = useState<'lista' | 'calendario'>('lista')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [hiddenCount, setHiddenCount] = useState(0)
  const [canReview, setCanReview] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    const res = await fetch(`/api/public/content?token=${token}`).catch(() => null)
    if (!res?.ok) { setNotFound(true); setLoading(false); setRefreshing(false); return }
    const data = await res.json()
    setClient(data.client)
    setPosts(Array.isArray(data.posts) ? data.posts : [])
    setHiddenCount(typeof data.hiddenCount === 'number' ? data.hiddenCount : 0)
    setCanReview(data.canReview === true)
    setLoading(false)
    setRefreshing(false)
  }, [token])

  useEffect(() => { load() }, [load])

  async function submitStatus(id: string, status: 'aprovado' | 'reprovado', reason?: string, images?: string[]) {
    setActingId(id)
    const res = await fetch(`/api/public/content/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, status, reason, images }),
    })
    if (res.ok) {
      const updated = await res.json()
      setPosts(ps => ps.map(p => p.id === id ? updated : p))
    }
    setActingId(null)
    setRejectingId(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d]">
        <Loader2 size={22} className="animate-spin text-[#7c3aed]" />
      </div>
    )
  }

  if (notFound || !client) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0d0d0d] text-center px-6">
        <p className="text-lg font-semibold text-white">Link inválido</p>
        <p className="text-sm text-[#7a7a7a] mt-1">Esse link de calendário não existe ou não é mais válido.</p>
      </div>
    )
  }

  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
  const withDate = posts.filter(p => p.scheduled_date)
  const noDate = posts.filter(p => !p.scheduled_date)
  const upcoming = [...withDate.filter(p => p.scheduled_date! >= todayStr), ...noDate]
  const past = withDate.filter(p => p.scheduled_date! < todayStr).sort((a, b) => b.scheduled_date!.localeCompare(a.scheduled_date!))

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="max-w-2xl mx-auto px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-[10px] tracking-[0.25em] text-[#7c3aed] uppercase font-semibold">Calendário de conteúdo</p>
            <h1 className="text-2xl font-bold tracking-tight mt-0.5">{client.name}</h1>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-[#161616] border border-[#262626] text-[#9ca3af] hover:text-white transition-colors disabled:opacity-50 shrink-0"
            title="Atualizar"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
        <p className="text-xs text-[#7a7a7a] mb-4">
          {canReview ? 'Acompanhe, aprove ou reprove os posts planejados.' : 'Acompanhe os posts planejados.'}
        </p>

        <div className="flex items-center bg-[#161616] border border-[#262626] rounded-xl p-1 gap-1 mb-5 w-fit">
          <button
            onClick={() => setViewMode('lista')}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${viewMode === 'lista' ? 'bg-[#2a2a2a] text-white' : 'text-[#8a8a8a] hover:text-white'}`}
          >
            <List size={13} /> Lista
          </button>
          <button
            onClick={() => setViewMode('calendario')}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${viewMode === 'calendario' ? 'bg-[#2a2a2a] text-white' : 'text-[#8a8a8a] hover:text-white'}`}
          >
            <CalendarDays size={13} /> Calendário
          </button>
        </div>

        {hiddenCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-[#7a7a7a] bg-[#161616] border border-[#262626] rounded-lg px-3 py-2 mb-4">
            <Lock size={12} className="shrink-0" />
            {hiddenCount} conteúdo{hiddenCount !== 1 ? 's' : ''} do mês que vem ainda não liberado{hiddenCount !== 1 ? 's' : ''} — aparece{hiddenCount !== 1 ? 'm' : ''} automaticamente perto do fim do mês.
          </div>
        )}

        {upcoming.length === 0 && past.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CalendarDays size={26} className="text-[#3a3a3a] mb-3" strokeWidth={1} />
            <p className="text-sm text-[#7a7a7a]">Nenhum conteúdo planejado ainda.</p>
          </div>
        )}

        {viewMode === 'calendario' ? (
          (upcoming.length > 0 || past.length > 0) && (
            <CalendarView
              posts={posts}
              onApprove={id => submitStatus(id, 'aprovado')}
              onReject={id => setRejectingId(id)}
              actingId={actingId}
              canReview={canReview}
            />
          )
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="space-y-3">
                {upcoming.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onApprove={id => submitStatus(id, 'aprovado')}
                    onReject={id => setRejectingId(id)}
                    acting={actingId === post.id}
                    canReview={canReview}
                  />
                ))}
              </div>
            )}

            {past.length > 0 && (
              <div className="mt-6 space-y-3">
                <button
                  onClick={() => setShowPast(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-[#7a7a7a] hover:text-white transition-colors"
                >
                  {showPast ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  Conteúdos anteriores ({past.length})
                </button>
                {showPast && (
                  <div className="space-y-3 opacity-80">
                    {past.map(post => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onApprove={id => submitStatus(id, 'aprovado')}
                        onReject={id => setRejectingId(id)}
                        acting={actingId === post.id}
                        canReview={canReview}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <p className="text-center text-[10px] text-[#4a4a4a] mt-10">Aura Control</p>
      </div>

      {rejectingId && (
        <RejectModal
          saving={actingId === rejectingId}
          onClose={() => setRejectingId(null)}
          onConfirm={(reason, images) => submitStatus(rejectingId, 'reprovado', reason, images)}
        />
      )}
    </div>
  )
}
