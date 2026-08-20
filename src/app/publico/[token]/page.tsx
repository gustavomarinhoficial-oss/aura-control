'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Check, X, RefreshCw, Loader2, CalendarDays, ChevronDown, ChevronRight,
} from 'lucide-react'

interface Post {
  id: string
  title: string
  caption: string | null
  platform: string
  status: string
  scheduled_date: string | null
  published_at: string | null
  media_url: string | null
  media_urls: string[] | null
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
  rascunho:              { label: 'Rascunho',             color: '#6b7280' },
  em_criacao:            { label: 'Em criação',            color: '#f59e0b' },
  aguardando_aprovacao:  { label: 'Aguardando aprovação',  color: '#3b82f6' },
  aprovado:              { label: 'Aprovado',              color: '#8b5cf6' },
  agendado:              { label: 'Agendado',              color: '#06b6d4' },
  publicado:             { label: 'Publicado',             color: '#22c55e' },
  reprovado:             { label: 'Reprovado',              color: '#ef4444' },
}

function formatDateLong(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function firstMedia(post: Post): string | null {
  if (post.media_url) return post.media_url
  if (post.media_urls && post.media_urls.length > 0) return post.media_urls[0]
  return null
}

function PostCard({ post, onAction, acting }: { post: Post; onAction: (id: string, status: 'aprovado' | 'reprovado') => void; acting: boolean }) {
  const media = firstMedia(post)
  const st = STATUS_LABEL[post.status] ?? { label: post.status, color: '#6b7280' }
  const canAct = post.status !== 'publicado'

  return (
    <div className="bg-[#161616] border border-[#262626] rounded-2xl overflow-hidden">
      {media && (
        <div className="w-full aspect-[4/3] bg-[#0d0d0d]">
          <img src={media} alt={post.title} className="w-full h-full object-cover" />
        </div>
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
            {formatDateLong(post.scheduled_date)}
          </p>
        )}

        {canAct && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onAction(post.id, 'aprovado')}
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
              onClick={() => onAction(post.id, 'reprovado')}
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

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    const res = await fetch(`/api/public/content?token=${token}`).catch(() => null)
    if (!res?.ok) { setNotFound(true); setLoading(false); setRefreshing(false); return }
    const data = await res.json()
    setClient(data.client)
    setPosts(Array.isArray(data.posts) ? data.posts : [])
    setLoading(false)
    setRefreshing(false)
  }, [token])

  useEffect(() => { load() }, [load])

  async function handleAction(id: string, status: 'aprovado' | 'reprovado') {
    setActingId(id)
    const res = await fetch(`/api/public/content/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setPosts(ps => ps.map(p => p.id === id ? updated : p))
    }
    setActingId(null)
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
        <p className="text-xs text-[#7a7a7a] mb-6">Acompanhe, aprove ou reprove os posts planejados.</p>

        {upcoming.length === 0 && past.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CalendarDays size={26} className="text-[#3a3a3a] mb-3" strokeWidth={1} />
            <p className="text-sm text-[#7a7a7a]">Nenhum conteúdo planejado ainda.</p>
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="space-y-3">
            {upcoming.map(post => (
              <PostCard key={post.id} post={post} onAction={handleAction} acting={actingId === post.id} />
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
                  <PostCard key={post.id} post={post} onAction={handleAction} acting={actingId === post.id} />
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-[10px] text-[#4a4a4a] mt-10">Aura Control</p>
      </div>
    </div>
  )
}
