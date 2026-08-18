'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { formatBRL, formatDate } from '@/lib/utils/format'
import { useRole } from '@/lib/hooks/useRole'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Edit2, Check, X, Plus, CheckCircle, XCircle,
  Mail, Phone, Calendar, FileText, TrendingUp, DollarSign, AlertCircle,
  MessageCircle, Copy, Trash2, Clock, Upload, Download, File,
  Eye, EyeOff, Link, AtSign, Globe, Lock, User2, Folder, ChevronLeft
} from 'lucide-react'
import type { Client, Service, ClientStatusHistory, Charge, Task } from '@/lib/supabase/types'

interface EditorialLine {
  id: string
  client_id: string
  pdf_name: string
  pdf_path: string
  valid_from: string
  valid_until: string
  notified_30: boolean
  notified_15: boolean
  notified_5: boolean
  created_at: string
}

interface WeeklyReport {
  id: string
  week_start: string
  week_end: string
  summary: string
  data: {
    atual: { tarefas_concluidas: number; tarefas_atrasadas: number; conteudos_publicados: number; conteudos_atrasados: number }
    anterior: { tarefas_concluidas: number; tarefas_atrasadas: number }
  }
}

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
  const searchParams = useSearchParams()
  const isJulia = useRole() === 'julia'

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
  const [editServiceForm, setEditServiceForm] = useState({ name: '', amount: '', recurrence: 'mensal', contract_end: '', effective_date: new Date().toISOString().split('T')[0] })
  const [savingEditService, setSavingEditService] = useState(false)
  const [activeTab, setActiveTab] = useState<'visao' | 'servicos' | 'financeiro' | 'tarefas' | 'documentos' | 'historico' | 'dados' | 'editorial' | 'relatorios'>('visao')
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([])
  const [loadingReports, setLoadingReports] = useState(false)
  type FileEntry = { name: string; metadata?: { size?: number } }
  type FilesGrouped = { contratos: FileEntry[]; 'identidade-visual': FileEntry[]; financeiro: FileEntry[]; outros: FileEntry[] }
  type FolderKey = 'contratos' | 'identidade-visual' | 'financeiro' | 'outros'
  const FOLDERS: { key: FolderKey; label: string; color: string; required: string[] }[] = [
    { key: 'contratos', label: 'Contratos', color: '#a78bfa', required: ['Contrato assinado'] },
    { key: 'identidade-visual', label: 'Identidade Visual', color: '#fbbf24', required: ['Manual de marca','Logo vetor (AI/EPS/SVG)','Logo PNG','Logo JPG','Logo colorida','Logo preto e branco','Logo negativa','Logo monocromática','Logo horizontal','Logo vertical','Símbolo isolado','Paleta de cores (hex/RGB/CMYK)','Tipografia'] },
    { key: 'financeiro', label: 'Financeiro', color: '#4ade80', required: ['Notas fiscais emitidas','Comprovantes de pagamento','Relatórios de performance enviados'] },
    { key: 'outros', label: 'Outros', color: '#60a5fa', required: [] },
  ]
  const [files, setFiles] = useState<FilesGrouped>({ contratos: [], 'identidade-visual': [], financeiro: [], outros: [] })
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [pendingFolder, setPendingFolder] = useState<FolderKey>('contratos')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [openFolder, setOpenFolder] = useState<FolderKey | null>(null)
  const [pendingSlot, setPendingSlot] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [whatsAppCharge, setWhatsAppCharge] = useState<(Charge & { status: string }) | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [editorial, setEditorial] = useState<EditorialLine | null>(null)
  const [editorialLoading, setEditorialLoading] = useState(false)
  const [editorialUploading, setEditorialUploading] = useState(false)
  const [editorialError, setEditorialError] = useState('')
  const [editorialPdfUrl, setEditorialPdfUrl] = useState<string | null>(null)
  const editorialInputRef = useRef<HTMLInputElement>(null)

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
    setFiles({ contratos: res.contratos ?? [], 'identidade-visual': res['identidade-visual'] ?? [], financeiro: res.financeiro ?? [], outros: res.outros ?? [] })
  }, [id])

  function slugify(s: string) {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  function filesForSlot(folderFiles: FileEntry[], slotLabel: string): FileEntry[] {
    const slug = slugify(slotLabel) + '_'
    return folderFiles.filter(f => {
      const original = f.name.replace(/^\d+_/, '')
      return original.toLowerCase().startsWith(slug)
    })
  }

  function extraFiles(folderFiles: FileEntry[], required: string[]): FileEntry[] {
    const prefixes = required.map(r => slugify(r) + '_')
    return folderFiles.filter(f => {
      const original = f.name.replace(/^\d+_/, '').toLowerCase()
      return !prefixes.some(p => original.startsWith(p))
    })
  }

  function openFilePicker(folder: FolderKey, slot?: string) {
    setPendingFolder(folder)
    setPendingSlot(slot ?? null)
    fileInputRef.current?.click()
  }

  function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    e.target.value = ''
  }

  async function confirmUpload() {
    if (!pendingFile) return
    setUploading(true)
    setUploadError('')
    const uploadName = pendingSlot
      ? `${slugify(pendingSlot)}_${pendingFile.name}`
      : pendingFile.name

    // 1. Pede pro servidor uma URL de upload assinada (só metadados, sem o arquivo)
    const res = await fetch(`/api/clients/${id}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: pendingFolder, filename: uploadName }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) {
      setUploadError(d.error ?? 'Erro ao preparar envio')
      setUploading(false)
      return
    }

    // 2. Envia o arquivo direto do navegador pro Storage (sem passar pelo servidor)
    const supabase = createClient()
    const { error: uploadErr } = await supabase.storage
      .from('client-files')
      .uploadToSignedUrl(d.path, d.token, pendingFile)

    if (uploadErr) {
      setUploadError(uploadErr.message || 'Erro ao enviar arquivo')
    } else {
      setPendingFile(null)
      setPendingSlot(null)
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
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'editorial') setActiveTab('editorial')
  }, [searchParams])

  const loadEditorial = useCallback(async () => {
    setEditorialLoading(true)
    const res = await fetch(`/api/editorial-lines?client_id=${id}`).then(r => r.json()).catch(() => [])
    const line = Array.isArray(res) && res.length > 0 ? res[0] as EditorialLine : null
    setEditorial(line)
    setEditorialPdfUrl(null)
    setEditorialLoading(false)
  }, [id])

  useEffect(() => { loadEditorial() }, [loadEditorial])

  const loadWeeklyReports = useCallback(async () => {
    setLoadingReports(true)
    const res = await fetch(`/api/weekly-reports?client_id=${id}`).then(r => r.json()).catch(() => [])
    setWeeklyReports(Array.isArray(res) ? res : [])
    setLoadingReports(false)
  }, [id])

  useEffect(() => { loadWeeklyReports() }, [loadWeeklyReports])

  async function loadEditorialPdf() {
    if (!editorial) return
    const res = await fetch(`/api/editorial-lines/${editorial.id}`).then(r => r.json()).catch(() => ({}))
    if (res.url) setEditorialPdfUrl(res.url)
  }

  async function uploadEditorial(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.type !== 'application/pdf') { setEditorialError('Apenas arquivos PDF são aceitos'); return }
    setEditorialUploading(true)
    setEditorialError('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('client_id', id)
    const res = await fetch('/api/editorial-lines', { method: 'POST', body: fd })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setEditorialError(d.error ?? 'Erro ao enviar PDF')
    } else {
      await loadEditorial()
    }
    setEditorialUploading(false)
  }

  async function deleteEditorial() {
    if (!editorial || !confirm('Remover a linha editorial atual?')) return
    await fetch(`/api/editorial-lines/${editorial.id}`, { method: 'DELETE' })
    setEditorial(null)
    setEditorialPdfUrl(null)
  }

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
    setEditServiceForm({ name: s.name, amount: String(s.amount), recurrence: s.recurrence ?? 'mensal', contract_end: s.contract_end ?? '', effective_date: new Date().toISOString().split('T')[0] })
  }

  async function saveEditService(serviceId: string, originalAmount: number) {
    setSavingEditService(true)
    const newAmount = parseFloat(editServiceForm.amount)
    const amountChanged = newAmount !== originalAmount
    await fetch(`/api/services/${serviceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editServiceForm.name,
        amount: newAmount,
        recurrence: editServiceForm.recurrence,
        contract_end: editServiceForm.contract_end || null,
        effective_date: amountChanged ? editServiceForm.effective_date : undefined,
      }),
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
          {!isJulia && (
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
          )}
        </div>
      </div>

      {/* KPIs */}
      {!isJulia && (
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
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1 w-fit overflow-x-auto max-w-full">
        {(([['visao', 'Visão geral'], ['servicos', 'Serviços'], ['financeiro', 'Financeiro'], ['tarefas', 'Tarefas'], ['relatorios', 'Relatórios'], ['documentos', 'Documentos'], ['historico', 'Histórico'], ['dados', 'Dados'], ['editorial', 'Editorial']] as const)
          .filter(([tab]) => !isJulia || (tab !== 'servicos' && tab !== 'financeiro'))
        ).map(([tab, lbl]) => (
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
        <div className={`grid grid-cols-1 gap-6 ${isJulia ? '' : 'md:grid-cols-2'}`}>
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
              {!isJulia && client.billing_day && (
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

          {!isJulia && (
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
          )}
        </div>
      )}

      {/* Tab: Serviços */}
      {!isJulia && activeTab === 'servicos' && (
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
                      {parseFloat(editServiceForm.amount) !== Number(s.amount) && (
                        <div className="bg-[#7c3aed]/10 border border-[#7c3aed]/30 rounded-lg px-4 py-3">
                          <label className="block text-xs text-[#a78bfa] mb-1.5">Novo valor a partir de</label>
                          <input type="date" value={editServiceForm.effective_date} onChange={e => setEditServiceForm(f => ({ ...f, effective_date: e.target.value }))} className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] transition-colors" />
                          <p className="text-[10px] text-muted-foreground mt-1.5">Cobranças pendentes a partir desta data serão atualizadas para o novo valor. As anteriores permanecem como estão.</p>
                        </div>
                      )}
                      <div className="flex gap-3 pt-1">
                        <button onClick={() => setEditingService(null)} className="flex-1 border border-[#2a2a2a] text-sm py-2 rounded-lg hover:bg-[#222222] transition-colors">Cancelar</button>
                        <button onClick={() => saveEditService(s.id, Number(s.amount))} disabled={savingEditService} className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm py-2 rounded-lg transition-colors disabled:opacity-60">
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
      {!isJulia && activeTab === 'financeiro' && (
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
                        {task.assignees && task.assignees.length > 0 && (
                          <span className="text-[10px] text-muted-foreground">{task.assignees.map(a => a.name).join(', ')}</span>
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

      {/* Tab: Relatórios */}
      {activeTab === 'relatorios' && (
        <div className="space-y-4">
          {loadingReports ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : weeklyReports.length === 0 ? (
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-10 text-center">
              <p className="text-sm text-muted-foreground">Nenhum relatório ainda</p>
              <p className="text-xs text-muted-foreground mt-1">O primeiro é gerado toda sexta-feira às 17h</p>
            </div>
          ) : (
            weeklyReports.map(r => (
              <div key={r.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
                <p className="text-xs text-muted-foreground mb-3">{formatDate(r.week_start)} – {formatDate(r.week_end)}</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap mb-4">{r.summary}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">Tarefas concluídas</p>
                    <p className="text-base font-semibold">{r.data.atual.tarefas_concluidas}</p>
                  </div>
                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">Tarefas atrasadas</p>
                    <p className={`text-base font-semibold ${r.data.atual.tarefas_atrasadas > 0 ? 'text-[#ef4444]' : ''}`}>{r.data.atual.tarefas_atrasadas}</p>
                  </div>
                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">Conteúdo publicado</p>
                    <p className="text-base font-semibold">{r.data.atual.conteudos_publicados}</p>
                  </div>
                  <div className="bg-[#111111] border border-[#2a2a2a] rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">Conteúdo atrasado</p>
                    <p className={`text-base font-semibold ${r.data.atual.conteudos_atrasados > 0 ? 'text-[#ef4444]' : ''}`}>{r.data.atual.conteudos_atrasados}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab: Documentos */}
      {activeTab === 'documentos' && (
        <div className="space-y-4">
          {/* Input oculto controlado por ref */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={onFileSelected}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.svg,.ai,.eps,.zip"
          />

          {openFolder === null ? (
            /* ── Vista: grade de pastas ── */
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {FOLDERS.filter(f => !isJulia || f.key === 'identidade-visual' || f.key === 'outros').map(folder => {
                const folderFiles = files[folder.key] ?? []
                const filled = folder.required.filter(r => filesForSlot(folderFiles, r).length > 0).length
                const total = folder.required.length
                const pct = total > 0 ? Math.round((filled / total) * 100) : null
                const allDone = pct === 100
                return (
                  <button
                    key={folder.key}
                    onClick={() => setOpenFolder(folder.key)}
                    className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 flex flex-col items-center gap-3 hover:border-[#3a3a3a] hover:bg-[#1f1f1f] transition-all text-center group"
                  >
                    {/* Ícone de pasta */}
                    <div className="relative mt-1">
                      <Folder
                        size={64}
                        strokeWidth={1}
                        style={{ color: folder.color }}
                        className="drop-shadow-sm"
                      />
                      {folderFiles.length > 0 && (
                        <span
                          className="absolute -top-1 -right-2 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center text-[#111]"
                          style={{ background: folder.color }}
                        >
                          {folderFiles.length}
                        </span>
                      )}
                      {allDone && (
                        <CheckCircle size={16} className="absolute -bottom-1 -right-2 text-[#22c55e] bg-[#1a1a1a] rounded-full" />
                      )}
                    </div>
                    {/* Nome e progresso */}
                    <div className="w-full">
                      <p className="text-sm font-medium">{folder.label}</p>
                      {pct !== null && (
                        <>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {filled}/{total} obrigatórios
                          </p>
                          <div className="w-full h-1 bg-[#2a2a2a] rounded-full overflow-hidden mt-2">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: folder.color }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (() => {
            /* ── Vista: interior de uma pasta ── */
            const folder = FOLDERS.find(f => f.key === openFolder)!
            const folderFiles = files[openFolder] ?? []
            const extras = extraFiles(folderFiles, folder.required)

            return (
              <div className="space-y-4">
                {/* Header da pasta */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => { setOpenFolder(null); setPendingFile(null); setUploadError('') }}
                    className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft size={15} /> Pastas
                  </button>
                  <div className="flex items-center gap-2">
                    <Folder size={16} strokeWidth={1.5} style={{ color: folder.color }} />
                    <span className="text-sm font-semibold">{folder.label}</span>
                  </div>
                  <button
                    onClick={() => openFilePicker(openFolder)}
                    className="flex items-center gap-1.5 text-xs border border-[#2a2a2a] hover:border-[#7c3aed]/40 text-muted-foreground hover:text-[#a78bfa] px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Upload size={11} /> Novo arquivo
                  </button>
                </div>

                {/* Confirmação de upload */}
                {pendingFile && (
                  <div className="bg-[#1a1a1a] border border-[#7c3aed]/30 rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#7c3aed]/10 flex items-center justify-center shrink-0">
                        <File size={15} className="text-[#a78bfa]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{pendingFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {pendingSlot ? `→ ${pendingSlot}` : folder.label} ·{' '}
                          {pendingFile.size > 1024 * 1024
                            ? `${(pendingFile.size / 1024 / 1024).toFixed(1)} MB`
                            : `${Math.round(pendingFile.size / 1024)} KB`}
                        </p>
                      </div>
                    </div>
                    {uploadError && (
                      <p className="text-xs text-[#ef4444] flex items-center gap-1">
                        <AlertCircle size={12} />{uploadError}
                      </p>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => { setPendingFile(null); setPendingSlot(null); setUploadError('') }}
                        className="flex-1 border border-[#2a2a2a] text-sm py-2 rounded-lg hover:bg-[#222] transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={confirmUpload}
                        disabled={uploading}
                        className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm py-2 rounded-lg transition-colors disabled:opacity-60"
                      >
                        {uploading ? 'Enviando...' : 'Enviar'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Itens obrigatórios */}
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-[#2a2a2a] flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Documentos obrigatórios</p>
                    <span className="text-[10px] text-muted-foreground">
                      {folder.required.filter(r => filesForSlot(folderFiles, r).length > 0).length}/{folder.required.length}
                    </span>
                  </div>
                  <div className="divide-y divide-[#1a1a1a]">
                    {folder.required.map(slot => {
                      const slotFiles = filesForSlot(folderFiles, slot)
                      const done = slotFiles.length > 0
                      return (
                        <div
                          key={slot}
                          className={`px-5 py-3.5 flex items-center gap-3 ${done ? 'bg-[#1a1a1a]' : 'bg-[#161616]'}`}
                        >
                          {done
                            ? <CheckCircle size={14} className="text-[#22c55e] shrink-0" />
                            : <div className="w-3.5 h-3.5 rounded-full border-2 border-[#3a3a3a] shrink-0" />
                          }
                          <span className={`text-sm flex-1 min-w-0 truncate ${done ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {slot}
                          </span>
                          {done ? (
                            <div className="flex items-center gap-1 shrink-0">
                              {slotFiles.map(f => {
                                const slotSlug = slugify(slot) + '_'
                                const original = f.name.replace(/^\d+_/, '').replace(new RegExp(`^${slotSlug}`, 'i'), '') || slot
                                const size = f.metadata?.size
                                const sizeLabel = size
                                  ? size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)}MB` : `${Math.round(size / 1024)}KB`
                                  : ''
                                return (
                                  <div key={f.name} className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-muted-foreground hidden sm:block max-w-[110px] truncate">
                                      {original}{sizeLabel ? ` · ${sizeLabel}` : ''}
                                    </span>
                                    <button
                                      onClick={() => downloadFile(openFolder, f.name, original)}
                                      className="text-muted-foreground hover:text-[#a78bfa] transition-colors p-0.5"
                                      title="Baixar"
                                    >
                                      <Download size={13} />
                                    </button>
                                    <button
                                      onClick={() => deleteFile(openFolder, f.name)}
                                      className="text-muted-foreground hover:text-[#ef4444] transition-colors p-0.5"
                                      title="Apagar"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <button
                              onClick={() => openFilePicker(openFolder, slot)}
                              className="shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-[#a78bfa] border border-[#2a2a2a] hover:border-[#7c3aed]/40 px-2 py-1 rounded-md transition-colors"
                            >
                              <Upload size={10} /> Upload
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Outros arquivos */}
                {extras.length > 0 && (
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-[#2a2a2a]">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Outros arquivos ({extras.length})
                      </p>
                    </div>
                    <div className="divide-y divide-[#1a1a1a]">
                      {extras.map(f => {
                        const original = f.name.replace(/^\d+_/, '')
                        const size = f.metadata?.size
                        const sizeLabel = size
                          ? size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`
                          : ''
                        return (
                          <div key={f.name} className="px-5 py-3 flex items-center gap-3 bg-[#1a1a1a]">
                            <File size={13} className="text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{original}</p>
                              {sizeLabel && <p className="text-[11px] text-muted-foreground">{sizeLabel}</p>}
                            </div>
                            <button
                              onClick={() => downloadFile(openFolder, f.name, original)}
                              className="text-muted-foreground hover:text-[#a78bfa] transition-colors"
                              title="Baixar"
                            >
                              <Download size={14} />
                            </button>
                            <button
                              onClick={() => deleteFile(openFolder, f.name)}
                              className="text-muted-foreground hover:text-[#ef4444] transition-colors"
                              title="Apagar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
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
          {!isJulia && (
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
                      className="flex-1 min-w-0 bg-transparent border-b border-[#2a2a2a] pb-1 text-sm font-medium focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/50"
                    />
                    <button
                      onClick={() => { const arr = extras.passwords.filter((_, j) => j !== i); setExtras(x => ({ ...x, passwords: arr })); saveExtras({ passwords: arr }) }}
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
                          onChange={e => { const arr = [...extras.passwords]; arr[i] = { ...arr[i], username: e.target.value }; setExtras(x => ({ ...x, passwords: arr })) }}
                          onBlur={() => saveExtras()}
                          placeholder="usuario@email.com"
                          className="flex-1 min-w-0 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/50"
                        />
                        <button onClick={() => navigator.clipboard.writeText(pw.username)} className="text-muted-foreground hover:text-[#a78bfa] transition-colors p-1 shrink-0"><Copy size={12} /></button>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <label className="block text-[10px] text-muted-foreground mb-1">Senha</label>
                      <div className="flex items-center gap-1">
                        <input
                          type={revealedPasswords.has(i) ? 'text' : 'password'}
                          value={pw.password}
                          onChange={e => { const arr = [...extras.passwords]; arr[i] = { ...arr[i], password: e.target.value }; setExtras(x => ({ ...x, passwords: arr })) }}
                          onBlur={() => saveExtras()}
                          placeholder="••••••••"
                          className="flex-1 min-w-0 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/50"
                        />
                        <button
                          onClick={() => setRevealedPasswords(s => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n })}
                          className="text-muted-foreground hover:text-[#a78bfa] transition-colors p-1 shrink-0"
                        >
                          {revealedPasswords.has(i) ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                        <button onClick={() => navigator.clipboard.writeText(pw.password)} className="text-muted-foreground hover:text-[#a78bfa] transition-colors p-1 shrink-0"><Copy size={12} /></button>
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label className="block text-[10px] text-muted-foreground mb-1">URL (opcional)</label>
                    <div className="flex items-center gap-1">
                      <input
                        value={pw.url}
                        onChange={e => { const arr = [...extras.passwords]; arr[i] = { ...arr[i], url: e.target.value }; setExtras(x => ({ ...x, passwords: arr })) }}
                        onBlur={() => saveExtras()}
                        placeholder="https://..."
                        className="flex-1 min-w-0 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-[#7c3aed] transition-colors placeholder:text-muted-foreground/50"
                      />
                      <button onClick={() => navigator.clipboard.writeText(pw.url)} className="text-muted-foreground hover:text-[#a78bfa] transition-colors p-1 shrink-0"><Copy size={12} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {extrasSaving && <p className="text-[10px] text-muted-foreground">Salvando...</p>}
          </div>
          )}

        </div>
      )}

      {/* Tab: Editorial */}
      {activeTab === 'editorial' && (
        <div className="space-y-4">
          <input ref={editorialInputRef} type="file" accept="application/pdf" className="hidden" onChange={uploadEditorial} />

          {editorialLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : editorial ? (() => {
            const today = new Date().toISOString().slice(0, 10)
            const validUntil = new Date(editorial.valid_until + 'T12:00:00Z')
            const daysLeft = Math.round((validUntil.getTime() - new Date(today + 'T12:00:00Z').getTime()) / 86400000)
            const isExpired = daysLeft < 0
            const isSoon5 = daysLeft >= 0 && daysLeft <= 5
            const isSoon15 = daysLeft >= 0 && daysLeft <= 15
            const isSoon30 = daysLeft >= 0 && daysLeft <= 30
            const statusColor = isExpired ? 'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20'
              : isSoon5 ? 'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20'
              : isSoon15 ? 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20'
              : isSoon30 ? 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20'
              : 'text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e]/20'
            const statusText = isExpired
              ? `Expirado há ${Math.abs(daysLeft)} dia${Math.abs(daysLeft) !== 1 ? 's' : ''}`
              : `${daysLeft} dia${daysLeft !== 1 ? 's' : ''} restante${daysLeft !== 1 ? 's' : ''}`

            return (
              <div className="space-y-4">
                {/* Card da linha editorial vigente */}
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-[#7c3aed]/10 flex items-center justify-center shrink-0">
                        <File size={18} className="text-[#a78bfa]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{editorial.pdf_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Vigência: {formatDate(editorial.valid_from)} → {formatDate(editorial.valid_until)}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border shrink-0 ${statusColor}`}>
                      {statusText}
                    </span>
                  </div>

                  {/* Barra de progresso */}
                  {(() => {
                    const total = 90
                    const used = total - Math.max(daysLeft, 0)
                    const pct = Math.min(Math.round((used / total) * 100), 100)
                    const barColor = isExpired || isSoon5 ? '#ef4444' : isSoon15 ? '#f59e0b' : isSoon30 ? '#f59e0b' : '#22c55e'
                    return (
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                          <span>Início: {formatDate(editorial.valid_from)}</span>
                          <span>{pct}% utilizado</span>
                          <span>Fim: {formatDate(editorial.valid_until)}</span>
                        </div>
                        <div className="w-full h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                        </div>
                      </div>
                    )
                  })()}

                  {/* Ações */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={async () => { await loadEditorialPdf(); }}
                      className="flex items-center gap-1.5 text-xs border border-[#2a2a2a] hover:border-[#7c3aed]/40 text-muted-foreground hover:text-[#a78bfa] px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Eye size={12} /> Visualizar PDF
                    </button>
                    <button
                      onClick={() => editorialInputRef.current?.click()}
                      disabled={editorialUploading}
                      className="flex items-center gap-1.5 text-xs border border-[#2a2a2a] hover:border-[#7c3aed]/40 text-muted-foreground hover:text-[#a78bfa] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Upload size={12} /> {editorialUploading ? 'Enviando...' : 'Substituir PDF'}
                    </button>
                    <button
                      onClick={deleteEditorial}
                      className="flex items-center gap-1.5 text-xs border border-[#ef4444]/20 text-[#ef4444]/60 hover:text-[#ef4444] hover:border-[#ef4444]/40 px-3 py-1.5 rounded-lg transition-colors ml-auto"
                    >
                      <Trash2 size={12} /> Remover
                    </button>
                  </div>

                  {editorialError && (
                    <p className="text-xs text-[#ef4444] flex items-center gap-1"><AlertCircle size={11} />{editorialError}</p>
                  )}
                </div>

                {/* Alertas de notificação */}
                {(isSoon30 || isExpired) && (
                  <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-xs ${isExpired || isSoon5 ? 'bg-[#ef4444]/5 border-[#ef4444]/20 text-[#ef4444]' : 'bg-[#f59e0b]/5 border-[#f59e0b]/20 text-[#f59e0b]'}`}>
                    <AlertCircle size={14} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium">
                        {isExpired ? 'Linha editorial expirada' : isSoon5 ? 'Expira em menos de 5 dias!' : isSoon15 ? 'Expira em menos de 15 dias' : 'Expira em menos de 30 dias'}
                      </p>
                      <p className="text-muted-foreground mt-0.5">Faça o upload de um novo PDF para renovar por mais 90 dias.</p>
                    </div>
                  </div>
                )}

                {/* Visualizador inline */}
                {editorialPdfUrl && (
                  <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#2a2a2a]">
                      <span className="text-xs text-muted-foreground">{editorial.pdf_name}</span>
                      <div className="flex items-center gap-2">
                        <a href={editorialPdfUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-[#a78bfa] transition-colors">
                          <Download size={12} /> Baixar
                        </a>
                        <button onClick={() => setEditorialPdfUrl(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    <iframe src={editorialPdfUrl} className="w-full h-[600px]" title="Linha Editorial" />
                  </div>
                )}
              </div>
            )
          })() : (
            /* Estado vazio */
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-12 h-12 rounded-xl bg-[#7c3aed]/10 flex items-center justify-center">
                <File size={22} className="text-[#a78bfa]" />
              </div>
              <div>
                <p className="text-sm font-medium">Nenhuma linha editorial cadastrada</p>
                <p className="text-xs text-muted-foreground mt-1">Faça upload de um PDF com a linha editorial dos próximos 3 meses.</p>
              </div>
              {editorialError && (
                <p className="text-xs text-[#ef4444] flex items-center gap-1"><AlertCircle size={11} />{editorialError}</p>
              )}
              <button
                onClick={() => { setEditorialError(''); editorialInputRef.current?.click() }}
                disabled={editorialUploading}
                className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-60"
              >
                <Upload size={14} />
                {editorialUploading ? 'Enviando...' : 'Upload PDF'}
              </button>
            </div>
          )}
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
