'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Users, Building2, Pencil, Camera, X, Check, Loader2 } from 'lucide-react'
import type { Member } from '@/lib/supabase/types'
import { uploadImage } from '@/lib/utils/uploadImage'

const COLORS = ['#efefef', '#2563eb', '#16a34a', '#ea580c', '#db2777', '#0891b2', '#65a30d', '#9333ea']

function getInitials(name: string) {
  return name.trim().split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

interface CompanyRow { id: string; name: string; status: string; logo_url: string | null }

function Avatar({ url, initials, color, size = 40 }: { url?: string | null; initials: string; color: string; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" style={{ width: size, height: size }} className="rounded-full object-cover shrink-0 border border-[#2a2a2a]" />
  }
  return (
    <div
      style={{ width: size, height: size, backgroundColor: color + '22', borderColor: color + '55', color, fontSize: size * 0.34 }}
      className="rounded-full border flex items-center justify-center font-semibold shrink-0"
    >
      {initials}
    </div>
  )
}

// Botão de foto: escolhe a imagem, envia e devolve a URL
function PhotoButton({ onUploaded, kind, children, className }: { onUploaded: (url: string) => void; kind: 'logo' | 'avatar'; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError('')
    try { onUploaded(await uploadImage(file, kind)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro ao enviar a imagem') }
    setBusy(false)
    if (ref.current) ref.current.value = ''
  }

  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} disabled={busy} className={className} title={error || undefined}>
        {busy ? <Loader2 size={12} className="animate-spin" /> : children}
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={e => pick(e.target.files?.[0])} />
      {error && <span className="text-[10px] text-[#ef4444]">{error}</span>}
    </>
  )
}

function MembersSection() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftColor, setDraftColor] = useState(COLORS[0])
  const [error, setError] = useState('')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(COLORS[0])
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => {
    fetch('/api/members').then(r => r.json()).then(d => { setMembers(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  async function patch(id: string, body: Record<string, unknown>) {
    setError('')
    const res = await fetch(`/api/members/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setError(d.error ?? 'Não consegui salvar. Se for a foto, rode o SQL novo no Supabase.'); return false }
    setMembers(ms => ms.map(m => m.id === id ? { ...m, ...d } : m))
    return true
  }

  function startEdit(m: Member) {
    setEditing(m.id); setDraftName(m.name); setDraftColor(m.color)
  }

  async function saveEdit(m: Member) {
    const name = draftName.trim()
    if (!name) return
    if (await patch(m.id, { name, initials: getInitials(name), color: draftColor })) setEditing(null)
  }

  async function remove(id: string) {
    if (!confirm('Tirar essa pessoa da equipe? As tarefas e reuniões dela ficam sem responsável.')) return
    setMembers(ms => ms.filter(m => m.id !== id))
    await fetch(`/api/members/${id}`, { method: 'DELETE' })
  }

  async function add() {
    if (!newName.trim()) return
    setAdding(true)
    await fetch('/api/members', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), initials: getInitials(newName), color: newColor }),
    })
    setNewName(''); setAdding(false); load()
  }

  return (
    <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Users size={14} className="text-[#efefef]" />
        <h2 className="text-sm font-medium">Equipe do Hub</h2>
      </div>
      <p className="text-[11px] text-muted-foreground mb-5">Foto, nome e cor aparecem nas tarefas e nas reuniões.</p>

      {loading ? (
        <div className="flex items-center justify-center h-20"><div className="w-4 h-4 border-2 border-[#efefef] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="mb-5">
          {members.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma pessoa cadastrada.</p>}
          {members.map(m => {
            const isEditing = editing === m.id
            return (
              <div key={m.id} className="py-3 border-b border-[#2a2a2a] last:border-0">
                <div className="flex items-center gap-3">
                  <Avatar url={m.avatar_url} initials={m.initials} color={m.color} />
                  <span className="text-sm flex-1 truncate">{m.name}</span>
                  <button onClick={() => (isEditing ? setEditing(null) : startEdit(m))} className="text-muted-foreground hover:text-[#efefef] transition-colors" title="Editar">
                    {isEditing ? <X size={13} /> : <Pencil size={13} />}
                  </button>
                  <button onClick={() => remove(m.id)} className="text-muted-foreground hover:text-[#ef4444] transition-colors" title="Remover">
                    <Trash2 size={13} />
                  </button>
                </div>
                {isEditing && (
                  <div className="mt-3 ml-[52px] space-y-3">
                    <input
                      value={draftName}
                      onChange={e => setDraftName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(m) }}
                      placeholder="Nome"
                      className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef]"
                    />
                    <div className="flex gap-2 flex-wrap">
                      {COLORS.map(c => (
                        <button key={c} type="button" onClick={() => setDraftColor(c)} style={{ backgroundColor: c }}
                          className={`w-5 h-5 rounded-full transition-all ${draftColor === c ? 'ring-2 ring-offset-2 ring-offset-[#1a1a1a] ring-white/50' : ''}`} />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <PhotoButton kind="avatar" onUploaded={url => patch(m.id, { avatar_url: url })} className="flex items-center gap-1.5 text-xs border border-[#2a2a2a] hover:border-[#efefef] rounded-lg px-3 py-1.5 transition-colors">
                        <Camera size={12} /> {m.avatar_url ? 'Trocar foto' : 'Colocar foto'}
                      </PhotoButton>
                      {m.avatar_url && (
                        <button onClick={() => patch(m.id, { avatar_url: null })} className="text-xs text-muted-foreground hover:text-[#ef4444] px-2 py-1.5">Tirar foto</button>
                      )}
                      <button onClick={() => saveEdit(m)} className="ml-auto flex items-center gap-1.5 bg-[#efefef] text-[#111] text-xs font-medium rounded-lg px-3 py-1.5">
                        <Check size={12} /> Salvar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {error && <p className="text-xs text-[#ef4444] mt-2">{error}</p>}
        </div>
      )}

      <div className="space-y-3 pt-3 border-t border-[#2a2a2a]">
        <p className="text-xs text-muted-foreground">Adicionar pessoa</p>
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }}
            placeholder="Nome completo"
            className="flex-1 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-[#efefef]"
          />
          <button onClick={add} disabled={adding || !newName.trim()} className="bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111] px-3 py-2 rounded-lg disabled:opacity-50">
            <Plus size={14} />
          </button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setNewColor(c)} style={{ backgroundColor: c }}
              className={`w-5 h-5 rounded-full transition-all ${newColor === c ? 'ring-2 ring-offset-2 ring-offset-[#1a1a1a] ring-white/50' : ''}`} />
          ))}
        </div>
      </div>
    </section>
  )
}

function CompaniesSection() {
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(d => {
      const rows = (Array.isArray(d) ? d : []) as CompanyRow[]
      setCompanies(rows.sort((a, b) => (a.status === 'ativo' ? 0 : 1) - (b.status === 'ativo' ? 0 : 1) || a.name.localeCompare(b.name)))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function setLogo(id: string, logo_url: string | null) {
    setError('')
    const res = await fetch(`/api/clients/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logo_url }) })
    if (!res.ok) { setError('Não consegui salvar o logo. Rode o SQL novo no Supabase.'); return }
    setCompanies(cs => cs.map(c => c.id === id ? { ...c, logo_url } : c))
  }

  return (
    <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Building2 size={14} className="text-[#efefef]" />
        <h2 className="text-sm font-medium">Empresas</h2>
      </div>
      <p className="text-[11px] text-muted-foreground mb-5">O logo aparece na lista de clientes.</p>

      {loading ? (
        <div className="flex items-center justify-center h-20"><div className="w-4 h-4 border-2 border-[#efefef] border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div>
          {companies.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma empresa cadastrada.</p>}
          {companies.map(c => (
            <div key={c.id} className="flex items-center gap-3 py-3 border-b border-[#2a2a2a] last:border-0">
              <div className="w-10 h-10 rounded-lg bg-[#111111] border border-[#2a2a2a] flex items-center justify-center overflow-hidden shrink-0">
                {c.logo_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={c.logo_url} alt="" className="w-full h-full object-contain" />
                  : <span className="text-sm font-bold text-[#efefef]">{c.name[0]?.toUpperCase()}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{c.name}</p>
                {c.status !== 'ativo' && <p className="text-[10px] text-muted-foreground capitalize">{c.status}</p>}
              </div>
              <PhotoButton kind="logo" onUploaded={url => setLogo(c.id, url)} className="flex items-center gap-1.5 text-xs border border-[#2a2a2a] hover:border-[#efefef] rounded-lg px-3 py-1.5 transition-colors">
                <Camera size={12} /> {c.logo_url ? 'Trocar' : 'Colocar logo'}
              </PhotoButton>
              {c.logo_url && (
                <button onClick={() => setLogo(c.id, null)} className="text-muted-foreground hover:text-[#ef4444] transition-colors" title="Tirar logo"><X size={13} /></button>
              )}
            </div>
          ))}
          {error && <p className="text-xs text-[#ef4444] mt-2">{error}</p>}
        </div>
      )}
    </section>
  )
}

export function TeamTab() {
  return (
    <div className="space-y-8">
      <MembersSection />
      <CompaniesSection />
    </div>
  )
}
