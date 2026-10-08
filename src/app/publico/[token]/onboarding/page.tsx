'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Loader2, Check, ChevronRight, ChevronLeft, Upload, X, Eye, EyeOff, ExternalLink, CheckCircle2, AlertCircle, BookOpen,
} from 'lucide-react'
import { OwlMark } from '@/components/ui/OwlMark'
import { createClient } from '@/lib/supabase/client'
import {
  isField, isFilled, isVisible, missingRequired, visibleSections,
  type Answers, type Field, type Guide, type UploadedFile,
} from '@/lib/onboarding/form'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const inputCls =
  'w-full bg-[#141414] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#5a5a5a] focus:outline-none focus:border-[#efefef] transition-colors'

const fmtSize = (n?: number) => (n ? (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`) : '')

function GuideCard({ g }: { g: Guide }) {
  return (
    <details open className="rounded-2xl border border-[#2a2a2a] bg-[#141414] p-4 group">
      <summary className="flex items-center gap-2 cursor-pointer list-none text-sm font-medium text-[#efefef]">
        <BookOpen size={15} className="text-[#fbbf24] shrink-0" />
        {g.title}
      </summary>
      <ol className="mt-3 space-y-2.5 text-sm text-[#d4d4d4] list-decimal pl-5">
        {g.steps.map((s, i) => (
          <li key={i} className="leading-relaxed">
            {s.text}
            {s.link && (
              <a href={s.link.url} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex items-center gap-1 text-[#60a5fa] hover:underline">
                {s.link.label} <ExternalLink size={11} />
              </a>
            )}
          </li>
        ))}
      </ol>
      {g.footer && <p className="mt-3 text-xs text-[#9ca3af]">{g.footer}</p>}
    </details>
  )
}

function SecretInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} autoComplete="off" className={`${inputCls} pr-11`} />
      <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a7a7a] hover:text-white" aria-label={show ? 'Esconder' : 'Mostrar'}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}

export default function OnboardingPage() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [clientName, setClientName] = useState('')
  const [answers, setAnswers] = useState<Answers>({})
  const [stepId, setStepId] = useState<string>('')
  const [status, setStatus] = useState<'rascunho' | 'enviado'>('rascunho')
  const [editing, setEditing] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [showErrors, setShowErrors] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [uploadError, setUploadError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const topRef = useRef<HTMLDivElement>(null)

  const sections = visibleSections(answers)
  const stepIdx = stepId === 'review' ? sections.length : Math.max(0, sections.findIndex(s => s.id === stepId))
  const isReview = stepId === 'review'
  const section = isReview ? null : sections[stepIdx] ?? sections[0]

  useEffect(() => {
    fetch(`/api/public/onboarding?token=${token}`)
      .then(async r => {
        if (!r.ok) { setInvalid(true); return }
        const d = await r.json()
        setClientName(d.client?.name ?? '')
        setAnswers(d.answers ?? {})
        setStatus(d.status ?? 'rascunho')
        const secs = visibleSections(d.answers ?? {})
        setStepId(secs[Math.min(d.step ?? 0, secs.length - 1)]?.id ?? secs[0].id)
      })
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false))
  }, [token])

  const save = useCallback(async (a: Answers, stepIndex: number) => {
    setSaveState('saving')
    const res = await fetch('/api/public/onboarding', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, answers: a, step: stepIndex }),
    }).catch(() => null)
    setSaveState(res?.ok ? 'saved' : 'error')
  }, [token])

  // Salva sozinho ~1s depois que a pessoa para de digitar.
  function update(key: string, value: unknown) {
    const next = { ...answers, [key]: value }
    setAnswers(next)
    setSaveState('idle')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => save(next, stepIdx), 1000)
  }

  function goTo(id: string) {
    setShowErrors(false)
    setStepId(id)
    const idx = id === 'review' ? sections.length : sections.findIndex(s => s.id === id)
    save(answers, Math.max(0, idx))
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  function sectionMissing(): Field[] {
    if (!section) return []
    return section.blocks
      .filter(isField)
      .filter(f => f.required && isVisible(f.showIf, answers) && !isFilled(answers[f.key]))
  }

  function next() {
    if (sectionMissing().length > 0) { setShowErrors(true); return }
    const nextSection = sections[stepIdx + 1]
    goTo(nextSection ? nextSection.id : 'review')
  }

  function back() {
    if (isReview) { goTo(sections[sections.length - 1].id); return }
    const prev = sections[stepIdx - 1]
    if (prev) goTo(prev.id)
  }

  async function uploadFiles(field: Field, files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadError('')
    setUploading(u => ({ ...u, [field.key]: true }))
    const supabase = createClient()
    let current = (answers[field.key] as UploadedFile[] | undefined) ?? []
    let nextAnswers = answers
    for (const file of Array.from(files).slice(0, field.multiple ? 30 : 1)) {
      const res = await fetch('/api/public/onboarding/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, field: field.key, filename: file.name }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setUploadError(d.error ?? 'Não consegui preparar o envio.'); continue }
      const { error } = await supabase.storage.from('client-files').uploadToSignedUrl(d.path, d.token, file)
      if (error) { setUploadError(`Não consegui enviar "${file.name}": ${error.message}`); continue }
      const entry: UploadedFile = { path: d.path, name: file.name, size: file.size }
      current = field.multiple ? [...current, entry] : [entry]
      nextAnswers = { ...nextAnswers, [field.key]: current }
      setAnswers(nextAnswers)
    }
    setUploading(u => ({ ...u, [field.key]: false }))
    save(nextAnswers, stepIdx)
  }

  async function removeFile(field: Field, file: UploadedFile) {
    const list = ((answers[field.key] as UploadedFile[] | undefined) ?? []).filter(f => f.path !== file.path)
    const nextAnswers = { ...answers, [field.key]: list }
    setAnswers(nextAnswers)
    save(nextAnswers, stepIdx)
    fetch('/api/public/onboarding/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, path: file.path }),
    }).catch(() => {})
  }

  async function submit() {
    setSubmitting(true)
    setSubmitError('')
    if (timer.current) clearTimeout(timer.current)
    const res = await fetch('/api/public/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, answers }),
    }).catch(() => null)
    const d = res ? await res.json().catch(() => ({})) : {}
    if (res?.ok) { setStatus('enviado'); setEditing(false) }
    else setSubmitError(d.error ?? 'Não consegui enviar agora. Tente de novo.')
    setSubmitting(false)
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d]"><Loader2 size={22} className="animate-spin text-[#efefef]" /></div>
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0d0d0d] text-center px-6">
        <p className="text-lg font-semibold text-white">Link inválido</p>
        <p className="text-sm text-[#7a7a7a] mt-1">Esse link não existe ou não é mais válido. Fale com a equipe da OWL.</p>
      </div>
    )
  }

  const Header = (
    <div ref={topRef} className="scroll-mt-4">
      <div className="flex items-center gap-2.5">
        <OwlMark size={28} />
        <p className="text-[10px] tracking-[0.25em] text-[#efefef] uppercase font-semibold">OWL Creative Club</p>
      </div>
    </div>
  )

  // ── Tela de "enviado" ──
  if (status === 'enviado' && !editing) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] text-white">
        <div className="max-w-xl mx-auto px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-10">
          {Header}
          <div className="mt-10 rounded-2xl border border-[#232323] bg-[#141414] p-8 text-center">
            <CheckCircle2 size={44} className="mx-auto text-[#34d399]" strokeWidth={1.4} />
            <h1 className="mt-4 text-2xl font-bold tracking-tight">Tudo certo{clientName ? `, ${clientName}` : ''}!</h1>
            <p className="mt-2 text-sm text-[#9ca3af] leading-relaxed">
              Recebemos todas as suas informações. A equipe da OWL já está com tudo e vai começar a montar o seu planejamento.
            </p>
            <button
              onClick={() => { setEditing(true); setStepId(sections[0].id) }}
              className="mt-6 text-xs font-medium text-[#efefef] border border-[#2a2a2a] hover:border-[#efefef] rounded-full px-4 py-2 transition-colors"
            >
              Atualizar minhas respostas
            </button>
          </div>
        </div>
      </div>
    )
  }

  const missingAll = missingRequired(answers)
  const errs = showErrors ? new Set(sectionMissing().map(f => f.key)) : new Set<string>()
  const totalSteps = sections.length + 1

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="max-w-xl mx-auto px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-3">
          {Header}
          <span className="text-[11px] text-[#7a7a7a] flex items-center gap-1.5 pt-1.5 shrink-0">
            {saveState === 'saving' && (<><Loader2 size={11} className="animate-spin" /> Salvando...</>)}
            {saveState === 'saved' && (<><Check size={11} className="text-[#34d399]" /> Salvo</>)}
            {saveState === 'error' && (<><AlertCircle size={11} className="text-[#f87171]" /> Não salvou</>)}
          </span>
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-tight">
          {clientName ? `Olá, ${clientName}!` : 'Olá!'}
        </h1>
        <p className="mt-1 text-sm text-[#9ca3af]">
          Este formulário nos ajuda a conhecer o seu negócio e montar um plano sob medida. Suas respostas ficam salvas automaticamente: pode fechar e voltar quando quiser.
        </p>

        {/* progresso */}
        <div className="mt-6">
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className="h-1 flex-1 rounded-full transition-colors" style={{ backgroundColor: i <= stepIdx ? '#efefef' : '#262626' }} />
            ))}
          </div>
          <p className="mt-2 text-[11px] text-[#7a7a7a]">
            Etapa {stepIdx + 1} de {totalSteps}{section ? ` · ${section.title}` : ' · Revisar e enviar'}
          </p>
        </div>

        {/* seção atual */}
        {section && (
          <div className="mt-6 rounded-2xl border border-[#232323] bg-[#101010] p-5 sm:p-6">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            {section.subtitle && <p className="mt-1 text-sm text-[#9ca3af]">{section.subtitle}</p>}

            <div className="mt-5 space-y-5">
              {section.blocks.map(b => {
                if (!isVisible(b.showIf, answers)) return null
                if (!isField(b)) {
                  return b.kind === 'guide' ? <GuideCard key={b.key} g={b} /> : <p key={b.key} className="text-sm text-[#9ca3af]">{b.text}</p>
                }
                const f = b
                const v = answers[f.key]
                const hasErr = errs.has(f.key)
                return (
                  <div key={f.key}>
                    <label className="block text-sm font-medium mb-1.5">
                      {f.label}{f.required && <span className="text-[#f87171] ml-0.5">*</span>}
                    </label>
                    {f.hint && <p className="text-xs text-[#7a7a7a] mb-2">{f.hint}</p>}

                    {(f.type === 'text' || f.type === 'email' || f.type === 'tel' || f.type === 'url') && (
                      <input
                        type={f.type === 'text' ? 'text' : f.type}
                        value={(v as string) ?? ''}
                        onChange={e => update(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        className={`${inputCls} ${hasErr ? 'border-[#f87171]' : ''}`}
                      />
                    )}
                    {f.type === 'textarea' && (
                      <textarea
                        value={(v as string) ?? ''}
                        onChange={e => update(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        rows={4}
                        className={`${inputCls} resize-y ${hasErr ? 'border-[#f87171]' : ''}`}
                      />
                    )}
                    {f.type === 'password' && <SecretInput value={(v as string) ?? ''} onChange={x => update(f.key, x)} />}
                    {f.type === 'select' && (
                      <select
                        value={(v as string) ?? ''}
                        onChange={e => update(f.key, e.target.value)}
                        className={`${inputCls} ${hasErr ? 'border-[#f87171]' : ''}`}
                      >
                        <option value="">Selecione...</option>
                        {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    )}
                    {f.type === 'radio' && (
                      <div className="flex flex-wrap gap-2">
                        {f.options?.map(o => {
                          const active = v === o.value
                          return (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => update(f.key, active ? '' : o.value)}
                              className={`text-sm font-medium px-4 py-2 rounded-full border transition-colors ${
                                active ? 'bg-[#efefef] text-[#111111] border-[#efefef]' : 'text-[#d4d4d4] border-[#2a2a2a] hover:border-[#efefef]'
                              }`}
                            >
                              {o.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {f.type === 'checkboxes' && (
                      <div className={`flex flex-wrap gap-2 ${hasErr ? 'rounded-xl ring-1 ring-[#f87171] p-2' : ''}`}>
                        {f.options?.map(o => {
                          const list = (v as string[] | undefined) ?? []
                          const active = list.includes(o.value)
                          return (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => update(f.key, active ? list.filter(x => x !== o.value) : [...list, o.value])}
                              className={`text-sm font-medium px-4 py-2 rounded-full border transition-colors flex items-center gap-1.5 ${
                                active ? 'bg-[#efefef] text-[#111111] border-[#efefef]' : 'text-[#d4d4d4] border-[#2a2a2a] hover:border-[#efefef]'
                              }`}
                            >
                              {active && <Check size={13} />}
                              {o.label}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {f.type === 'file' && (
                      <div className={`${hasErr ? 'rounded-xl ring-1 ring-[#f87171] p-2' : ''}`}>
                        {((v as UploadedFile[] | undefined) ?? []).map(file => (
                          <div key={file.path} className="flex items-center justify-between gap-3 rounded-xl border border-[#2a2a2a] bg-[#141414] px-3 py-2 mb-2 text-sm">
                            <span className="truncate">{file.name}</span>
                            <span className="flex items-center gap-2 shrink-0 text-xs text-[#7a7a7a]">
                              {fmtSize(file.size)}
                              <button type="button" onClick={() => removeFile(f, file)} aria-label="Remover" className="hover:text-[#f87171]"><X size={14} /></button>
                            </span>
                          </div>
                        ))}
                        {(f.multiple || !((v as UploadedFile[] | undefined) ?? []).length) && (
                          <label className="flex items-center justify-center gap-2 cursor-pointer rounded-xl border border-dashed border-[#3a3a3a] hover:border-[#efefef] px-4 py-4 text-sm text-[#9ca3af] hover:text-white transition-colors">
                            {uploading[f.key] ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                            {uploading[f.key] ? 'Enviando...' : f.multiple ? 'Escolher arquivos' : 'Escolher arquivo'}
                            <input type="file" multiple={f.multiple} className="hidden" onChange={e => { uploadFiles(f, e.target.files); e.target.value = '' }} />
                          </label>
                        )}
                      </div>
                    )}
                    {hasErr && <p className="mt-1.5 text-xs text-[#f87171]">Esse campo é obrigatório.</p>}
                  </div>
                )
              })}
            </div>
            {uploadError && <p className="mt-4 text-xs text-[#f87171]">{uploadError}</p>}
            {showErrors && sectionMissing().length > 0 && (
              <p className="mt-4 text-xs text-[#f87171]">Preencha os campos marcados com * pra continuar.</p>
            )}
          </div>
        )}

        {/* revisão final */}
        {isReview && (
          <div className="mt-6 rounded-2xl border border-[#232323] bg-[#101010] p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Revisar e enviar</h2>
            {missingAll.length === 0 ? (
              <p className="mt-2 text-sm text-[#9ca3af]">Tudo preenchido! Se quiser, volte e confira alguma etapa. Quando estiver pronto, é só enviar.</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-[#9ca3af]">Faltam alguns campos obrigatórios:</p>
                <ul className="mt-3 space-y-1.5">
                  {missingAll.map(m => (
                    <li key={m.field.key} className="flex items-center justify-between gap-3 text-sm">
                      <span><span className="text-[#7a7a7a]">{m.section.title} ·</span> {m.field.label}</span>
                      <button onClick={() => { setShowErrors(true); goTo(m.section.id) }} className="shrink-0 text-xs text-[#60a5fa] hover:underline">Ir</button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {submitError && <p className="mt-4 text-xs text-[#f87171]">{submitError}</p>}
          </div>
        )}

        {/* navegação */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={back}
            disabled={stepIdx === 0 && !isReview}
            className="flex items-center gap-1.5 text-sm text-[#9ca3af] hover:text-white disabled:opacity-30 transition-colors px-2 py-2"
          >
            <ChevronLeft size={16} /> Voltar
          </button>
          {isReview ? (
            <button
              onClick={submit}
              disabled={submitting || missingAll.length > 0}
              className="flex items-center gap-2 bg-[#efefef] hover:bg-[#d9d9d9] disabled:opacity-50 disabled:cursor-not-allowed text-[#111111] text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Enviar formulário
            </button>
          ) : (
            <button
              onClick={next}
              className="flex items-center gap-2 bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111] text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              Continuar <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
