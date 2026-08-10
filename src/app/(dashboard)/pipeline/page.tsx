'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, X, Check, Trash2, UserPlus, Phone, Mail, DollarSign, FileText, Calendar, ChevronRight, Pencil, AtSign, MapPin, User } from 'lucide-react' // lucide-react compat
import { formatBRL } from '@/lib/utils/format'

interface Lead {
  id: string
  company_name: string
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  instagram: string | null
  origem: string | null
  responsavel: string | null
  estimated_value: number | null
  stage: string
  notes: string | null
  last_contact_at: string | null
  created_at: string
}

const STAGES: { key: string; label: string; color: string; bg: string }[] = [
  { key: 'novo_lead',   label: 'Novo lead',         color: '#6b7280', bg: '#6b728015' },
  { key: 'contato',     label: 'Contato feito',     color: '#3b82f6', bg: '#3b82f615' },
  { key: 'reuniao',     label: 'Reunião',           color: '#8b5cf6', bg: '#8b5cf615' },
  { key: 'proposta',    label: 'Proposta enviada',  color: '#f59e0b', bg: '#f59e0b15' },
  { key: 'negociacao',  label: 'Negociação',        color: '#f97316', bg: '#f9731615' },
  { key: 'fechado',     label: 'Fechado',           color: '#22c55e', bg: '#22c55e15' },
  { key: 'perdido',     label: 'Perdido',           color: '#ef4444', bg: '#ef444415' },
]

const ORIGEM_OPTIONS = ['Indicação', 'Instagram', 'LinkedIn', 'Facebook', 'Prospecção ativa', 'Site', 'Evento', 'Parceiro', 'Outro']

const EMPTY_FORM = {
  company_name: '', contact_name: '', contact_phone: '', contact_email: '',
  instagram: '', origem: '', responsavel: '', estimated_value: '', notes: '', last_contact_at: '',
}

export default function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Lead | null>(null)
  const [editForm, setEditForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [converting, setConverting] = useState(false)
  const [convertedId, setConvertedId] = useState<string | null>(null)
  const [addingStage, setAddingStage] = useState<string | null>(null)
  const [newForm, setNewForm] = useState({ ...EMPTY_FORM })
  const [addSaving, setAddSaving] = useState(false)
  const draggingId = useRef<string | null>(null)

  const load = useCallback(async () => {
    const data = await fetch('/api/leads').then(r => r.json()).catch(() => [])
    setLeads(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openEdit(lead: Lead) {
    setSelected(lead)
    setEditForm({
      company_name: lead.company_name,
      contact_name: lead.contact_name ?? '',
      contact_phone: lead.contact_phone ?? '',
      contact_email: lead.contact_email ?? '',
      instagram: lead.instagram ?? '',
      origem: lead.origem ?? '',
      responsavel: lead.responsavel ?? '',
      estimated_value: lead.estimated_value ? String(lead.estimated_value) : '',
      notes: lead.notes ?? '',
      last_contact_at: lead.last_contact_at ?? '',
    })
  }

  async function saveEdit() {
    if (!selected) return
    setSaving(true)
    const res = await fetch(`/api/leads/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, estimated_value: editForm.estimated_value ? Number(editForm.estimated_value) : null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setLeads(ls => ls.map(l => l.id === updated.id ? updated : l))
      setSelected(updated)
    }
    setSaving(false)
  }

  async function deleteLead() {
    if (!selected) return
    if (!confirm(`Apagar o lead "${selected.company_name}"? Esta ação não pode ser desfeita.`)) return
    setDeleting(true)
    await fetch(`/api/leads/${selected.id}`, { method: 'DELETE' })
    setLeads(ls => ls.filter(l => l.id !== selected.id))
    setDeleting(false)
    setSelected(null)
  }

  async function moveLead(id: string, newStage: string) {
    setLeads(ls => ls.map(l => l.id === id ? { ...l, stage: newStage } : l))
    await fetch(`/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })
  }

  async function convertToClient(lead: Lead) {
    setConverting(true)
    await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: lead.company_name,
        email: lead.contact_email ?? '',
        phone: lead.contact_phone ?? '',
        status: 'ativo',
        notes: [lead.notes, lead.instagram ? `Instagram: ${lead.instagram}` : ''].filter(Boolean).join('\n'),
      }),
    })
    setConvertedId(lead.id)
    setConverting(false)
    setTimeout(() => setConvertedId(null), 4000)
  }

  async function addLead(stage: string) {
    if (!newForm.company_name.trim()) return
    setAddSaving(true)
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newForm,
        stage,
        estimated_value: newForm.estimated_value ? Number(newForm.estimated_value) : null,
      }),
    })
    if (res.ok) {
      const lead = await res.json()
      setLeads(ls => [lead, ...ls])
      setNewForm({ ...EMPTY_FORM })
      setAddingStage(null)
    }
    setAddSaving(false)
  }

  function onDragStart(id: string) { draggingId.current = id }
  function onDrop(stage: string) {
    if (draggingId.current) moveLead(draggingId.current, stage)
    draggingId.current = null
  }

  const stageLeads = (stage: string) => leads.filter(l => l.stage === stage)
  const totalValue = (stage: string) => stageLeads(stage).reduce((s, l) => s + (l.estimated_value ?? 0), 0)
  const grandTotal = leads.filter(l => l.stage !== 'perdido').reduce((s, l) => s + (l.estimated_value ?? 0), 0)

  function formatDate(d: string) {
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  const stage = selected ? STAGES.find(s => s.key === selected.stage) : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pipeline de Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {leads.filter(l => l.stage !== 'perdido').length} leads · potencial {formatBRL(grandTotal)}
          </p>
        </div>
        <button
          onClick={() => { setAddingStage('novo_lead'); setNewForm({ ...EMPTY_FORM }) }}
          className="flex items-center gap-2 px-4 py-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm rounded-lg transition-colors"
        >
          <Plus size={14} /> Novo lead
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="pb-4">
        <div className="flex flex-col gap-3 md:grid md:grid-cols-4">
          {STAGES.map(s => {
            const cards = stageLeads(s.key)
            const val = totalValue(s.key)
            const isAdding = addingStage === s.key

            return (
              <div
                key={s.key}
                className="flex flex-col rounded-xl min-h-[60px] w-full"
                style={{ background: s.bg, border: `1px solid ${s.color}22` }}
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop(s.key)}
              >
                {/* Cabeçalho */}
                <div className="px-3 pt-3 pb-2">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="text-xs font-semibold">{s.label}</span>
                      <span className="text-[10px] text-muted-foreground bg-[#111] px-1.5 py-0.5 rounded-full">{cards.length}</span>
                    </div>
                    <button onClick={() => { setAddingStage(s.key); setNewForm({ ...EMPTY_FORM }) }}
                      className="text-muted-foreground hover:text-foreground transition-colors">
                      <Plus size={13} />
                    </button>
                  </div>
                  {val > 0 && <p className="text-[10px] font-medium pl-4" style={{ color: s.color }}>{formatBRL(val)}</p>}
                </div>

                {/* Form rápido de adição */}
                {isAdding && (
                  <div className="mx-2 mb-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 space-y-2">
                    <input autoFocus placeholder="Nome da empresa *"
                      value={newForm.company_name} onChange={e => setNewForm(f => ({ ...f, company_name: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') addLead(s.key); if (e.key === 'Escape') setAddingStage(null) }}
                      className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                    <input placeholder="Nome do contato"
                      value={newForm.contact_name} onChange={e => setNewForm(f => ({ ...f, contact_name: e.target.value }))}
                      className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                    <input placeholder="Valor esperado (R$)" type="number"
                      value={newForm.estimated_value} onChange={e => setNewForm(f => ({ ...f, estimated_value: e.target.value }))}
                      className="w-full bg-[#111] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                    <div className="flex gap-1.5">
                      <button onClick={() => setAddingStage(null)}
                        className="flex-1 text-[10px] border border-[#2a2a2a] py-1.5 rounded-lg hover:bg-[#222] transition-colors">Cancelar</button>
                      <button onClick={() => addLead(s.key)} disabled={addSaving || !newForm.company_name.trim()}
                        className="flex-1 text-[10px] bg-[#7c3aed] hover:bg-[#6d28d9] text-white py-1.5 rounded-lg transition-colors disabled:opacity-40">
                        {addSaving ? '...' : 'Adicionar'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Cards */}
                <div className="px-2 pb-3 space-y-2 flex-1">
                  {cards.map(lead => (
                    <div key={lead.id} draggable onDragStart={() => onDragStart(lead.id)}
                      onClick={() => openEdit(lead)}
                      className="bg-[#111111] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-lg p-3 cursor-pointer transition-all group select-none">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <p className="text-xs font-semibold leading-snug line-clamp-2">{lead.company_name}</p>
                        <Pencil size={10} className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
                      </div>
                      {lead.contact_name && <p className="text-[10px] text-muted-foreground truncate mb-1">{lead.contact_name}</p>}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {lead.estimated_value && (
                          <p className="text-[11px] font-semibold" style={{ color: s.color }}>{formatBRL(lead.estimated_value)}</p>
                        )}
                        {lead.origem && (
                          <span className="text-[9px] bg-[#1a1a1a] border border-[#2a2a2a] px-1.5 py-0.5 rounded-full text-muted-foreground">{lead.origem}</span>
                        )}
                      </div>
                      {lead.responsavel && (
                        <p className="text-[9px] text-muted-foreground truncate mb-1">👤 {lead.responsavel}</p>
                      )}
                      {lead.notes && <p className="text-[9px] text-muted-foreground line-clamp-2 leading-relaxed">{lead.notes}</p>}
                      <div className="flex items-center justify-between mt-1.5">
                        {lead.last_contact_at
                          ? <span className="text-[9px] text-muted-foreground">Contato: {formatDate(lead.last_contact_at)}</span>
                          : <span />}
                        {convertedId === lead.id && (
                          <span className="text-[9px] text-green-400 flex items-center gap-0.5"><Check size={9} /> Criado</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && !isAdding && (
                    <div className="text-center py-6">
                      <p className="text-[10px] text-muted-foreground">Nenhum lead</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
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
                {stage && <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />}
                <span className="text-sm font-medium truncate">{selected.company_name}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* Estágios */}
              <div>
                <label className="text-xs text-muted-foreground block mb-2">Estágio</label>
                <div className="flex flex-wrap gap-1.5">
                  {STAGES.map(st => (
                    <button key={st.key}
                      onClick={() => { moveLead(selected.id, st.key); setSelected(prev => prev ? { ...prev, stage: st.key } : prev) }}
                      className="text-[10px] px-2.5 py-1 rounded-full border transition-all"
                      style={selected.stage === st.key
                        ? { backgroundColor: st.color + '30', borderColor: st.color, color: st.color }
                        : { borderColor: '#2a2a2a', color: '#666' }}>
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Converter em cliente */}
              {selected.stage === 'fechado' && convertedId !== selected.id && (
                <button onClick={() => convertToClient(selected)} disabled={converting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-sm font-medium hover:bg-[#22c55e]/20 transition-colors disabled:opacity-50">
                  <UserPlus size={14} />
                  {converting ? 'Criando...' : 'Converter em cliente'}
                  <ChevronRight size={13} />
                </button>
              )}
              {convertedId === selected.id && (
                <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/30 text-[#22c55e] text-sm">
                  <Check size={14} /> Cliente criado com sucesso
                </div>
              )}

              {/* Campos */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><FileText size={10} /> Empresa</label>
                  <input value={editForm.company_name} onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed]" />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><User size={10} /> Nome do contato</label>
                  <input placeholder="Nome" value={editForm.contact_name} onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><Phone size={10} /> WhatsApp</label>
                    <input placeholder="(11) 99999-9999" value={editForm.contact_phone} onChange={e => setEditForm(f => ({ ...f, contact_phone: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><DollarSign size={10} /> Valor esperado</label>
                    <input type="number" placeholder="3000" value={editForm.estimated_value} onChange={e => setEditForm(f => ({ ...f, estimated_value: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><Mail size={10} /> Email</label>
                  <input type="email" placeholder="contato@empresa.com" value={editForm.contact_email} onChange={e => setEditForm(f => ({ ...f, contact_email: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                </div>

                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><AtSign size={10} /> Instagram</label>
                  <input placeholder="@empresa" value={editForm.instagram} onChange={e => setEditForm(f => ({ ...f, instagram: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><MapPin size={10} /> Origem</label>
                    <select value={editForm.origem} onChange={e => setEditForm(f => ({ ...f, origem: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] text-foreground">
                      <option value="">Selecionar</option>
                      {ORIGEM_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><User size={10} /> Responsável</label>
                    <input placeholder="Ex: Gustavo" value={editForm.responsavel} onChange={e => setEditForm(f => ({ ...f, responsavel: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1.5"><Calendar size={10} /> Último contato</label>
                  <input type="date" value={editForm.last_contact_at} onChange={e => setEditForm(f => ({ ...f, last_contact_at: e.target.value }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed]" />
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
              <button onClick={deleteLead} disabled={deleting}
                className="flex items-center gap-1.5 text-xs border border-[#ef4444]/30 text-[#ef4444]/70 hover:text-[#ef4444] hover:bg-[#ef4444]/10 px-3 py-2 rounded-lg transition-colors disabled:opacity-40">
                <Trash2 size={12} /> {deleting ? 'Apagando...' : 'Apagar'}
              </button>
              <button onClick={saveEdit} disabled={saving || !editForm.company_name.trim()}
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
