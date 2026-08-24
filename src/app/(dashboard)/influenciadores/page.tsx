'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, X, Check, Trash2, Phone, Mail, DollarSign, FileText, Pencil, AtSign, User, Tag, Building2 } from 'lucide-react'
import { formatBRL } from '@/lib/utils/format'

interface Client { id: string; name: string }

interface InfluencerRow {
  id: string
  name: string
  niche: string | null
  instagram: string | null
  phone: string | null
  email: string | null
  client_id: string | null
  status: string
  value: number | null
  responsible: string | null
  notes: string | null
  created_at: string
  clients?: { id: string; name: string } | null
}

const STATUSES: { key: string; label: string; color: string; bg: string }[] = [
  { key: 'a_contatar', label: 'A contatar', color: '#6b7280', bg: '#6b728015' },
  { key: 'em_contato', label: 'Em contato', color: '#3b82f6', bg: '#3b82f615' },
  { key: 'negociando', label: 'Negociando', color: '#f59e0b', bg: '#f59e0b15' },
  { key: 'fechado',    label: 'Fechado',    color: '#22c55e', bg: '#22c55e15' },
  { key: 'recusado',   label: 'Recusado',   color: '#ef4444', bg: '#ef444415' },
]

const EMPTY_FORM = {
  name: '', niche: '', instagram: '', phone: '', email: '', client_id: '', value: '', responsible: '', notes: '',
}

export default function InfluenciadoresPage() {
  const [influencers, setInfluencers] = useState<InfluencerRow[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<InfluencerRow | null>(null)
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [addingStatus, setAddingStatus] = useState<string | null>(null)
  const [newForm, setNewForm] = useState({ ...EMPTY_FORM })
  const [addSaving, setAddSaving] = useState(false)
  const [activeDrag, setActiveDrag] = useState<InfluencerRow | null>(null)
  const [dragPos, setDragPos]       = useState({ x: 0, y: 0 })
  const [overStatus, setOverStatus] = useState<string | null>(null)
  const pendingDrag = useRef<{ row: InfluencerRow; x: number; y: number; pointerId: number; el: Element } | null>(null)
  const isDraggingRef = useRef(false)
  const overStatusRef  = useRef<string | null>(null)
  const colRefs        = useRef<Map<string, Element>>(new Map())

  const load = useCallback(async () => {
    const [inf, cli] = await Promise.all([
      fetch('/api/influencers').then(r => r.json()).catch(() => []),
      fetch('/api/clients').then(r => r.json()).catch(() => []),
    ])
    setInfluencers(Array.isArray(inf) ? inf : [])
    setClients(Array.isArray(cli) ? cli.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })) : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openEdit(row: InfluencerRow) {
    setSelected(row)
    setEditForm({
      name: row.name,
      niche: row.niche ?? '',
      instagram: row.instagram ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      client_id: row.client_id ?? '',
      value: row.value ? String(row.value) : '',
      responsible: row.responsible ?? '',
      notes: row.notes ?? '',
    })
  }

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    const res = await fetch(`/api/influencers/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, value: editForm.value ? Number(editForm.value) : null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setInfluencers(rs => rs.map(r => r.id === updated.id ? updated : r))
      setSelected(updated)
    }
    setSaving(false)
  }

  async function deleteInfluencer() {
    if (!selected) return
    if (!confirm(`Apagar "${selected.name}"? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    await fetch(`/api/influencers/${selected.id}`, { method: 'DELETE' })
    setInfluencers(rs => rs.filter(r => r.id !== selected.id))
    setDeleting(false)
    setSelected(null)
  }

  async function moveInfluencer(id: string, newStatus: string) {
    setInfluencers(rs => rs.map(r => r.id === id ? { ...r, status: newStatus } : r))
    await fetch(`/api/influencers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
  }

  async function addInfluencer(status: string) {
    if (!newForm.name.trim()) return
    setAddSaving(true)
    const res = await fetch('/api/influencers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newForm, status, value: newForm.value ? Number(newForm.value) : null, client_id: newForm.client_id || null }),
    })
    if (res.ok) {
      const row = await res.json()
      setInfluencers(rs => [row, ...rs])
      setNewForm({ ...EMPTY_FORM })
      setAddingStatus(null)
    }
    setAddSaving(false)
  }

  function startDrag(e: React.PointerEvent, row: InfluencerRow) {
    pendingDrag.current = { row, x: e.clientX, y: e.clientY, pointerId: e.pointerId, el: e.currentTarget as Element }
    isDraggingRef.current = false
  }

  function moveDrag(e: React.PointerEvent) {
    const p = pendingDrag.current
    if (!p) return
    if (!isDraggingRef.current && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return
    if (!isDraggingRef.current) { isDraggingRef.current = true; p.el.setPointerCapture(p.pointerId) }
    setActiveDrag(p.row)
    setDragPos({ x: e.clientX, y: e.clientY })
    let found: string | null = null
    for (const [status, el] of colRefs.current.entries()) {
      const r = el.getBoundingClientRect()
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { found = status; break }
    }
    overStatusRef.current = found
    setOverStatus(found)
  }

  function endDrag() {
    const p = pendingDrag.current
    if (isDraggingRef.current && p && overStatusRef.current && overStatusRef.current !== p.row.status) {
      moveInfluencer(p.row.id, overStatusRef.current)
    }
    pendingDrag.current = null; isDraggingRef.current = false
    setActiveDrag(null); setOverStatus(null); overStatusRef.current = null
  }

  const rowsFor = (status: string) => influencers.filter(r => r.status === status)
  const totalValue = (status: string) => rowsFor(status).reduce((s, r) => s + (r.value ?? 0), 0)
  const fechadoTotal = influencers.filter(r => r.status === 'fechado').reduce((s, r) => s + (r.value ?? 0), 0)

  const statusInfo = selected ? STATUSES.find(s => s.key === selected.status) : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Influenciadores</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {influencers.length} no radar · fechado {formatBRL(fechadoTotal)}
          </p>
        </div>
        <button
          onClick={() => { setAddingStatus('a_contatar'); setNewForm({ ...EMPTY_FORM }) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg transition-colors"
        >
          <Plus size={14} /> Novo influenciador
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="pb-4">
        <div className="flex flex-col gap-3 md:grid md:grid-cols-5">
          {STATUSES.map(s => {
            const cards = rowsFor(s.key)
            const val = totalValue(s.key)
            const isAdding = addingStatus === s.key

            return (
              <div
                key={s.key}
                ref={el => { if (el) colRefs.current.set(s.key, el); else colRefs.current.delete(s.key) }}
                className="flex flex-col rounded-xl min-h-[60px] w-full transition-all"
                style={{
                  background: s.bg,
                  border: `1px solid ${overStatus === s.key ? s.color + '88' : s.color + '22'}`,
                  boxShadow: overStatus === s.key ? `0 0 0 2px ${s.color}33` : 'none',
                }}
              >
                {/* Cabeçalho */}
                <div className="px-3 pt-3 pb-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-xs font-semibold">{s.label}</span>
                      <span className="text-[10px] text-muted-foreground bg-[#111] px-1.5 py-0.5 rounded-full">{cards.length}</span>
                    </div>
                    <button onClick={() => { setAddingStatus(s.key); setNewForm({ ...EMPTY_FORM }) }}
                      className="text-muted-foreground hover:text-foreground transition-colors">
                      <Plus size={13} />
                    </button>
                  </div>
                  {val > 0 && <p className="text-[10px] font-medium pl-4" style={{ color: s.color }}>{formatBRL(val)}</p>}
                </div>

                {/* Form rápido de adição */}
                {isAdding && (
                  <div className="mx-2 mb-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 space-y-2">
                    <input autoFocus placeholder="Nome do influenciador *"
                      value={newForm.name} onChange={e => setNewForm(f => ({ ...f, name: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') addInfluencer(s.key); if (e.key === 'Escape') setAddingStatus(null) }}
                      className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                    <input placeholder="Nicho (ex: restaurantes)"
                      value={newForm.niche} onChange={e => setNewForm(f => ({ ...f, niche: e.target.value }))}
                      className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                    <select value={newForm.client_id} onChange={e => setNewForm(f => ({ ...f, client_id: e.target.value }))}
                      className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#7c3aed] text-foreground">
                      <option value="">Sem cliente vinculado</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input placeholder="Valor negociado (R$)" type="number"
                      value={newForm.value} onChange={e => setNewForm(f => ({ ...f, value: e.target.value }))}
                      className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                    <div className="flex gap-1.5">
                      <button onClick={() => setAddingStatus(null)}
                        className="flex-1 text-[10px] border border-[#2a2a2a] py-1.5 rounded-lg hover:bg-[#222] transition-colors">Cancelar</button>
                      <button onClick={() => addInfluencer(s.key)} disabled={addSaving || !newForm.name.trim()}
                        className="flex-1 text-[10px] bg-[#7c3aed] hover:bg-[#6d28d9] text-white py-1.5 rounded-lg transition-colors disabled:opacity-40">
                        {addSaving ? '...' : 'Adicionar'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Cards */}
                <div className="px-2 pb-3 space-y-2 flex-1">
                  {cards.map(row => (
                    <div key={row.id}
                      onPointerDown={e => startDrag(e, row)}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                      onPointerCancel={endDrag}
                      onClick={() => { if (!isDraggingRef.current) openEdit(row) }}
                      style={{ touchAction: 'none', opacity: activeDrag?.id === row.id ? 0.35 : 1 }}
                      className="bg-[#111111] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all group select-none">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <p className="text-xs font-semibold leading-snug line-clamp-2">{row.name}</p>
                        <Pencil size={10} className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
                      </div>
                      {row.clients?.name && <p className="text-[10px] text-muted-foreground truncate mb-1">Pra {row.clients.name}</p>}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {row.value && (
                          <p className="text-[11px] font-semibold" style={{ color: s.color }}>{formatBRL(row.value)}</p>
                        )}
                        {row.niche && (
                          <span className="text-[9px] bg-[#1a1a1a] border border-[#2a2a2a] px-1.5 py-0.5 rounded-full text-muted-foreground">{row.niche}</span>
                        )}
                      </div>
                      {row.responsible && (
                        <p className="text-[9px] text-muted-foreground truncate mb-1">👤 {row.responsible}</p>
                      )}
                      {row.notes && <p className="text-[9px] text-muted-foreground line-clamp-2 leading-relaxed">{row.notes}</p>}
                    </div>
                  ))}
                  {cards.length === 0 && !isAdding && (
                    <div className="text-center py-6">
                      <p className="text-[10px] text-muted-foreground">Nenhum influenciador</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        </div>
      )}

      {/* Ghost card durante o arrasto */}
      {activeDrag && (
        <div
          style={{
            position: 'fixed',
            left: dragPos.x - 110,
            top: dragPos.y - 28,
            width: 220,
            zIndex: 9999,
            pointerEvents: 'none',
            transform: 'rotate(2deg)',
          }}
          className="bg-[#111111] border border-[#7c3aed] rounded-lg p-3 shadow-2xl opacity-90"
        >
          <p className="text-xs font-semibold truncate">{activeDrag.name}</p>
          {activeDrag.value && (
            <p className="text-[10px] text-[#a78bfa] mt-0.5">{formatBRL(activeDrag.value)}</p>
          )}
        </div>
      )}

      {/* Painel lateral de edição */}
      {selected && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setSelected(null)}>
          <div className="flex-1 hidden md:block" />
          <div className="w-full md:w-[420px] h-full bg-[#111111] border-l border-[#2a2a2a] overflow-y-auto flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {statusInfo && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusInfo.color }} />}
                <span className="text-sm font-medium truncate">{selected.name}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* Status */}
              <div>
                <label className="text-xs text-muted-foreground block mb-2">Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map(st => (
                    <button key={st.key}
                      onClick={() => { moveInfluencer(selected.id, st.key); setSelected(prev => prev ? { ...prev, status: st.key } : prev) }}
                      className="text-[10px] px-2.5 py-1 rounded-full border transition-all"
                      style={selected.status === st.key
                        ? { backgroundColor: st.color + '30', borderColor: st.color, color: st.color }
                        : { borderColor: '#2a2a2a', color: '#666' }}>
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {selected.status === 'fechado' && (
                <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-sm">
                  <Check size={14} /> Parceria fechada
                </div>
              )}

              {/* Campos */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><User size={10} /> Nome</label>
                  <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed]" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><Tag size={10} /> Nicho</label>
                    <input placeholder="Restaurantes" value={editForm.niche} onChange={e => setEditForm(f => ({ ...f, niche: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><AtSign size={10} /> Instagram</label>
                    <input placeholder="@influenciador" value={editForm.instagram} onChange={e => setEditForm(f => ({ ...f, instagram: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><Phone size={10} /> WhatsApp</label>
                    <input placeholder="(11) 99999-9999" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><DollarSign size={10} /> Valor negociado</label>
                    <input type="number" placeholder="500" value={editForm.value} onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><Mail size={10} /> Email</label>
                  <input type="email" placeholder="contato@influenciador.com" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><Building2 size={10} /> Cliente</label>
                    <select value={editForm.client_id} onChange={e => setEditForm(f => ({ ...f, client_id: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] text-foreground">
                      <option value="">Sem cliente vinculado</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><User size={10} /> Responsável</label>
                    <input placeholder="Ex: Mariana" value={editForm.responsible} onChange={e => setEditForm(f => ({ ...f, responsible: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><FileText size={10} /> Observações</label>
                  <textarea rows={4} placeholder="Notas, próximos passos, contexto..." value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground resize-none" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#2a2a2a] flex items-center gap-2 shrink-0">
              <button onClick={deleteInfluencer} disabled={deleting}
                className="flex items-center gap-1.5 text-xs border border-[#ef4444]/30 text-[#ef4444]/70 hover:text-[#ef4444] hover:bg-[#ef4444]/10 px-3 py-2 rounded-lg transition-colors disabled:opacity-40">
                <Trash2 size={12} /> {deleting ? 'Apagando...' : 'Apagar'}
              </button>
              <button onClick={saveEdit} disabled={saving || !editForm.name.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 text-sm bg-[#7c3aed] hover:bg-[#6d28d9] text-white py-2 rounded-lg transition-colors disabled:opacity-50">
                <Check size={13} /> {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
