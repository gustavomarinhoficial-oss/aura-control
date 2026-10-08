'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Check, ExternalLink, RefreshCw, Download, FileText, Eye, EyeOff, Loader2, Printer } from 'lucide-react'
import { buildDiagnostic, diagnosticToText } from '@/lib/onboarding/format'
import type { Answers } from '@/lib/onboarding/form'

interface Data {
  clientName: string
  token: string
  status: 'rascunho' | 'enviado' | null
  step: number
  submittedAt: string | null
  appliedAt: string | null
  updatedAt: string | null
  answers: Answers
  fileUrls: Record<string, string>
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—')

function Secret({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono">{show ? text : '••••••••'}</span>
      <button onClick={() => setShow(s => !s)} className="text-muted-foreground hover:text-foreground" aria-label="Mostrar/esconder">
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </span>
  )
}

export function DiagnosticoTab({ clientId }: { clientId: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState<'' | 'apply' | 'regen'>('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/onboarding`)
    const d = await res.json().catch(() => ({}))
    if (!res.ok) setError(d.error ?? 'Erro ao carregar')
    else setData(d)
    setLoading(false)
  }, [clientId])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex justify-center h-32 items-center"><Loader2 className="animate-spin" size={20} /></div>
  if (error || !data) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6 text-sm text-[#ef4444]">
        {error || 'Erro'}
        <p className="text-xs text-muted-foreground mt-1">Se for a primeira vez, confirme que a migração 041 foi executada.</p>
      </div>
    )
  }

  const link = `${typeof window !== 'undefined' ? window.location.origin : ''}/publico/${data.token}/onboarding`
  const sections = buildDiagnostic(data.answers)
  const statusLabel = data.status === 'enviado' ? 'Enviado' : data.status === 'rascunho' ? 'Em andamento' : 'Não iniciado'
  const statusCls = data.status === 'enviado' ? 'text-[#22c55e] bg-[#22c55e]/10' : data.status === 'rascunho' ? 'text-[#f59e0b] bg-[#f59e0b]/10' : 'text-muted-foreground bg-[#2a2a2a]'

  async function copy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  async function post(action: 'apply' | 'regenerate') {
    if (action === 'regenerate' && !confirm('Gerar um novo link? O link atual deixa de funcionar.')) return
    setBusy(action === 'apply' ? 'apply' : 'regen')
    setMsg('')
    const res = await fetch(`/api/clients/${clientId}/onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) setMsg(d.error ?? 'Erro')
    else if (action === 'apply') setMsg(d.filled?.length ? `Hub atualizado (${d.filled.length} campos preenchidos).` : 'Nada novo a preencher: os campos do Hub já tinham conteúdo.')
    await load()
    setBusy('')
  }

  function downloadTxt() {
    const blob = new Blob([diagnosticToText(data!.clientName, data!.answers, data!.submittedAt)], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `diagnostico-${data!.clientName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-medium">Formulário de onboarding</p>
            <p className="text-xs text-muted-foreground mt-0.5">Mande esse link pro cliente preencher. Tudo cai aqui e no Hub da marca.</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusCls}`}>{statusLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <input readOnly value={link} className="flex-1 min-w-0 bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-muted-foreground" />
          <button onClick={copy} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[#2a2a2a] hover:bg-[#2a2a2a]">
            {copied ? <Check size={13} className="text-[#22c55e]" /> : <Copy size={13} />} {copied ? 'Copiado' : 'Copiar'}
          </button>
          <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[#2a2a2a] hover:bg-[#2a2a2a]">
            <ExternalLink size={13} /> Abrir
          </a>
          <button onClick={() => post('regenerate')} disabled={busy !== ''} title="Gerar novo link" className="p-2 rounded-lg border border-[#2a2a2a] hover:bg-[#2a2a2a] text-muted-foreground">
            <RefreshCw size={13} className={busy === 'regen' ? 'animate-spin' : ''} />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {data.status === 'enviado' ? `Enviado em ${fmt(data.submittedAt)}` : data.updatedAt ? `Última atividade: ${fmt(data.updatedAt)}` : 'O cliente ainda não abriu o formulário.'}
          {data.appliedAt && ` · Aplicado no Hub em ${fmt(data.appliedAt)}`}
        </p>
      </div>

      {sections.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => post('apply')} disabled={busy !== ''} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[#2a2a2a] hover:bg-[#2a2a2a]">
              {busy === 'apply' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Reaplicar no Hub
            </button>
            <button onClick={downloadTxt} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[#2a2a2a] hover:bg-[#2a2a2a]">
              <Download size={13} /> Baixar TXT
            </button>
            <a href={`/diagnostico/${clientId}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border border-[#2a2a2a] hover:bg-[#2a2a2a]">
              <Printer size={13} /> Baixar PDF
            </a>
            {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
          </div>

          {sections.map(s => (
            <div key={s.id} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <p className="px-5 py-3 text-sm font-semibold border-b border-[#2a2a2a]">{s.title}</p>
              <div className="divide-y divide-[#2a2a2a]">
                {s.entries.map(e => (
                  <div key={e.key} className="px-5 py-3">
                    <p className="text-xs text-muted-foreground mb-1">{e.label}</p>
                    {e.files.length > 0 ? (
                      <div className="space-y-1">
                        {e.files.map(f => (
                          <a key={f.path} href={data.fileUrls[f.path]} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-[#60a5fa] hover:underline">
                            <FileText size={13} /> {f.name}
                          </a>
                        ))}
                      </div>
                    ) : e.secret ? (
                      <p className="text-sm"><Secret text={e.text} /></p>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">{e.text}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
