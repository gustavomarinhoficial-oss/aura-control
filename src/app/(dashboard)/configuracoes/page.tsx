'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Users, Key, Check, AlertTriangle, Bell, Mail, MessageCircle, Send, ChevronDown, Save, AlertCircle } from 'lucide-react'
import type { Member } from '@/lib/supabase/types'

interface WhatsappNumber { name: string; phone: string; apikey: string }
interface AlertSettings {
  email_enabled: boolean
  email_addresses: string[]
  whatsapp_enabled: boolean
  whatsapp_numbers: WhatsappNumber[]
  frequency_hours: number
  days_ahead: number
  time_start: number
  time_end: number
  last_sent_at: string | null
}

const FREQUENCY_OPTIONS = [
  { value: 1, label: 'A cada 1 hora' },
  { value: 2, label: 'A cada 2 horas' },
  { value: 4, label: 'A cada 4 horas' },
  { value: 8, label: 'A cada 8 horas' },
  { value: 24, label: 'Uma vez por dia' },
]
const DAYS_AHEAD_OPTIONS = [
  { value: 0, label: 'Só hoje' },
  { value: 1, label: 'Hoje + amanhã' },
  { value: 2, label: 'Próximos 2 dias' },
  { value: 7, label: 'Próximos 7 dias' },
]
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({ value: i, label: `${String(i).padStart(2, '0')}:00` }))

const COLORS = ['#7c3aed', '#2563eb', '#16a34a', '#ea580c', '#db2777', '#0891b2', '#65a30d', '#9333ea']

function getInitials(name: string) {
  return name.trim().split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}

const PIX_KEY = 'aura_pix_key'
const AGENCY_NAME_KEY = 'aura_agency_name'

export default function ConfiguracoesPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [saving, setSaving] = useState(false)

  const [pixKey, setPixKey] = useState('')
  const [agencyName, setAgencyName] = useState('')
  const [pixSaved, setPixSaved] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [cleared, setCleared] = useState<number | null>(null)

  // Alertas
  const [alertSettings, setAlertSettings] = useState<AlertSettings | null>(null)
  const [alertSaving, setAlertSaving] = useState(false)
  const [alertSaved, setAlertSaved] = useState(false)
  const [alertError, setAlertError] = useState('')
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [showWaForm, setShowWaForm] = useState(false)
  const [newWaName, setNewWaName] = useState('')
  const [newWaPhone, setNewWaPhone] = useState('')
  const [newWaKey, setNewWaKey] = useState('')

  useEffect(() => {
    setPixKey(localStorage.getItem(PIX_KEY) ?? '')
    setAgencyName(localStorage.getItem(AGENCY_NAME_KEY) ?? 'Aura MKT.CLUB')
    fetch('/api/alerts/settings').then(r => r.json()).then(setAlertSettings).catch(() => {})
  }, [])

  async function clearOverdueCharges() {
    if (!confirm('Apagar TODAS as cobranças não pagas com vencimento anterior a hoje? Esta ação não pode ser desfeita.')) return
    setClearing(true)
    const res = await fetch('/api/charges/clear-overdue', { method: 'DELETE' })
    const data = await res.json()
    setCleared(data.deleted ?? 0)
    setClearing(false)
    setTimeout(() => setCleared(null), 5000)
  }

  function savePixSettings() {
    localStorage.setItem(PIX_KEY, pixKey.trim())
    localStorage.setItem(AGENCY_NAME_KEY, agencyName.trim() || 'Aura MKT.CLUB')
    setPixSaved(true)
    setTimeout(() => setPixSaved(false), 2000)
  }

  function updateAlert<K extends keyof AlertSettings>(key: K, value: AlertSettings[K]) {
    setAlertSettings(s => s ? { ...s, [key]: value } : s)
  }

  async function saveAlerts() {
    if (!alertSettings) return
    setAlertSaving(true)
    setAlertError('')
    const res = await fetch('/api/alerts/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alertSettings),
    })
    setAlertSaving(false)
    if (res.ok) { setAlertSaved(true); setTimeout(() => setAlertSaved(false), 3000) }
    else setAlertError('Erro ao salvar alertas')
  }

  async function testAlert() {
    setTesting(true)
    setTestMsg('')
    const res = await fetch('/api/alerts/send?mode=morning', { method: 'POST' })
    const data = await res.json()
    setTesting(false)
    if (data.skipped) setTestMsg(`Aviso: ${data.skipped}`)
    else if (data.sent) setTestMsg(`Enviado! ${data.tasks} tarefa(s)`)
    else setTestMsg('Erro ao enviar')
    setTimeout(() => setTestMsg(''), 6000)
  }

  function addEmail() {
    const email = newEmail.trim().toLowerCase()
    if (!email || !email.includes('@') || alertSettings?.email_addresses.includes(email)) return
    updateAlert('email_addresses', [...(alertSettings?.email_addresses ?? []), email])
    setNewEmail('')
  }

  function addWhatsapp() {
    if (!newWaName || !newWaPhone) return
    const entry: WhatsappNumber = { name: newWaName.trim(), phone: newWaPhone.replace(/\D/g, ''), apikey: '' }
    updateAlert('whatsapp_numbers', [...(alertSettings?.whatsapp_numbers ?? []), entry])
    setNewWaName(''); setNewWaPhone(''); setNewWaKey(''); setShowWaForm(false)
  }

  const load = useCallback(() => {
    fetch('/api/members').then(r => r.json()).then(d => { setMembers(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  async function addMember() {
    if (!name.trim()) return
    setSaving(true)
    await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), initials: getInitials(name), color }),
    })
    setName('')
    setSaving(false)
    load()
  }

  async function deleteMember(id: string) {
    setMembers(prev => prev.filter(m => m.id !== id))
    await fetch(`/api/members/${id}`, { method: 'DELETE' })
  }

  return (
    <div className="space-y-8 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Membros da equipe e preferências</p>
      </div>

      {/* PIX e Agência */}
      <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Key size={14} className="text-[#a78bfa]" />
          <h2 className="text-sm font-medium">Dados para cobrança via WhatsApp</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Nome da agência</label>
            <input
              type="text"
              value={agencyName}
              onChange={e => setAgencyName(e.target.value)}
              placeholder="Aura MKT.CLUB"
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5">Chave PIX</label>
            <input
              type="text"
              value={pixKey}
              onChange={e => setPixKey(e.target.value)}
              placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
              className="w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Usada no texto de cobrança gerado automaticamente para os clientes.</p>
          </div>
          <button
            onClick={savePixSettings}
            className={`flex items-center gap-2 text-sm px-4 py-2 rounded-lg transition-all ${
              pixSaved
                ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20'
                : 'bg-[#7c3aed] hover:bg-[#6d28d9] text-white'
            }`}
          >
            {pixSaved ? <><Check size={13} /> Salvo!</> : 'Salvar'}
          </button>
        </div>
      </section>

      {/* Dados iniciais */}
      <section className="bg-[#1a1a1a] border border-[#ef4444]/20 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={14} className="text-[#ef4444]" />
          <h2 className="text-sm font-medium">Limpeza de dados</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Use esta opção ao cadastrar clientes que já existiam antes do sistema. Apaga todas as cobranças <strong className="text-foreground">não pagas</strong> com vencimento no passado — os dados reais de hoje em diante permanecem intactos.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={clearOverdueCharges}
            disabled={clearing}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-[#ef4444]/30 text-[#ef4444]/80 hover:text-[#ef4444] hover:bg-[#ef4444]/5 transition-colors disabled:opacity-50"
          >
            <Trash2 size={13} />
            {clearing ? 'Apagando...' : 'Apagar cobranças retroativas'}
          </button>
          {cleared !== null && (
            <span className="text-xs text-[#22c55e] flex items-center gap-1">
              <Check size={12} /> {cleared} cobranças apagadas
            </span>
          )}
        </div>
      </section>

      {/* Membros */}
      <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Users size={14} className="text-[#a78bfa]" />
          <h2 className="text-sm font-medium">Membros da equipe</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-20">
            <div className="w-4 h-4 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2 mb-5">
            {members.length === 0 && (
              <p className="text-xs text-muted-foreground">Nenhum membro cadastrado.</p>
            )}
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-[#2a2a2a] last:border-0">
                <div
                  style={{ backgroundColor: m.color + '22', borderColor: m.color + '55', color: m.color }}
                  className="w-8 h-8 rounded-full border flex items-center justify-center text-xs font-semibold shrink-0"
                >
                  {m.initials}
                </div>
                <span className="text-sm flex-1">{m.name}</span>
                <button onClick={() => deleteMember(m.id)} className="text-muted-foreground hover:text-[#ef4444] transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 pt-3 border-t border-[#2a2a2a]">
          <p className="text-xs text-muted-foreground">Adicionar membro</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addMember() }}
              placeholder="Nome completo"
              className="flex-1 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
            />
            <button
              onClick={addMember}
              disabled={saving || !name.trim()}
              className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`w-5 h-5 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-offset-[#1a1a1a] ring-white/50' : ''}`}
              />
            ))}
          </div>
          {name && (
            <div className="flex items-center gap-2">
              <div
                style={{ backgroundColor: color + '22', borderColor: color + '55', color }}
                className="w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-semibold"
              >
                {getInitials(name)}
              </div>
              <span className="text-xs text-muted-foreground">Prévia do avatar</span>
            </div>
          )}
        </div>
      </section>
      {/* Alertas */}
      {alertSettings && (
        <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-[#a78bfa]" />
              <h2 className="text-sm font-medium">Alertas e notificações</h2>
            </div>
            <div className="flex items-center gap-2">
              {testMsg && (
                <span className={`text-xs px-2 py-1 rounded-lg ${testMsg.startsWith('Envi') ? 'text-green-400 bg-green-400/10' : 'text-yellow-400 bg-yellow-400/10'}`}>
                  {testMsg}
                </span>
              )}
              <button onClick={testAlert} disabled={testing} className="flex items-center gap-1.5 text-xs border border-[#2a2a2a] px-2.5 py-1.5 rounded-lg hover:bg-[#222] transition-colors disabled:opacity-50">
                <Send size={11} /> {testing ? 'Enviando...' : 'Testar'}
              </button>
              <button onClick={saveAlerts} disabled={alertSaving} className="flex items-center gap-1.5 text-xs bg-[#7c3aed] hover:bg-[#6d28d9] text-white px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                {alertSaved ? <Check size={11} /> : <Save size={11} />}
                {alertSaving ? 'Salvando...' : alertSaved ? 'Salvo!' : 'Salvar'}
              </button>
            </div>
          </div>

          {alertError && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              <AlertCircle size={12} /> {alertError}
            </div>
          )}

          {/* Horários fixos */}
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg px-4 py-3 space-y-1.5">
            <p className="text-xs text-muted-foreground mb-2">Alertas automáticos diários (horário de Brasília)</p>
            <div className="flex items-center gap-2">
              <span className="text-base">☀️</span>
              <span className="text-sm font-medium">9h da manhã</span>
              <span className="text-xs text-muted-foreground">— tarefas atrasadas + vencendo hoje</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base">🌙</span>
              <span className="text-sm font-medium">21h da noite</span>
              <span className="text-xs text-muted-foreground">— o que vence amanhã</span>
            </div>
          </div>

          {/* Email */}
          <div className="border-t border-[#2a2a2a] pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail size={13} className="text-[#a78bfa]" />
                <span className="text-sm font-medium">Email</span>
              </div>
              <button onClick={() => updateAlert('email_enabled', !alertSettings.email_enabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${alertSettings.email_enabled ? 'bg-[#7c3aed]' : 'bg-[#2a2a2a]'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${alertSettings.email_enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {alertSettings.email_enabled && (
              <div className="space-y-2 pl-5">
                {alertSettings.email_addresses.map(email => (
                  <div key={email} className="flex items-center justify-between bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2">
                    <span className="text-sm">{email}</span>
                    <button onClick={() => updateAlert('email_addresses', alertSettings.email_addresses.filter(e => e !== email))} className="text-muted-foreground hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input type="email" placeholder="email@exemplo.com" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addEmail()}
                    className="flex-1 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                  <button onClick={addEmail} className="px-3 py-2 bg-[#7c3aed]/20 text-[#a78bfa] border border-[#7c3aed]/30 rounded-lg hover:bg-[#7c3aed]/30 transition-colors"><Plus size={13} /></button>
                </div>
                <p className="text-[10px] text-muted-foreground">Requer <code className="bg-[#1a1a1a] px-1 rounded">RESEND_API_KEY</code> no .env.local e no Vercel. Crie sua conta grátis em <strong>resend.com</strong></p>
              </div>
            )}
          </div>

          {/* WhatsApp */}
          <div className="border-t border-[#2a2a2a] pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle size={13} className="text-[#a78bfa]" />
                <span className="text-sm font-medium">WhatsApp</span>
                <span className="text-[10px] bg-[#7c3aed]/20 text-[#a78bfa] px-1.5 py-0.5 rounded-full">via Whapi.cloud · grátis</span>
              </div>
              <button onClick={() => updateAlert('whatsapp_enabled', !alertSettings.whatsapp_enabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${alertSettings.whatsapp_enabled ? 'bg-[#7c3aed]' : 'bg-[#2a2a2a]'}`}>
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${alertSettings.whatsapp_enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {alertSettings.whatsapp_enabled && (
              <div className="space-y-3 pl-5">
                {/* Instrução Whapi */}
                <div className="bg-[#111] border border-[#7c3aed]/20 rounded-lg px-3 py-3 space-y-1">
                  <p className="text-xs font-medium text-[#a78bfa]">Como funciona:</p>
                  <p className="text-xs text-muted-foreground">Mensagens enviadas pelo WhatsApp conectado à sua conta Whapi.cloud. Requer <code className="bg-[#1a1a1a] px-1 rounded">WHAPI_TOKEN</code> configurado no Vercel.</p>
                </div>
                {alertSettings.whatsapp_numbers.map((n, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2">
                    <div>
                      <p className="text-sm">{n.name}</p>
                      <p className="text-xs text-muted-foreground">+{n.phone}</p>
                    </div>
                    <button onClick={() => updateAlert('whatsapp_numbers', alertSettings.whatsapp_numbers.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                  </div>
                ))}
                {!showWaForm ? (
                  <button onClick={() => setShowWaForm(true)} className="flex items-center gap-1.5 text-xs text-[#a78bfa] border border-[#7c3aed]/30 px-3 py-1.5 rounded-lg hover:bg-[#7c3aed]/10 transition-colors">
                    <Plus size={11} /> Adicionar número
                  </button>
                ) : (
                  <div className="space-y-2 bg-[#111] border border-[#2a2a2a] rounded-lg p-3">
                    <input placeholder="Nome (ex: Gustavo)" value={newWaName} onChange={e => setNewWaName(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                    <input placeholder="Número com DDD (ex: 11999999999)" value={newWaPhone} onChange={e => setNewWaPhone(e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] placeholder:text-muted-foreground" />
                    <div className="flex gap-2">
                      <button onClick={() => { setShowWaForm(false); setNewWaName(''); setNewWaPhone(''); setNewWaKey('') }}
                        className="flex-1 text-xs border border-[#2a2a2a] px-3 py-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors">Cancelar</button>
                      <button onClick={addWhatsapp} disabled={!newWaName || !newWaPhone}
                        className="flex-1 text-xs bg-[#7c3aed] hover:bg-[#6d28d9] text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40">Adicionar</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {alertSettings.last_sent_at && (
            <p className="text-xs text-muted-foreground border-t border-[#2a2a2a] pt-3">
              Último alerta enviado: {new Date(alertSettings.last_sent_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
