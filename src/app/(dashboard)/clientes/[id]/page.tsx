'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { formatBRL, formatDate } from '@/lib/utils/format'
import {
  ArrowLeft, Edit2, Check, X, Plus, CheckCircle, XCircle,
  Mail, Phone, Calendar, FileText, TrendingUp, DollarSign, AlertCircle,
  MessageCircle, Copy, Trash2, Clock, Upload, Download, File,
  Eye, EyeOff, Link, AtSign, Globe, Lock, User2
} from 'lucide-react'
import type { Client, Service, ClientStatusHistory, Charge, Task } from '@/lib/supabase/types'

type FullClient = Client & { services: Service[]; status_history: ClientStatusHistory[] }

const statusLabel: Record<string, string> = { ativo: 'Ativo', pausado: 'Pausado', encerrado: 'Encerrado' }
const statusBadge: Record<string, string> = {
  ativo: 'text-[#22c55e] bg-[#22c55e]/10',
  pausado: 'text-[#f59e0b] bg-[#f59e0b]/10',
  encerrado: 'text-muted-foreground bg-[#2a2a2a]',
}
const recurrenceLabel: Record<string, string> = { mensal: 'Mensal', trimestral: 'Trimestral', anual: 'Anual', 'único': 'Único' }
const chargeStatusStyle: Record<string, string> = {
  pago: 'text-[#22c55e] bg-[#22c55e]/10',
  pendente: 'text-muted-foreground bg-[#2a2a2a]',
  atrasado: 'text-[#ef4444] bg-[#ef4444]/10',
  encerrado: 'text-muted-foreground/40 bg-[#2a2a2a]',
}
const chargeStatusLabel: Record<string, string> = { pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado', encerrado: 'Encerrado' }

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [client, setClient] = useState<FullClient | null>(null)
  const [charges, setCharges] = useState<Charge[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<Client>>({})
  const [saving, setSaving] = useState(false)
  const [showNewService, setShowNewService] = useState(false)
  const [savingService, setSavingService] = useState(false)
  const [serviceError, setServiceError] = useState('')
  const [newService, setNewService] = useState({ name: '', type: 'recorrente', amount: '', recurrence: 'mensal', started_at: new Date().toISOString().split('T')[0] })
  const [editingService, setEditingService] = useState<string | null>(null)
  const [editServiceForm, setEditServiceForm] = useState({ name: '', amount: '', recurrence: 'mensal', contract_end: '' })
  const [savingEditService, setSavingEditService] = useState(false)
  const [activeTab, setActiveTab] = useState<'visao' | 'servicos' | 'financeiro' | 'tarefas' | 'documentos' | 'historico' | 'dados'>('visao')
  type FileEntry = { name: string; metadata?: { size?: number } }
  type FilesGrouped = { contratos: FileEntry[]; 'identidade-visual': FileEntry[]; financeiro: FileEntry[] }
  const FOLDERS = [
    { key: 'contratos', label: 'Contratos' },
    { key: 'identidade-visual', label: 'Identidade Visual' },
    { key: 'financeiro', label: 'Financeiro' },
  ] as const
  const [files, setFiles] = useState<FilesGrouped>({ contratos: [], 'identidade-visual': [], financeiro: [] })
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [pendingFolder, setPendingFolder] = useState<typeof FOLDERS[number]['key']>('contratos')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [whatsAppCharge, setWhatsAppCharge] = useState<(Charge & { status: string }) | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  type SocialEntry = { platform: string; handle: string }
  type LinkEntry = { label: string; url: string }
  type PasswordEntry = { label: string; username: string; password: string; url: string }
  type ClientExtras = { responsavel: string; objectives: string; social_media: SocialEntry[]; links: LinkEntry[]; passwords: PasswordEntry[] }
  const EMPTY_EXTRAS: ClientExtras = { responsavel: '', objectives: '', social_media: [], links: [], passwords: [] }
  const [extras, setExtras] = useState<ClientExtras>(EMPTY_EXTRAS)
  const [extrasSaving, setExtrasSaving] = useState(false)
  const [revealedPasswords, setRevealedPasswords] = useState<Set<number>>(new Set())
  const SOCIAL_PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'TikTok', 'YouTube', 'Twitter/X', 'Pinterest', 'Outro']

  const load = useCallback(async () => {
    setLoading(true)
    const [clientRes, chargesRes, tasksRes] = await Promise.all([
      fetch(`/api/clients/${id}`).then(r => r.json()),
      fetch(`/api/charges?client_id=${id}`).then(r => r.json()),
      fetch(`/api/tasks?client_id=${id}`).then(r => r.json()).catch(() => []),
    ])
    setClient(clientRes)
    setForm(clientRes)
    setCharges(Array.isArray(chargesRes) ? chargesRes : [])
    setTasks(Array.isArray(tasksRes) ? tasksRes : [])
    setLoading(false)
  }, [id])

  const loadFiles = useCallback(async () => {
    const res = await fetch(`/api/clients/${id}/files`).then(r => r.json()).catch(() => ({}))
    setFiles({ contratos: res.contratos ?? [], 'identidade-visual': res['identidade-visual'] ?? [], financeiro: res.financeiro ?? [] })
  }, [id])

  function detectFolder(filename: string): typeof FOLDERS[number]['key'] {
    const n = filename.toLowerCase()
    if (/contrat|acordo|proposta|nda|distrat|aditiv|term/.test(n)) return 'contratos'
    if (/logo|brand|identidade|visual|marca|icon|fonte|paleta|cor|design|arte|criativ/.test(n)) return 'identidade-visual'
    if (/comprovante|pagamento|recibo|nota.?fiscal|boleto|pix|transf|fatura|invoice|financ|pgto|receit/.test(n)) return 'financeiro'
    return 'contratos'
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setPendingFolder(detectFolder(file.name))
    e.target.value = ''
  }

  async function confirmUpload() {
    if (!pendingFile) return
    setUploading(true)
    setUploadError('')
    const form = new FormData()
    form.append('file', pendingFile)
    form.append('folder', pendingFolder)
    const res = await fetch(`/api/clients/${id}/files`, { method: 'POST', body: form })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setUploadError(d.error ?? 'Erro ao enviar arquivo')
    } else {
      setPendingFile(null)
      await loadFiles()
    }
    setUploading(false)
  }

  async function downloadFile(folder: string, filename: string, original: string) {
    const res = await fetch(`/api/clients/${id}/files/${folder}?name=${encodeURIComponent(filename)}`)
    const data = await res.json()
    if (data.url) {
      const a = document.createElement('a')
      a.href = data.url
      a.download = original
      a.target = '_blank'
      a.click()
    }
  }

  async function deleteFile(folder: string, filename: string) {
    if (!confirm('Apagar este arquivo?')) return
    await fetch(`/api/clients/${id}/files/${folder}?name=${encodeURIComponent(filename)}`, { method: 'DELETE' })
    await loadFiles()
  }

  const loadExtras = useCallback(async () => {
    const res = await fetch(`/api/clients/${id}/extras`).then(r => r.json()).catch(() => EMPTY_EXTRAS)
    setExtras({ responsavel: res.responsavel ?? '', objectives: res.objectives ?? '', social_media: res.social_media ?? [], links: res.links ?? [], passwords: res.passwords ?? [] })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function saveExtras(override?: Partial<typeof EMPTY_EXTRAS>) {
    setExtrasSaving(true)
    const payload = override ? { ...extras, ...override } : extras
    await fetch(`/api/clients/${id}/extras`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setExtrasSaving(false)
  }

  useEffect(() => { load() }, [load])
  useEffect(() => { loadFiles() }, [loadFiles])
  useEffect(() => { loadExtras() }, [loadExtras])

  async function saveClient() {
    setSaving(true)
    await fetch(`/api/clients/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    setEditing(false)
    load()
  }

  async function addService() {
    setServiceError('')
    if (!newService.name.trim()) { setServiceError('Informe o nome'); return }
    if (!newService.amount || isNaN(parseFloat(newService.amount))) { setServiceError('Informe o valor'); return }
    setSavingService(true)
    const res = await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newService, client_id: id, amount: parseFloat(newService.amount) }),
    })
    if (!res.ok) { setServiceError('Erro ao salvar'); setSavingService(false); return }
    setSavingService(false)
    setShowNewService(false)
    setNewService({ name: '', type: 'recorrente', amount: '', recurrence: 'mensal', started_at: new Date().toISOString().split('T')[0] })
    load()
  }

  function startEditService(s: Service) {
    setEditingService(s.id)
    setEditServiceForm({ name: s.name, amount: String(s.amount), recurrence: s.recurrence ?? 'mensal', contract_end: s.contract_end ?? '' })
  }

  async function saveEditService(serviceId: string) {
    setSavingEditService(true)
    await fetch(`/api/services/${serviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editServiceForm.name, amount: parseFloat(editServiceForm.amount), recurrence: editServiceForm.recurrence, contract_end: editServiceForm.contract_end || null }),
    })
    setSavingEditService(false)
    setEditingService(null)
    load()
  }

  async function toggleService(serviceId: string, active: boolean) {
    await fetch(`/api/services/${serviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !active }),
    })
    load()
  }

  async function deleteClient() {
    setDeleting(true)
    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
    router.push('/clientes')
  }

  async function markPaid(chargeId: string, isPaid: boolean) {
    await fetch(`/api/charges/${chargeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: isPaid ? 'unpay' : 'pay' }),
    })
    load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Cliente não encontrado</p>
        <button onClick={() => router.push('/clientes')} className="text-[#7c3aed] text-sm mt-2 hover:underline">Voltar</button>
      </div>
    )
  }

  const mrr = client.services.filter(s => s.type === 'recorrente' && s.active).reduce((sum, s) => sum + Number(s.amount), 0)
  const activeServices = client.services.filter(s => s.active).length
  const chargesWithStatus = charges.map(c => {
    let status = 'pendente'
    if (c.paid_at) status = 'pago'
    else if ((c as Charge & { services?: { active: boolean } | null }).services?.active === false) status = 'encerrado'
    else if (new Date(c.due_date) < new Date(new Date().toDateString())) status = 'atrasado'
    return { ...c, status }
  })
  const totalReceived = chargesWithStatus.filter(c => c.status === 'pago').reduce((sum, c) => sum + Number(c.amount), 0)
  const totalPending = chargesWithStatus.filter(c => c.status === 'pendente').reduce((sum, c) => sum + Number(c.amount), 0)
  const totalOverdue = chargesWithStatus.filter(c => c.status === 'atrasado').reduce((sum, c) => sum + Number(c.amount), 0)

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push('/clientes')}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={12} /> Clientes
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7c3aed]/30 to-[#7c3aed]/10 border border-[#7c3aed]/20 flex items-center justify-center">
              <span className="text-lg font-bold text-[#a78bfa]">{client.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold tracking-tight">{client.name}</h1>
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${statusBadge[client.status]}`}>
                  {statusLabel[client.status]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Cliente desde {formatDate(client.started_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 border border-[#2a2a2a] text-sm px-3 py-2 rounded-lg hover:bg-[#1a1a1a] transition-colors text-muted-foreground hover:text-foreground"
            >
              <Edit2 size={13} /> Editar
            </button>
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-2 border border-[#ef4444]/30 text-sm px-3 py-2 rounded-lg hover:bg-[#ef4444]/10 transition-colors text-[#ef4444]/70 hover:text-[#ef4444]"
            >
              <Trash2 size={13} /> Excluir
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={13} className="text-[#7c3aed]" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">MRR</span>
          </div>
          <p className="text-xl font-semibold">{formatBRL(mrr)}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={13} className="text-[#22c55e]" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Recebido total</span>
          </div>
          <p className="text-xl font-semibold text-[#22c55e]">{formatBRL(totalReceived)}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={13} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Serviços ativos</span>
          </div>
          <p className="text-xl font-semibold">{activeServices}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={13} className={totalOverdue > 0 ? 'text-[#ef4444]' : 'text-muted-foreground'} />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Em atraso</span>
          </div>
          <p className={`text-xl font-semibold ${totalOverdue > 0 ? 'text-[#ef4444]' : ''}`}>{formatBRL(totalOverdue)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1 w-fit">
        {([['visao', 'Visão geral'], ['servicos', 'Serviços'], ['financeiro', 'Financeiro'], ['tarefas', 'Tarefas'], ['documentos', 'Documentos'], ['historico', 'Histórico'], ['dados', 'Dados']] as const).map(([tab, lbl]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === tab ? 'bg-[#2a2a2a] text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {/* Tab: Visão geral */}
      {activeTab === 'visao' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Informações</h3>
            <div className="space-y-3">
              {client.email && (
                <div className="flex items-center gap-3">
                  <Mail size={13} className="text-muted-foreground shrink-0" />
                  <span className="text-sm">{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-3">
                  <Phone size={13} className="text-muted-foreground shrink-0" />
                  <span className="text-sm">{client.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Calendar size={13} className="text-muted-foreground shrink-0" />
                <span className="text-sm">Cliente desde {formatDate(client.started_at)}</span>
              </div>
              {client.billing_day && (
                <div className="flex items-center gap-3">
                  <Clock size={13} className="text-muted-foreground shrink-0" />
                  <span className="text-sm">Vence todo dia <span className="font-semibold text-[#a78bfa]">{client.billing_day}</span></span>
                </div>
              )}
            </div>
            {client.notes && (
              <>
                <div className="border-t border-[#2a2a2a] pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Observações</p>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{client.notes}</p>
                </div>
              </>
            )}
          </div>

          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Resumo financeiro</h3>
            <div className="space-y-3">
              {[
                { label: 'MRR atual', value: formatBRL(mrr), color: 'text-[#a78bfa]' },
                { label: 'Total recebido', value: formatBRL(totalReceived), color: 'text-[#22c55e]' },
                { label: 'Pendente', value: formatBRL(totalPending), color: 'text-muted-foreground' },
                { label: 'Atrasado', value: formatBRL(totalOverdue), color: totalOverdue > 0 ? 'text-[#ef4444]' : 'text-muted-foreground' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className={`text-sm font-semibold ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Serviços */}
      {activeTab === 'servicos' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowNewService(v => !v)}
              className="flex items-center gap-2 text-sm text-[#7c3aed] hover:text-[#a78bfa] transition-colors"
            >
              <Plus size={14} /> Adicionar serviço
            </button>
          </div>

          {showNewService && (
            <div className="bg-[#1a1a1a] border border-[#7c3aed]/30 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-medium">Novo serviço</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Nome *</label>
                  <input
                    type="text"
                    value={newService.name}
                    onChange={e => setNewService(s => ({ ...s, name: e.target.value }))}
                    className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    value={newService.amount}
                    onChange={e => setNewService(s => ({ ...s, amount: e.target.value }))}
                    className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Tipo</label>
                  <select value={newService.type} onChange={e => setNewService(s => ({ ...s, type: e.target.value }))} className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors">
                    <option value="recorrente">Recorrente</option>
                    <option value="avulso">Avulso</option>
                  </select>
                </div>
                {newService.type === 'recorrente' && (
                  <div>
                    <label className="block text-xs text-muted-foreground mb-1">Recorrência</label>
                    <select value={newService.recurrence} onChange={e => setNewService(s => ({ ...s, recurrence: e.target.value }))} className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors">
                      <option value="mensal">Mensal</option>
                      <option value="trimestral">Trimestral</option>
                      <option value="anual">Anual</option>
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Início</label>
                  <input type="date" value={newService.started_at} onChange={e => setNewService(s => ({ ...s, started_at: e.target.value }))} className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors" />
                </div>
              </div>
              {serviceError && <p className="text-xs text-[#ef4444] flex items-center gap-1"><AlertCircle size={11} />{serviceError}</p>}
              <div className="flex gap-3">
                <button onClick={() => { setShowNewService(false); setServiceError('') }} className="flex-1 border border-[#2a2a2a] text-sm py-2 rounded-lg hover:bg-[#222222] transition-colors">Cancelar</button>
                <button onClick={addService} disabled={savingService} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm py-2 rounded-lg transition-colors disabled:opacity-60">
                  {savingService ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          )}

          {client.services.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-10 text-center text-muted-foreground text-sm">
              Nenhum serviço cadastrado
            </div>
          ) : (
            <div className="space-y-2">
              {client.services.map(s => (
                <div key={s.id} className={`bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden transition-opacity ${!s.active ? 'opacity-50' : ''}`}>
                  {editingService === s.id ? (
                    <div className="px-5 py-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Nome</label>
                          <input type="text" value={editServiceForm.name} onChange={e => setEditServiceForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors" />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Valor (R$)</label>
                          <input type="number" value={editServiceForm.amount} onChange={e => setEditServiceForm(f => ({ ...f, amount: e.target.value }))} className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors" />
                        </div>
                        {s.type === 'recorrente' && (
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">Recorrência</label>
                            <select value={editServiceForm.recurrence} onChange={e => setEditServiceForm(f => ({ ...f, recurrence: e.target.value }))} className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors">
                              <option value="mensal">Mensal</option>
                              <option value="trimestral">Trimestral</option>
                              <option value="anual">Anual</option>
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1">Término do contrato</label>
                          <input type="date" value={editServiceForm.contract_end} onChange={e => setEditServiceForm(f => ({ ...f, contract_end: e.target.value }))} className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors" />
                        </div>
                      </div>
                      <div className="flex gap-3 pt-1">
                        <button onClick={() => setEditingService(null)} className="flex-1 border border-[#2a2a2a] text-sm py-2 rounded-lg hover:bg-[#222222] transition-colors">Cancelar</button>
                        <button onClick={() => saveEditService(s.id)} disabled={savingEditService} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm py-2 rounded-lg transition-colors disabled:opacity-60">
                          {savingEditService ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="px-5 py-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {s.type === 'recorrente' ? `Recorrente · ${recurrenceLabel[s.recurrence ?? 'mensal']}` : 'Avulso'}
                          {' · '}Início {formatDate(s.started_at)}
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
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">{formatBRL(Number(s.amount))}</span>
                        <button onClick={() => startEditService(s)} className="text-muted-foreground hover:text-[#a78bfa] transition-colors">
                          <Edit2 size={14} />
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
        </div>
      )}

      {/* Tab: Financeiro */}
      {activeTab === 'financeiro' && (
        <div className="space-y-4">
          {chargesWithStatus.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-10 text-center text-muted-foreground text-sm">
              Nenhuma cobrança registrada
            </div>
          ) : (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2a2a2a]">
                    {['Descrição', 'Vencimento', 'Valor', 'Status', ''].map(h => (
                      <th key={h} className="text-left text-xs text-muted-foreground font-medium px-5 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {chargesWithStatus.map(c => (
                    <tr key={c.id} className="border-b border-[#2a2a2a] last:border-0">
                      <td className="px-5 py-4 text-sm">{c.description}</td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">{formatDate(c.due_date)}</td>
                      <td className="px-5 py-4 text-sm font-medium">{formatBRL(Number(c.amount))}</td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${chargeStatusStyle[c.status]}`}>
                          {chargeStatusLabel[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => markPaid(c.id, !!c.paid_at)}
                            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                              c.paid_at
                                ? 'border border-[#2a2a2a] text-muted-foreground hover:text-foreground'
                                : 'bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 border border-[#22c55e]/20'
                            }`}
                          >
                            <Check size={11} />
                            {c.paid_at ? 'Desfazer' : 'Marcar pago'}
                          </button>
                          {!c.paid_at && c.status !== 'encerrado' && (
                            <button
                              onClick={() => setWhatsAppCharge(c as Charge & { status: string })}
                              title="Gerar cobrança via WhatsApp"
                              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-[#25d366]/30 text-[#25d366] hover:bg-[#25d366]/10 transition-colors"
                            >
                              <MessageCircle size={11} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Tarefas */}
      {activeTab === 'tarefas' && (
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-10 text-center text-muted-foreground text-sm">
              Nenhuma tarefa para este cliente
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map(task => {
                const today = new Date().toISOString().split('T')[0]
                const isOverdue = task.due_date && task.due_date < today && task.status !== 'concluido'
                const priorityColor = task.priority === 'alta' ? 'text-[#ef4444] bg-[#ef4444]/10' : task.priority === 'media' ? 'text-[#f59e0b] bg-[#f59e0b]/10' : 'text-muted-foreground bg-[#2a2a2a]'
                const statusColor = task.status === 'concluido' ? 'text-[#22c55e]' : task.status === 'em_andamento' ? 'text-[#f59e0b]' : 'text-muted-foreground'
                const statusDot = task.status === 'concluido' ? 'bg-[#22c55e]' : task.status === 'em_andamento' ? 'bg-[#f59e0b]' : 'bg-[#3a3a3a]'
                return (
                  <div key={task.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-5 py-4 flex items-start gap-4">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${statusDot}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.status === 'concluido' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</p>
                      {task.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${priorityColor}`}>{task.priority}</span>
                        <span className={`text-[10px] ${statusColor}`}>{task.status.replace('_', ' ')}</span>
                        {task.due_date && (
                          <span className={`text-[10px] ${isOverdue ? 'text-[#ef4444]' : 'text-muted-foreground'}`}>
                            {isOverdue ? '⚠ ' : ''}{formatDate(task.due_date)}
                          </span>
                        )}
                        {task.members && (
                          <span className="text-[10px] text-muted-foreground">{task.members.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Documentos */}
      {activeTab === 'documentos' && (
        <div className="space-y-4">
          {/* Upload */}
          {!pendingFile ? (
            <div className="bg-[#1a1a1a] border border-dashed border-[#3a3a3a] hover:border-[#7c3aed]/50 rounded-xl p-6 transition-colors">
              <label className="flex flex-col items-center gap-3 cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-[#7c3aed]/10 flex items-center justify-center">
                  <Upload size={18} className="text-[#a78bfa]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Clique para anexar um arquivo</p>
                  <p className="text-xs text-muted-foreground mt-0.5">PDF, Word, Excel, imagens — até 50 MB</p>
                </div>
                <input type="file" className="hidden" onChange={onFileSelected}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp" />
              </label>
            </div>
          ) : (
            <div className="bg-[#1a1a1a] border border-[#7c3aed]/30 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#7c3aed]/10 flex items-center justify-center shrink-0">
                  <File size={15} className="text-[#a78bfa]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{pendingFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {pendingFile.size > 1024 * 1024
                      ? `${(pendingFile.size / 1024 / 1024).toFixed(1)} MB`
                      : `${Math.round(pendingFile.size / 1024)} KB`}
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1.5">Pasta detectada automaticamente</label>
                <select
                  value={pendingFolder}
                  onChange={e => setPendingFolder(e.target.value as typeof pendingFolder)}
                  className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
                >
                  {FOLDERS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </div>
              {uploadError && (
                <p className="text-xs text-[#ef4444] flex items-center gap-1"><AlertCircle size={12} />{uploadError}</p>
              )}
              <div className="flex gap-3">
                <button onClick={() => { setPendingFile(null); setUploadError('') }}
                  className="flex-1 border border-[#2a2a2a] text-sm py-2 rounded-lg hover:bg-[#222] transition-colors">
                  Cancelar
                </button>
                <button onClick={confirmUpload} disabled={uploading}
                  className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm py-2 rounded-lg transition-colors disabled:opacity-60">
                  {uploading ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          )}

          {/* Pastas */}
          {FOLDERS.map(({ key, label }) => {
            const folderFiles = files[key] ?? []
            return (
              <div key={key} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 flex items-center gap-3 border-b border-[#2a2a2a]">
                  <FileText size={13} className="text-[#a78bfa] shrink-0" />
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{folderFiles.length} arquivo{folderFiles.length !== 1 ? 's' : ''}</span>
                </div>
                {folderFiles.length === 0 ? (
                  <p className="px-5 py-4 text-xs text-muted-foreground">Nenhum arquivo nesta pasta</p>
                ) : (
                  <div className="divide-y divide-[#2a2a2a]">
                    {folderFiles.map(f => {
                      const original = f.name.replace(/^\d+_/, '')
                      const size = f.metadata?.size
                      const sizeLabel = size
                        ? size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`
                        : ''
                      return (
                        <div key={f.name} className="px-5 py-3 flex items-center gap-3">
                          <File size={13} className="text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{original}</p>
                            {sizeLabel && <p className="text-[11px] text-muted-foreground">{sizeLabel}</p>}
                          </div>
                          <button onClick={() => downloadFile(key, f.name, original)}
                            className="text-muted-foreground hover:text-[#a78bfa] transition-colors" title="Baixar">
                            <Download size={14} />
                          </button>
                          <button onClick={() => deleteFile(key, f.name)}
                            className="text-muted-foreground hover:text-[#ef4444] transition-colors" title="Apagar">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Tab: Histórico */}
      {activeTab === 'historico' && (
        <div className="space-y-2">
          {client.status_history.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-10 text-center text-muted-foreground text-sm">
              Nenhuma alteração de status registrada
            </div>
          ) : (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
              {client.status_history.map(h => (
                <div key={h.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-[#7c3aed] shrink-0" />
                  <div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">{statusLabel[h.old_status ?? ''] ?? '—'}</span>
                      {' → '}
                      <span className="font-medium">{statusLabel[h.new_status]}</span>
                    </p>
                    {h.note && <p className="text-xs text-muted-foreground mt-0.5">{h.note}</p>}
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground">{formatDate(h.changed_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Dados */}
      {activeTab === 'dados' && (
        <div className="space-y-5">

          {/* Responsável */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <User2 size={14} className="text-muted-foreground" />
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Responsável pelo cliente</h3>
            </div>
            <input
              value={extras.responsavel}
              onChange={e => setExtras(x => ({ ...x, responsavel: e.target.value }))}
              onBlur={() => saveExtras()}
              placeholder="Nome do responsável interno (opcional)"
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Objetivos */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-muted-foreground" />
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Objetivos do cliente</h3>
            </div>
            <textarea
              value={extras.objectives}
              onChange={e => setExtras(x => ({ ...x, objectives: e.target.value }))}
              onBlur={() => saveExtras()}
              rows={4}
              placeholder="Metas, expectativas e resultados esperados..."
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/50 resize-none"
            />
          </div>

          {/* Redes Sociais */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AtSign size={14} className="text-muted-foreground" />
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Redes Sociais</h3>
              </div>
              <button
                onClick={() => setExtras(x => ({ ...x, social_media: [...x.social_media, { platform: 'Instagram', handle: '' }] }))}
                className="flex items-center gap-1 text-xs text-[#a78bfa] hover:text-[#7c3aed] transition-colors"
              >
                <Plus size={12} /> Adicionar
              </button>
            </div>
            {extras.social_media.length === 0 && (
              <p className="text-xs text-muted-foreground/60">Nenhuma rede social cadastrada</p>
            )}
            <div className="space-y-2">
              {extras.social_media.map((s, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    value={s.platform}
                    onChange={e => {
                      const arr = [...extras.social_media]; arr[i] = { ...arr[i], platform: e.target.value }
                      setExtras(x => ({ ...x, social_media: arr }))
                    }}
                    onBlur={() => saveExtras()}
                    className="bg-[#111111] border border-[#2a2a2a] rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-[#7c3aed] transition-colors w-36 shrink-0"
                  >
                    {SOCIAL_PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <input
                    value={s.handle}
                    onChange={e => {
                      const arr = [...extras.social_media]; arr[i] = { ...arr[i], handle: e.target.value }
                      setExtras(x => ({ ...x, social_media: arr }))
                    }}
                    onBlur={() => saveExtras()}
                    placeholder="@usuario ou URL"
                    className="flex-1 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/50"
                  />
                  <button
                    onClick={() => { const arr = extras.social_media.filter((_, j) => j !== i); setExtras(x => ({ ...x, social_media: arr })); saveExtras({ social_media: arr }) }}
                    className="text-muted-foreground hover:text-[#ef4444] transition-colors p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Links úteis */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe size={14} className="text-muted-foreground" />
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Links úteis</h3>
              </div>
              <button
                onClick={() => setExtras(x => ({ ...x, links: [...x.links, { label: '', url: '' }] }))}
                className="flex items-center gap-1 text-xs text-[#a78bfa] hover:text-[#7c3aed] transition-colors"
              >
                <Plus size={12} /> Adicionar
              </button>
            </div>
            {extras.links.length === 0 && (
              <p className="text-xs text-muted-foreground/60">Nenhum link cadastrado</p>
            )}
            <div className="space-y-2">
              {extras.links.map((lk, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={lk.label}
                    onChange={e => { const arr = [...extras.links]; arr[i] = { ...arr[i], label: e.target.value }; setExtras(x => ({ ...x, links: arr })) }}
                    onBlur={() => saveExtras()}
                    placeholder="Rótulo (ex: Site)"
                    className="w-32 shrink-0 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/50"
                  />
                  <input
                    value={lk.url}
                    onChange={e => { const arr = [...extras.links]; arr[i] = { ...arr[i], url: e.target.value }; setExtras(x => ({ ...x, links: arr })) }}
                    onBlur={() => saveExtras()}
                    placeholder="https://..."
                    className="flex-1 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/50"
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(lk.url) }}
                    title="Copiar link"
                    className="text-muted-foreground hover:text-[#a78bfa] transition-colors p-1"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => { const arr = extras.links.filter((_, j) => j !== i); setExtras(x => ({ ...x, links: arr })); saveExtras({ links: arr }) }}
                    className="text-muted-foreground hover:text-[#ef4444] transition-colors p-1"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Senhas / Acessos */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock size={14} className="text-muted-foreground" />
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Senhas / Acessos</h3>
              </div>
              <button
                onClick={() => setExtras(x => ({ ...x, passwords: [...x.passwords, { label: '', username: '', password: '', url: '' }] }))}
                className="flex items-center gap-1 text-xs text-[#a78bfa] hover:text-[#7c3aed] transition-colors"
              >
                <Plus size={12} /> Adicionar
              </button>
            </div>
            {extras.passwords.length === 0 && (
              <p className="text-xs text-muted-foreground/60">Nenhum acesso cadastrado</p>
            )}
            <div className="space-y-3">
              {extras.passwords.map((pw, i) => (
                <div key={i} className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={pw.label}
                      onChange={e => { const arr = [...extras.passwords]; arr[i] = { ...arr[i], label: e.target.value }; setExtras(x => ({ ...x, passwords: arr })) }}
                      onBlur={() => saveExtras()}
                      placeholder="Rótulo (ex: Google Ads)"
                      className="flex-1 bg-transparent border-b border-[#2a2a2a] pb-1 text-sm font-medium focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/50"
                    />
                    <button
                      onClick={() => { const arr = extras.passwords.filter((_, j) => j !== i); setExtras(x => ({ ...x, passwords: arr })); saveExtras({ passwords: arr }) }}
                      className="text-muted-foreground hover:text-[#ef4444] transition-colors p-0.5"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-1">Usuário / Email</label>
                      <div className="flex gap-1">
                        <input
                          value={pw.username}
                          onChange={e => { const arr = [...extras.passwords]; arr[i] = { ...arr[i], username: e.target.value }; setExtras(x => ({ ...x, passwords: arr })) }}
                          onBlur={() => saveExtras()}
                          placeholder="usuario@email.com"
                          className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/50"
                        />
                        <button onClick={() => navigator.clipboard.writeText(pw.username)} className="text-muted-foreground hover:text-[#a78bfa] transition-colors p-1"><Copy size={12} /></button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-muted-foreground mb-1">Senha</label>
                      <div className="flex gap-1">
                        <input
                          type={revealedPasswords.has(i) ? 'text' : 'password'}
                          value={pw.password}
                          onChange={e => { const arr = [...extras.passwords]; arr[i] = { ...arr[i], password: e.target.value }; setExtras(x => ({ ...x, passwords: arr })) }}
                          onBlur={() => saveExtras()}
                          placeholder="••••••••"
                          className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/50"
                        />
                        <button
                          onClick={() => setRevealedPasswords(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })}
                          className="text-muted-foreground hover:text-[#a78bfa] transition-colors p-1"
                        >
                          {revealedPasswords.has(i) ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                        <button onClick={() => navigator.clipboard.writeText(pw.password)} className="text-muted-foreground hover:text-[#a78bfa] transition-colors p-1"><Copy size={12} /></button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-muted-foreground mb-1">URL (opcional)</label>
                    <div className="flex gap-1">
                      <input
                        value={pw.url}
                        onChange={e => { const arr = [...extras.passwords]; arr[i] = { ...arr[i], url: e.target.value }; setExtras(x => ({ ...x, passwords: arr })) }}
                        onBlur={() => saveExtras()}
                        placeholder="https://..."
                        className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/50"
                      />
                      <button onClick={() => navigator.clipboard.writeText(pw.url)} className="text-muted-foreground hover:text-[#a78bfa] transition-colors p-1"><Copy size={12} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {extrasSaving && <p className="text-[10px] text-muted-foreground">Salvando...</p>}
          </div>

        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {showDelete && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#ef4444]/30 rounded-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-[#ef4444]/10 flex items-center justify-center shrink-0">
                <Trash2 size={15} className="text-[#ef4444]" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Excluir cliente</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Esta ação não pode ser desfeita</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              Você está prestes a excluir <strong className="text-foreground">{client?.name}</strong> permanentemente.
            </p>
            <p className="text-xs text-muted-foreground mb-5">
              Todos os serviços, cobranças e histórico deste cliente serão apagados.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDelete(false)}
                className="flex-1 border border-[#2a2a2a] text-sm py-2.5 rounded-lg hover:bg-[#222222] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={deleteClient}
                disabled={deleting}
                className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white text-sm py-2.5 rounded-lg transition-colors disabled:opacity-60 font-medium"
              >
                {deleting ? 'Excluindo...' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp modal */}
      {whatsAppCharge && client && (
        <WhatsAppMiniModal
          charge={whatsAppCharge}
          clientName={client.name}
          clientPhone={client.phone}
          onClose={() => setWhatsAppCharge(null)}
        />
      )}

      {/* Modal de edição */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Editar cliente</h2>
              <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <Field label="Nome" value={form.name ?? ''} onChange={v => setForm(f => ({ ...f, name: v }))} />
              <Field label="Email" value={form.email ?? ''} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" />
              <Field label="Telefone" value={form.phone ?? ''} onChange={v => setForm(f => ({ ...f, phone: v }))} />
              <Field label="Cliente desde" value={form.started_at ?? ''} onChange={v => setForm(f => ({ ...f, started_at: v }))} type="date" />
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Dia de vencimento</label>
                <select
                  value={form.billing_day ?? ''}
                  onChange={e => setForm(f => ({ ...f, billing_day: e.target.value ? parseInt(e.target.value) : null }))}
                  className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors"
                >
                  <option value="">Não definido</option>
                  {[1,5,10,15,20,25,28].map(d => <option key={d} value={d}>Todo dia {d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Client['status'] }))} className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors">
                  <option value="ativo">Ativo</option>
                  <option value="pausado">Pausado</option>
                  <option value="encerrado">Encerrado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Observações</label>
                <textarea value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditing(false)} className="flex-1 border border-[#2a2a2a] text-sm py-2.5 rounded-lg hover:bg-[#222222] transition-colors">Cancelar</button>
              <button onClick={saveClient} disabled={saving} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm py-2.5 rounded-lg transition-colors disabled:opacity-60">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function WhatsAppMiniModal({ charge, clientName, clientPhone, onClose }: {
  charge: Charge & { status: string }
  clientName: string
  clientPhone: string | null
  onClose: () => void
}) {
  const [pixKey] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('aura_pix_key') ?? '' : ''))
  const [agencyName] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('aura_agency_name') ?? 'Aura MKT.CLUB' : 'Aura MKT.CLUB'))
  const [copied, setCopied] = useState(false)

  const isOverdue = new Date(charge.due_date) < new Date(new Date().toDateString())
  const dueFormatted = new Date(charge.due_date + 'T12:00:00').toLocaleDateString('pt-BR')

  const msg = `Olá, ${clientName}! 👋\n\n${isOverdue ? '⚠️ Identificamos uma cobrança em aberto:' : 'Passando pra lembrar sobre a cobrança:'}\n\n📋 *${charge.description}*\n💰 *${formatBRL(Number(charge.amount))}*\n📅 Vencimento: ${dueFormatted}${isOverdue ? ' _(em atraso)_' : ''}\n\nPara realizar o pagamento via *PIX*:\n🔑 \`${pixKey || 'chave não configurada — acesse Configurações'}\`\n\n${pixKey ? 'É só copiar a chave acima e realizar o pagamento pelo seu banco. ✅\n\n' : ''}Qualquer dúvida, estamos à disposição! 😊\n\n_${agencyName}_`

  function copy() {
    navigator.clipboard.writeText(msg)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function openWA() {
    const phone = clientPhone ? clientPhone.replace(/\D/g, '') : ''
    const url = phone ? `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle size={15} className="text-[#25d366]" />
            <h2 className="text-sm font-semibold">Mensagem de cobrança</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X size={15} /></button>
        </div>
        {!pixKey && (
          <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/20 rounded-lg px-3 py-2.5">
            <span className="text-[#f59e0b] text-xs">⚠️ Chave PIX não configurada. Acesse <strong>Configurações</strong>.</span>
          </div>
        )}
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-4">
          <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{msg}</pre>
        </div>
        <div className="flex gap-2">
          <button onClick={copy} className={`flex-1 flex items-center justify-center gap-2 text-sm py-2.5 rounded-lg border transition-all ${copied ? 'border-[#22c55e]/40 text-[#22c55e] bg-[#22c55e]/5' : 'border-[#2a2a2a] text-foreground hover:bg-[#222222]'}`}>
            {copied ? <><Check size={13} />Copiado!</> : <><Copy size={13} />Copiar</>}
          </button>
          <button onClick={openWA} className="flex-1 flex items-center justify-center gap-2 text-sm py-2.5 rounded-lg bg-[#25d366] hover:bg-[#22c55e] text-white font-medium transition-colors">
            <MessageCircle size={13} />
            {clientPhone ? 'Abrir WhatsApp' : 'Abrir WhatsApp Web'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors" />
    </div>
  )
}
