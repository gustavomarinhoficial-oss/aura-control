'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Sparkles, Target, Users, MessageCircle, Palette, Package,
  Settings, AtSign, Globe, Lock, Camera, Plus, X, Copy, Eye, EyeOff,
  Folder, Loader2, Wand2,
} from 'lucide-react'

type SocialEntry = { platform: string; handle: string }
type LinkEntry = { label: string; url: string }
type PasswordEntry = { label: string; username: string; password: string; url: string }
type ContactEntry = { name: string; role: string; contact: string }

interface HubData {
  objectives: string
  mission: string
  positioning: string
  target_audience: string
  competitors: string
  tone_of_voice: string
  avoid_topics: string
  content_pillars: string
  content_goal: string
  brand_colors: string
  brand_manual_url: string
  products_services: string
  recurring_promos: string
  responsible_contacts: ContactEntry[]
  instagram_notes: string
  social_media: SocialEntry[]
  links: LinkEntry[]
  passwords: PasswordEntry[]
}

const EMPTY: HubData = {
  objectives: '', mission: '', positioning: '', target_audience: '', competitors: '',
  tone_of_voice: '', avoid_topics: '', content_pillars: '', content_goal: '',
  brand_colors: '', brand_manual_url: '', products_services: '', recurring_promos: '',
  responsible_contacts: [], instagram_notes: '', social_media: [], links: [], passwords: [],
}

const SOCIAL_PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'Twitter/X', 'Pinterest', 'Outro']

const CONTENT_TYPE_META: Record<'reels' | 'feed' | 'carrossel', string> = {
  reels: 'Reels', feed: 'Estático', carrossel: 'Carrossel',
}

function nextMonthValue() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function Card({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-muted-foreground" />
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Field({ label, value, onChange, onBlur, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; onBlur: () => void; placeholder?: string; rows?: number
}) {
  return (
    <div>
      <label className="block text-[10px] text-muted-foreground mb-1.5">{label}</label>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        rows={rows}
        placeholder={placeholder}
        className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors placeholder:text-muted-foreground/50 resize-none"
      />
    </div>
  )
}

function LineField({ label, value, onChange, onBlur, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; onBlur: () => void; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-[10px] text-muted-foreground mb-1.5">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors placeholder:text-muted-foreground/50"
      />
    </div>
  )
}

export default function ClientHubPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [clientName, setClientName] = useState('')
  const [data, setData] = useState<HubData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [revealedPasswords, setRevealedPasswords] = useState<Set<number>>(new Set())

  const [genMonth, setGenMonth] = useState(nextMonthValue())
  const [genCounts, setGenCounts] = useState({ reels: 8, feed: 10, carrossel: 7 })
  const [genFocus, setGenFocus] = useState('')
  const [genAvoid, setGenAvoid] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState<{ ok: boolean; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [clientRes, extrasRes] = await Promise.all([
      fetch(`/api/clients/${id}`).then(r => r.json()).catch(() => null),
      fetch(`/api/clients/${id}/extras`).then(r => r.json()).catch(() => EMPTY),
    ])
    setClientName(clientRes?.name ?? '')
    setData({ ...EMPTY, ...extrasRes })
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  async function save(override?: Partial<HubData>) {
    const payload = override ? { ...data, ...override } : data
    await fetch(`/api/clients/${id}/extras`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  }

  function set<K extends keyof HubData>(key: K, value: HubData[K]) {
    setData(d => ({ ...d, [key]: value }))
  }

  async function generateCalendar() {
    setGenerating(true)
    setGenResult(null)
    try {
      const res = await fetch(`/api/clients/${id}/generate-calendar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: genMonth, counts: genCounts, focus: genFocus, avoid: genAvoid }),
      })
      const json = await res.json()
      if (!res.ok) {
        setGenResult({ ok: false, message: json.error ?? 'Erro ao gerar o calendário.' })
      } else {
        setGenResult({ ok: true, message: `${json.created} posts criados como rascunho em ${genMonth}. Já aparecem na Central de Conteúdo.` })
      }
    } catch {
      setGenResult({ ok: false, message: 'Erro de conexão ao gerar o calendário. Tenta de novo.' })
    } finally {
      setGenerating(false)
    }
  }

  const totalGen = genCounts.reels + genCounts.feed + genCounts.carrossel

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando hub...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/clientes/${id}`)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[#efefef]" />
          <h1 className="text-lg font-semibold">Hub da marca — {clientName}</h1>
        </div>
      </div>

      {/* Gerador de esqueleto */}
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Wand2 size={14} className="text-[#efefef]" />
          <h3 className="text-xs font-medium text-[#efefef] uppercase tracking-wider">Gerador de esqueleto de calendário</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1.5">Mês</label>
            <input
              type="month"
              value={genMonth}
              onChange={e => setGenMonth(e.target.value)}
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors"
            />
          </div>
          {(Object.keys(CONTENT_TYPE_META) as Array<keyof typeof CONTENT_TYPE_META>).map(key => (
            <div key={key}>
              <label className="block text-[10px] text-muted-foreground mb-1.5">{CONTENT_TYPE_META[key]}</label>
              <input
                type="number"
                min={0}
                value={genCounts[key]}
                onChange={e => setGenCounts(c => ({ ...c, [key]: Math.max(0, Number(e.target.value) || 0) }))}
                className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors"
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1.5">Foco do mês (promoção, campanha, lançamento...)</label>
            <input
              value={genFocus}
              onChange={e => setGenFocus(e.target.value)}
              placeholder="Ex: lançamento do cardápio de verão"
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors placeholder:text-muted-foreground/50"
            />
          </div>
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1.5">O que evitar esse mês</label>
            <input
              value={genAvoid}
              onChange={e => setGenAvoid(e.target.value)}
              placeholder="Ex: já fizemos muito bastidor mês passado"
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={generateCalendar}
            disabled={generating || totalGen === 0}
            className="flex items-center gap-2 bg-[#efefef] hover:bg-[#d9d9d9] disabled:opacity-50 disabled:cursor-not-allowed text-[#111111] text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? 'Gerando...' : `Gerar ${totalGen} posts`}
          </button>
          {genResult && (
            <p className={`text-xs ${genResult.ok ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>{genResult.message}</p>
          )}
        </div>
      </div>

      {/* Sobre a marca */}
      <Card icon={Target} title="Sobre a marca">
        <Field label="Missão" value={data.mission} onChange={v => set('mission', v)} onBlur={() => save()} placeholder="Por que essa marca existe, o que ela entrega de verdade..." />
        <Field label="Posicionamento" value={data.positioning} onChange={v => set('positioning', v)} onBlur={() => save()} placeholder="Como ela se diferencia da concorrência..." />
        <Field label="Objetivos e expectativas do cliente" value={data.objectives} onChange={v => set('objectives', v)} onBlur={() => save()} placeholder="Metas, expectativas e resultados esperados..." />
      </Card>

      {/* Público-alvo & Concorrência */}
      <Card icon={Users} title="Público-alvo & Concorrência">
        <Field label="Público-alvo" value={data.target_audience} onChange={v => set('target_audience', v)} onBlur={() => save()} placeholder="Quem compra, idade, comportamento, dores..." />
        <Field label="Concorrentes" value={data.competitors} onChange={v => set('competitors', v)} onBlur={() => save()} placeholder="2-3 nomes de referência direta" rows={2} />
      </Card>

      {/* Voz & Estilo */}
      <Card icon={MessageCircle} title="Voz, estilo & estratégia de conteúdo">
        <Field label="Tom de voz" value={data.tone_of_voice} onChange={v => set('tone_of_voice', v)} onBlur={() => save()} placeholder="Formal, descontraído, técnico, provocador..." rows={2} />
        <Field label="O que nunca falar/mostrar" value={data.avoid_topics} onChange={v => set('avoid_topics', v)} onBlur={() => save()} placeholder="Temas, piadas ou imagens fora do tom da marca..." rows={2} />
        <Field label="Pilares de conteúdo" value={data.content_pillars} onChange={v => set('content_pillars', v)} onBlur={() => save()} placeholder="Ex: 40% institucional, 30% produto, 30% bastidor" rows={2} />
        <Field label="Objetivo de conteúdo atual" value={data.content_goal} onChange={v => set('content_goal', v)} onBlur={() => save()} placeholder="Vender, gerar reconhecimento, engajar comunidade..." rows={2} />
      </Card>

      {/* Identidade visual */}
      <Card icon={Palette} title="Identidade visual">
        <LineField label="Paleta de cores" value={data.brand_colors} onChange={v => set('brand_colors', v)} onBlur={() => save()} placeholder="Ex: #111111, dourado, branco" />
        <LineField label="Link do manual de marca (opcional — Drive, Canva etc.)" value={data.brand_manual_url} onChange={v => set('brand_manual_url', v)} onBlur={() => save()} placeholder="https://..." />
        <button
          onClick={() => router.push(`/clientes/${id}?tab=documentos`)}
          className="flex items-center gap-2 text-xs text-[#efefef] hover:underline"
        >
          <Folder size={12} /> Ver arquivos de logo/manual na pasta &quot;Identidade visual&quot; (Documentos)
        </button>
      </Card>

      {/* Produto/Serviço */}
      <Card icon={Package} title="Produto/Serviço">
        <Field label="Portfólio principal" value={data.products_services} onChange={v => set('products_services', v)} onBlur={() => save()} placeholder="O que vende, carro-chefe, ticket médio..." />
      </Card>

      {/* Operação */}
      <Card icon={Settings} title="Operação">
        <Field label="Promoções recorrentes" value={data.recurring_promos} onChange={v => set('recurring_promos', v)} onBlur={() => save()} placeholder="Ex: happy hour toda quinta, combo de fim de semana..." rows={2} />
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[10px] text-muted-foreground">Responsáveis no local</label>
            <button
              onClick={() => set('responsible_contacts', [...data.responsible_contacts, { name: '', role: '', contact: '' }])}
              className="flex items-center gap-1 text-xs text-[#efefef]"
            >
              <Plus size={12} /> Adicionar
            </button>
          </div>
          {data.responsible_contacts.length === 0 && <p className="text-xs text-muted-foreground/60">Nenhum responsável cadastrado</p>}
          <div className="space-y-2">
            {data.responsible_contacts.map((c, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={c.name}
                  onChange={e => { const arr = [...data.responsible_contacts]; arr[i] = { ...arr[i], name: e.target.value }; set('responsible_contacts', arr) }}
                  onBlur={() => save()}
                  placeholder="Nome"
                  className="w-32 shrink-0 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors placeholder:text-muted-foreground/50"
                />
                <input
                  value={c.role}
                  onChange={e => { const arr = [...data.responsible_contacts]; arr[i] = { ...arr[i], role: e.target.value }; set('responsible_contacts', arr) }}
                  onBlur={() => save()}
                  placeholder="Cargo"
                  className="w-28 shrink-0 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors placeholder:text-muted-foreground/50"
                />
                <input
                  value={c.contact}
                  onChange={e => { const arr = [...data.responsible_contacts]; arr[i] = { ...arr[i], contact: e.target.value }; set('responsible_contacts', arr) }}
                  onBlur={() => save()}
                  placeholder="Telefone/e-mail"
                  className="flex-1 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors placeholder:text-muted-foreground/50"
                />
                <button
                  onClick={() => { const arr = data.responsible_contacts.filter((_, j) => j !== i); set('responsible_contacts', arr); save({ responsible_contacts: arr }) }}
                  className="text-muted-foreground hover:text-[#ef4444] transition-colors p-1"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Redes sociais */}
      <Card icon={AtSign} title="Redes sociais">
        <div className="flex items-center justify-end -mt-2 mb-1">
          <button
            onClick={() => set('social_media', [...data.social_media, { platform: 'Instagram', handle: '' }])}
            className="flex items-center gap-1 text-xs text-[#efefef]"
          >
            <Plus size={12} /> Adicionar
          </button>
        </div>
        {data.social_media.length === 0 && <p className="text-xs text-muted-foreground/60">Nenhuma rede social cadastrada</p>}
        <div className="space-y-2">
          {data.social_media.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select
                value={s.platform}
                onChange={e => { const arr = [...data.social_media]; arr[i] = { ...arr[i], platform: e.target.value }; set('social_media', arr) }}
                onBlur={() => save()}
                className="bg-[#111111] border border-[#2a2a2a] rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-[#efefef] transition-colors w-36 shrink-0"
              >
                {SOCIAL_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input
                value={s.handle}
                onChange={e => { const arr = [...data.social_media]; arr[i] = { ...arr[i], handle: e.target.value }; set('social_media', arr) }}
                onBlur={() => save()}
                placeholder="@usuario ou URL"
                className="flex-1 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors placeholder:text-muted-foreground/50"
              />
              <button
                onClick={() => { const arr = data.social_media.filter((_, j) => j !== i); set('social_media', arr); save({ social_media: arr }) }}
                className="text-muted-foreground hover:text-[#ef4444] transition-colors p-1"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Links úteis */}
      <Card icon={Globe} title="Links úteis">
        <div className="flex items-center justify-end -mt-2 mb-1">
          <button
            onClick={() => set('links', [...data.links, { label: '', url: '' }])}
            className="flex items-center gap-1 text-xs text-[#efefef]"
          >
            <Plus size={12} /> Adicionar
          </button>
        </div>
        {data.links.length === 0 && <p className="text-xs text-muted-foreground/60">Nenhum link cadastrado</p>}
        <div className="space-y-2">
          {data.links.map((lk, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={lk.label}
                onChange={e => { const arr = [...data.links]; arr[i] = { ...arr[i], label: e.target.value }; set('links', arr) }}
                onBlur={() => save()}
                placeholder="Rótulo (ex: Site)"
                className="w-32 shrink-0 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors placeholder:text-muted-foreground/50"
              />
              <input
                value={lk.url}
                onChange={e => { const arr = [...data.links]; arr[i] = { ...arr[i], url: e.target.value }; set('links', arr) }}
                onBlur={() => save()}
                placeholder="https://..."
                className="flex-1 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors placeholder:text-muted-foreground/50"
              />
              <button
                onClick={() => { navigator.clipboard.writeText(lk.url) }}
                title="Copiar link"
                className="text-muted-foreground hover:text-[#efefef] transition-colors p-1"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={() => { const arr = data.links.filter((_, j) => j !== i); set('links', arr); save({ links: arr }) }}
                className="text-muted-foreground hover:text-[#ef4444] transition-colors p-1"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Senhas / Acessos */}
      <Card icon={Lock} title="Senhas / Acessos">
        <div className="flex items-center justify-end -mt-2 mb-1">
          <button
            onClick={() => set('passwords', [...data.passwords, { label: '', username: '', password: '', url: '' }])}
            className="flex items-center gap-1 text-xs text-[#efefef]"
          >
            <Plus size={12} /> Adicionar
          </button>
        </div>
        {data.passwords.length === 0 && <p className="text-xs text-muted-foreground/60">Nenhum acesso cadastrado</p>}
        <div className="space-y-3">
          {data.passwords.map((pw, i) => (
            <div key={i} className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={pw.label}
                  onChange={e => { const arr = [...data.passwords]; arr[i] = { ...arr[i], label: e.target.value }; set('passwords', arr) }}
                  onBlur={() => save()}
                  placeholder="Rótulo (ex: Google Ads)"
                  className="flex-1 min-w-0 bg-transparent border-b border-[#2a2a2a] pb-1 text-sm font-medium focus:outline-none focus:border-[#efefef] transition-colors placeholder:text-muted-foreground/50"
                />
                <button
                  onClick={() => { const arr = data.passwords.filter((_, j) => j !== i); set('passwords', arr); save({ passwords: arr }) }}
                  className="text-muted-foreground hover:text-[#ef4444] transition-colors p-0.5"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="min-w-0">
                  <label className="block text-[10px] text-muted-foreground mb-1">Usuário / Email</label>
                  <div className="flex items-center gap-1">
                    <input
                      value={pw.username}
                      onChange={e => { const arr = [...data.passwords]; arr[i] = { ...arr[i], username: e.target.value }; set('passwords', arr) }}
                      onBlur={() => save()}
                      placeholder="usuario@email.com"
                      className="flex-1 min-w-0 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#efefef] transition-colors placeholder:text-muted-foreground/50"
                    />
                    <button onClick={() => navigator.clipboard.writeText(pw.username)} className="text-muted-foreground hover:text-[#efefef] transition-colors p-1 shrink-0"><Copy size={12} /></button>
                  </div>
                </div>
                <div className="min-w-0">
                  <label className="block text-[10px] text-muted-foreground mb-1">Senha</label>
                  <div className="flex items-center gap-1">
                    <input
                      type={revealedPasswords.has(i) ? 'text' : 'password'}
                      value={pw.password}
                      onChange={e => { const arr = [...data.passwords]; arr[i] = { ...arr[i], password: e.target.value }; set('passwords', arr) }}
                      onBlur={() => save()}
                      placeholder="••••••••"
                      className="flex-1 min-w-0 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#efefef] transition-colors placeholder:text-muted-foreground/50"
                    />
                    <button
                      onClick={() => setRevealedPasswords(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })}
                      className="text-muted-foreground hover:text-[#efefef] transition-colors p-1 shrink-0"
                    >
                      {revealedPasswords.has(i) ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(pw.password)} className="text-muted-foreground hover:text-[#efefef] transition-colors p-1 shrink-0"><Copy size={12} /></button>
                  </div>
                </div>
              </div>
              <div className="min-w-0">
                <label className="block text-[10px] text-muted-foreground mb-1">URL (opcional)</label>
                <div className="flex items-center gap-1">
                  <input
                    value={pw.url}
                    onChange={e => { const arr = [...data.passwords]; arr[i] = { ...arr[i], url: e.target.value }; set('passwords', arr) }}
                    onBlur={() => save()}
                    placeholder="https://..."
                    className="flex-1 min-w-0 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#efefef] transition-colors placeholder:text-muted-foreground/50"
                  />
                  <button onClick={() => navigator.clipboard.writeText(pw.url)} className="text-muted-foreground hover:text-[#efefef] transition-colors p-1 shrink-0"><Copy size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Observações de Instagram */}
      <Card icon={Camera} title="Observações de Instagram">
        <Field label="Notas manuais (visão geral do perfil, o que funciona, o que não funciona)" value={data.instagram_notes} onChange={v => set('instagram_notes', v)} onBlur={() => save()} placeholder="Ex: Reels de bastidor performam bem, stories de enquete engajam pouco..." rows={4} />
      </Card>
    </div>
  )
}
