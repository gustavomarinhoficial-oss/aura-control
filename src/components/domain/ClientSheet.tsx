'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Plus, CheckCircle, XCircle, AlertCircle, Clock, Edit2, Check } from 'lucide-react'
import { formatBRL, formatDate } from '@/lib/utils/format'
import type { Client, Service, ClientStatusHistory } from '@/lib/supabase/types'

type FullClient = Client & { services: Service[]; status_history: ClientStatusHistory[] }

const statusOpts = ['ativo', 'pausado', 'encerrado'] as const
const statusLabel: Record<string, string> = { ativo: 'Ativo', pausado: 'Pausado', encerrado: 'Encerrado' }
const statusColor: Record<string, string> = {
  ativo: 'text-[#22c55e]', pausado: 'text-[#f59e0b]', encerrado: 'text-muted-foreground',
}
const recurrenceLabel: Record<string, string> = { mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual', 'único': 'Único' }

interface Props { clientId: string; onClose: () => void; onRefresh: () => void }

export function ClientSheet({ clientId, onClose, onRefresh }: Props) {
  const [client, setClient] = useState<FullClient | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Client>>({})
  const [saving, setSaving] = useState(false)
  const [showNewService, setShowNewService] = useState(false)
  const [savingService, setSavingService] = useState(false)
  const [serviceError, setServiceError] = useState('')
  const [newService, setNewService] = useState({ name: '', type: 'recorrente', amount: '', recurrence: 'mensal', started_at: new Date().toISOString().split('T')[0], contract_end: '', billing_day: '' })
  const [editingService, setEditingService] = useState<string | null>(null)
  const [editServiceForm, setEditServiceForm] = useState<{ name: string; amount: string; recurrence: string; contract_end: string }>({ name: '', amount: '', recurrence: 'mensal', contract_end: '' })
  const [savingEditService, setSavingEditService] = useState(false)
  const newServiceRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  function load() {
    setLoading(true)
    fetch(`/api/clients/${clientId}`)
      .then(r => r.json())
      .then(d => { setClient(d); setForm(d); setLoading(false) })
  }

  useEffect(() => { load() }, [clientId])

  useEffect(() => {
    if (showNewService && newServiceRef.current) {
      setTimeout(() => {
        newServiceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
    }
  }, [showNewService])

  async function saveClient() {
    setSaving(true)
    await fetch(`/api/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setEditing(false)
    load()
    onRefresh()
  }

  async function addService() {
    setServiceError('')
    if (!newService.name.trim()) { setServiceError('Informe o nome do serviço'); return }
    if (!newService.amount || isNaN(parseFloat(newService.amount))) { setServiceError('Informe o valor'); return }

    setSavingService(true)
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newService, client_id: clientId, amount: parseFloat(newService.amount), contract_end: newService.contract_end || null }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      setServiceError(err.error ?? 'Erro ao salvar serviço')
      setSavingService(false)
      return
    }

    setSavingService(false)
    setShowNewService(false)
    setNewService({ name: '', type: 'recorrente', amount: '', recurrence: 'mensal', started_at: new Date().toISOString().split('T')[0], contract_end: '', billing_day: '' })
    setServiceError('')
    load()
    onRefresh()
  }

  async function toggleService(serviceId: string, active: boolean) {
    await fetch(`/api/services/${serviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    })
    load()
    onRefresh()
  }

  function startEditService(s: Service) {
    setEditingService(s.id)
    setEditServiceForm({
      name: s.name,
      amount: String(s.amount),
      recurrence: s.recurrence ?? 'mensal',
      contract_end: s.contract_end ?? '',
    })
  }

  async function saveEditService(serviceId: string) {
    setSavingEditService(true)
    await fetch(`/api/services/${serviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editServiceForm.name,
        amount: parseFloat(editServiceForm.amount),
        recurrence: editServiceForm.recurrence,
        contract_end: editServiceForm.contract_end || null,
      }),
    })
    setSavingEditService(false)
    setEditingService(null)
    load()
    onRefresh()
  }

  if (loading || !client) return null

  const mrr = client.services.filter(s => s.type === 'recorrente' && s.active).reduce((sum, s) => sum + Number(s.amount), 0)

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={sheetRef} className="w-full max-w-md bg-[#111111] border-l border-[#2a2a2a] flex flex-col h-full overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#2a2a2a] sticky top-0 bg-[#111111] z-10">
          <div>
            <h2 className="text-base font-semibold">{client.name}</h2>
            <span className={`text-xs ${statusColor[client.status]}`}>{statusLabel[client.status]}</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={16} /></button>
        </div>

        <div className="flex-1 p-6 space-y-8">
          {/* Dados do cliente */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Dados</h3>
              {!editing
                ? <button onClick={() => setEditing(true)} className="text-xs text-[#7c3aed] hover:text-[#a78bfa] transition-colors">Editar</button>
                : <div className="flex gap-3">
                    <button onClick={() => setEditing(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
                    <button onClick={saveClient} disabled={saving} className="text-xs text-[#7c3aed] hover:text-[#a78bfa] transition-colors">{saving ? 'Salvando...' : 'Salvar'}</button>
                  </div>
              }
            </div>

            {editing ? (
              <div className="space-y-3">
                <EditField label="Nome" value={form.name ?? ''} onChange={v => setForm(f => ({ ...f, name: v }))} />
                <EditField label="Email" value={form.email ?? ''} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" />
                <EditField label="Telefone" value={form.phone ?? ''} onChange={v => setForm(f => ({ ...f, phone: v }))} />
                <EditField label="Cliente desde" value={form.started_at ?? ''} onChange={v => setForm(f => ({ ...f, started_at: v }))} type="date" />
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Dia de vencimento</label>
                  <select
                    value={form.billing_day ?? ''}
                    onChange={e => setForm(f => ({ ...f, billing_day: e.target.value ? parseInt(e.target.value) : null }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
                  >
                    <option value="">Não definido</option>
                    {[1,5,10,15,20,25,28].map(d => <option key={d} value={d}>Todo dia {d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as Client['status'] }))}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
                  >
                    {statusOpts.map(s => <option key={s} value={s}>{statusLabel[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Observações</label>
                  <textarea
                    value={form.notes ?? ''}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors resize-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {client.email && <InfoRow label="Email" value={client.email} />}
                {client.phone && <InfoRow label="Telefone" value={client.phone} />}
                <InfoRow label="Desde" value={formatDate(client.started_at)} />
                {client.billing_day && <InfoRow label="Vencimento" value={`Todo dia ${client.billing_day}`} />}
                <InfoRow label="MRR" value={formatBRL(mrr)} />
                {client.notes && <InfoRow label="Obs." value={client.notes} />}
              </div>
            )}
          </section>

          {/* Serviços */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Serviços</h3>
              <button
                onClick={() => setShowNewService(v => !v)}
                className="flex items-center gap-1 text-xs text-[#7c3aed] hover:text-[#a78bfa] transition-colors"
              >
                <Plus size={12} /> Adicionar
              </button>
            </div>

            {showNewService && (
              <div ref={newServiceRef} className="bg-[#1a1a1a] border border-[#7c3aed]/30 rounded-lg p-4 mb-4 space-y-3">
                <EditField label="Nome do serviço" value={newService.name} onChange={v => setNewService(s => ({ ...s, name: v }))} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Tipo</label>
                    <select value={newService.type} onChange={e => setNewService(s => ({ ...s, type: e.target.value }))} className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-2 py-2 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors">
                      <option value="recorrente">Recorrente</option>
                      <option value="avulso">Avulso</option>
                    </select>
                  </div>
                  {newService.type === 'recorrente' && (
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Recorrência</label>
                      <select value={newService.recurrence} onChange={e => setNewService(s => ({ ...s, recurrence: e.target.value }))} className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-2 py-2 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors">
                        <option value="mensal">Mensal</option>
                        <option value="trimestral">Trimestral</option>
                        <option value="anual">Anual</option>
                      </select>
                    </div>
                  )}
                </div>
                <EditField label="Valor (R$)" value={newService.amount} onChange={v => setNewService(s => ({ ...s, amount: v }))} type="number" />
                <EditField label="Início" value={newService.started_at} onChange={v => setNewService(s => ({ ...s, started_at: v }))} type="date" />
                {newService.type === 'recorrente' && client.billing_day && (
                  <p className="text-[10px] text-muted-foreground">Cobranças geradas no dia <span className="text-foreground font-medium">{client.billing_day}</span> de cada mês (vencimento do cliente).</p>
                )}
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Término do contrato <span className="text-[#555]">(opcional)</span></label>
                  <input
                    type="date"
                    value={newService.contract_end}
                    onChange={e => setNewService(s => ({ ...s, contract_end: e.target.value }))}
                    className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Se vazio, o serviço continua até ser encerrado manualmente.</p>
                </div>

                {serviceError && (
                  <div className="flex items-center gap-2 text-xs text-[#ef4444]">
                    <AlertCircle size={12} />
                    {serviceError}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setShowNewService(false); setServiceError('') }}
                    className="flex-1 border border-[#2a2a2a] text-xs py-2 rounded-lg hover:bg-[#222222] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={addService}
                    disabled={savingService}
                    className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {savingService ? 'Salvando...' : 'Salvar serviço'}
                  </button>
                </div>
              </div>
            )}

            {client.services.length === 0 && !showNewService ? (
              <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado</p>
            ) : (
              <div className="space-y-2">
                {client.services.map(s => (
                  <div key={s.id} className={`rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] ${!s.active ? 'opacity-50' : ''}`}>
                    {editingService === s.id ? (
                      <div className="p-3 space-y-2.5">
                        <div>
                          <label className="block text-[10px] text-muted-foreground mb-1">Nome</label>
                          <input
                            type="text"
                            value={editServiceForm.name}
                            onChange={e => setEditServiceForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] text-muted-foreground mb-1">Valor (R$)</label>
                            <input
                              type="number"
                              value={editServiceForm.amount}
                              onChange={e => setEditServiceForm(f => ({ ...f, amount: e.target.value }))}
                              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
                            />
                          </div>
                          {s.type === 'recorrente' && (
                            <div>
                              <label className="block text-[10px] text-muted-foreground mb-1">Recorrência</label>
                              <select
                                value={editServiceForm.recurrence}
                                onChange={e => setEditServiceForm(f => ({ ...f, recurrence: e.target.value }))}
                                className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
                              >
                                <option value="mensal">Mensal</option>
                                <option value="trimestral">Trimestral</option>
                                <option value="anual">Anual</option>
                              </select>
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="block text-[10px] text-muted-foreground mb-1">Término do contrato <span className="text-[#555]">(opcional)</span></label>
                          <input
                            type="date"
                            value={editServiceForm.contract_end}
                            onChange={e => setEditServiceForm(f => ({ ...f, contract_end: e.target.value }))}
                            className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => setEditingService(null)}
                            className="flex-1 border border-[#2a2a2a] text-xs py-1.5 rounded-lg hover:bg-[#222222] transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => saveEditService(s.id)}
                            disabled={savingEditService}
                            className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs py-1.5 rounded-lg transition-colors disabled:opacity-60"
                          >
                            {savingEditService ? 'Salvando...' : 'Salvar'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3">
                        <div>
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.type === 'recorrente' ? recurrenceLabel[s.recurrence ?? 'mensal'] : 'Avulso'} · {formatBRL(Number(s.amount))}
                          </p>
                          {s.contract_end && (() => {
                            const today = new Date().toISOString().split('T')[0]
                            const daysLeft = Math.round((new Date(s.contract_end + 'T12:00:00Z').getTime() - new Date(today + 'T12:00:00Z').getTime()) / 86400000)
                            const isExpired = daysLeft < 0
                            const isSoon = daysLeft >= 0 && daysLeft <= 30
                            return (
                              <span className={`flex items-center gap-1 text-[10px] mt-0.5 ${isExpired ? 'text-[#ef4444]' : isSoon ? 'text-[#f59e0b]' : 'text-muted-foreground'}`}>
                                <Clock size={9} />
                                {isExpired ? `Vencido há ${Math.abs(daysLeft)}d` : isSoon ? `Renova em ${daysLeft}d` : `Até ${formatDate(s.contract_end)}`}
                              </span>
                            )
                          })()}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEditService(s)} className="text-muted-foreground hover:text-[#a78bfa] transition-colors">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => toggleService(s.id, s.active)} className="text-muted-foreground hover:text-foreground transition-colors">
                            {s.active ? <CheckCircle size={15} className="text-[#22c55e]" /> : <XCircle size={15} />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Histórico de status */}
          {client.status_history.length > 0 && (
            <section>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Histórico de status</h3>
              <div className="space-y-2">
                {client.status_history.map(h => (
                  <div key={h.id} className="text-xs text-muted-foreground flex gap-2">
                    <span>{formatDate(h.changed_at)}</span>
                    <span>·</span>
                    <span>{statusLabel[h.old_status ?? '']} → {statusLabel[h.new_status]}</span>
                    {h.note && <span>· {h.note}</span>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  )
}

function EditField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
      />
    </div>
  )
}
