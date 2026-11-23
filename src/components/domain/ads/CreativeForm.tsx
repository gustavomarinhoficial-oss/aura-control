'use client'

import { useRef, useState } from 'react'
import { X, Loader2, Upload, ArrowLeft, ArrowRight, Trash2, Film, ImageIcon } from 'lucide-react'
import { AdPreview } from './AdPreview'
import { inputCls, Field } from './CampaignForm'
import { PLACEMENTS, CTAS, DESTINATIONS, APPROVAL_STATUS, isVideoUrl, type AdCreative } from '@/lib/ads/constants'

const MAX_FILES = 10
const MAX_VIDEO_MB = 500
const MAX_IMAGE_MB = 25
const EXT_MIME: Record<string, string> = { mp4: 'video/mp4', mov: 'video/quicktime', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

// Mesmo fluxo do calendário: pede a URL assinada em /api/upload e envia o arquivo direto pro R2
// (com barra de progresso, porque vídeo de anúncio costuma ser pesado).
function uploadFile(file: File, onProgress: (pct: number) => void): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const contentType = EXT_MIME[ext] ?? file.type
  return new Promise(async (resolve, reject) => {
    try {
      const pre = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, contentType }) })
      const info = await pre.json().catch(() => ({}))
      if (!pre.ok) return reject(new Error(info.error ?? `Erro ${pre.status}`))
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', info.uploadUrl)
      xhr.setRequestHeader('Content-Type', contentType)
      xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve(info.publicUrl) : reject(new Error(`Erro ao enviar "${file.name}" (${xhr.status})`)))
      xhr.onerror = () => reject(new Error(`Falha de conexão ao enviar "${file.name}"`))
      xhr.send(file)
    } catch {
      reject(new Error('Falha de conexão'))
    }
  })
}

type Form = {
  name: string; media_urls: string[]; cover_url: string | null; placement: AdCreative['placement']; primary_text: string; headline: string
  cta: AdCreative['cta']; destination_type: '' | NonNullable<AdCreative['destination_type']>; destination: string; approval_status: AdCreative['approval_status']
}

export function CreativeForm({ campaignId, clientName, initial, onClose, onSaved }: {
  campaignId: string
  clientName: string
  initial?: AdCreative
  onClose: () => void
  onSaved: (c: AdCreative) => void
}) {
  const [form, setForm] = useState<Form>({
    name: initial?.name ?? '',
    media_urls: initial?.media_urls ?? [],
    cover_url: initial?.cover_url ?? null,
    placement: initial?.placement ?? 'stories_reels',
    primary_text: initial?.primary_text ?? '',
    headline: initial?.headline ?? '',
    cta: initial?.cta ?? 'enviar_mensagem',
    destination_type: initial?.destination_type ?? 'whatsapp',
    destination: initial?.destination ?? '',
    // editar um criativo que voltou com ajuste já deixa pronto pra reenviar ao cliente
    approval_status: initial ? (initial.approval_status === 'ajuste' || initial.approval_status === 'reprovado' ? 'aguardando' : initial.approval_status) : 'aguardando',
  })
  const [uploading, setUploading] = useState<{ name: string; pct: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }))

  async function addFiles(files: FileList | null, asCover = false) {
    if (!files?.length) return
    setError('')
    const list = asCover ? [files[0]] : Array.from(files).slice(0, MAX_FILES - form.media_urls.length)
    for (const file of list) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
      const isVideo = ext === 'mp4' || ext === 'mov' || file.type.startsWith('video/')
      if (isVideo && !['mp4', 'mov'].includes(ext)) { setError(`"${file.name}": use vídeo MP4 ou MOV.`); continue }
      if (!isVideo && !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) { setError(`"${file.name}": use imagem JPG, PNG ou WebP.`); continue }
      if (asCover && isVideo) { setError('A capa precisa ser uma imagem.'); continue }
      const limit = (isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB) * 1024 * 1024
      if (file.size > limit) { setError(`"${file.name}" passou de ${isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB} MB.`); continue }
      setUploading({ name: file.name, pct: 0 })
      try {
        const url = await uploadFile(file, pct => setUploading({ name: file.name, pct }))
        if (asCover) set('cover_url', url)
        else setForm(f => ({ ...f, media_urls: [...f.media_urls, url] }))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro no envio')
      }
    }
    setUploading(null)
  }

  function move(i: number, dir: -1 | 1) {
    setForm(f => {
      const m = [...f.media_urls]
      const j = i + dir
      if (j < 0 || j >= m.length) return f
      ;[m[i], m[j]] = [m[j], m[i]]
      return { ...f, media_urls: m }
    })
  }

  async function save() {
    setError('')
    if (!form.name.trim()) return setError('Dê um nome ao criativo')
    if (form.media_urls.length === 0) return setError('Envie pelo menos um vídeo ou imagem')
    if (form.destination_type && !form.destination.trim()) return setError('Informe o destino do anúncio')
    setSaving(true)
    const payload = {
      ...form,
      destination_type: form.destination_type || null,
      destination: form.destination_type ? form.destination : null,
      // só manda o status se mudou (senão a data da aprovação do cliente seria sobrescrita)
      approval_status: initial && form.approval_status !== initial.approval_status ? form.approval_status : undefined,
    }
    const res = await fetch(initial ? `/api/ads/creatives/${initial.id}` : `/api/ads/campaigns/${campaignId}/creatives`, {
      method: initial ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null)
    const data = res ? await res.json().catch(() => ({})) : {}
    setSaving(false)
    if (!res?.ok) return setError(data.error ?? 'Erro ao salvar')
    onSaved(data)
  }

  const destPlaceholder = form.destination_type === 'whatsapp' ? '21 99999-8888' : form.destination_type === 'instagram' ? '@perfil' : 'https://…'

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget && !uploading) onClose() }}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">{initial ? 'Editar criativo' : 'Novo criativo'}</h2>
          <button onClick={onClose} disabled={!!uploading} className="text-muted-foreground hover:text-foreground disabled:opacity-40"><X size={15} /></button>
        </div>

        <div className="grid md:grid-cols-[1fr_320px] gap-6">
          <div className="space-y-3">
            <Field label="Nome do criativo">
              <input autoFocus value={form.name} onChange={e => set('name', e.target.value)} placeholder='Ex.: Reels terça, escalopes' className={inputCls} />
            </Field>

            <Field label={`Mídia (vídeo MP4/MOV até ${MAX_VIDEO_MB} MB ou imagens) · ${form.media_urls.length}/${MAX_FILES}`}>
              <div className="space-y-2">
                {form.media_urls.map((u, i) => (
                  <div key={u} className="flex items-center gap-2 bg-[#111] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs">
                    {isVideoUrl(u) ? <Film size={13} className="text-[#38bdf8] shrink-0" /> : <ImageIcon size={13} className="text-[#a78bfa] shrink-0" />}
                    <span className="truncate flex-1 text-muted-foreground">{i + 1}. {u.split('/').pop()}</span>
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 disabled:opacity-30 hover:text-foreground" title="Subir"><ArrowLeft size={12} className="rotate-90" /></button>
                    <button onClick={() => move(i, 1)} disabled={i === form.media_urls.length - 1} className="p-1 disabled:opacity-30 hover:text-foreground" title="Descer"><ArrowRight size={12} className="rotate-90" /></button>
                    <button onClick={() => set('media_urls', form.media_urls.filter(x => x !== u))} className="p-1 hover:text-[#ef4444]" title="Remover"><Trash2 size={12} /></button>
                  </div>
                ))}
                {uploading ? (
                  <div className="bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs space-y-1.5">
                    <p className="truncate text-muted-foreground">Enviando {uploading.name}… {uploading.pct}%</p>
                    <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden"><div className="h-full bg-[#22c55e] transition-all" style={{ width: `${uploading.pct}%` }} /></div>
                  </div>
                ) : form.media_urls.length < MAX_FILES && (
                  <button onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 text-xs py-3 rounded-lg border border-dashed border-[#3a3a3a] text-muted-foreground hover:text-foreground hover:border-[#efefef]">
                    <Upload size={13} /> Enviar vídeo ou imagens
                  </button>
                )}
                <input ref={fileRef} type="file" multiple accept="video/mp4,video/quicktime,.mov,.mp4,image/jpeg,image/png,image/webp" className="hidden"
                  onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
              </div>
            </Field>

            {form.media_urls.some(isVideoUrl) && (
              <Field label="Capa do vídeo (opcional)">
                <div className="flex items-center gap-2">
                  <button onClick={() => coverRef.current?.click()} disabled={!!uploading} className="text-xs px-3 py-2 rounded-lg border border-[#2a2a2a] hover:border-[#efefef] disabled:opacity-40">
                    {form.cover_url ? 'Trocar capa' : 'Enviar capa'}
                  </button>
                  {form.cover_url && <button onClick={() => set('cover_url', null)} className="text-xs text-muted-foreground hover:text-[#ef4444]">Remover</button>}
                  <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { addFiles(e.target.files, true); e.target.value = '' }} />
                </div>
              </Field>
            )}

            <Field label="Formato / posicionamento">
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(PLACEMENTS).map(([k, v]) => (
                  <button key={k} onClick={() => set('placement', k as Form['placement'])}
                    className={`text-xs py-2 rounded-lg border transition-colors ${form.placement === k ? 'border-[#efefef] bg-[#efefef]/10 text-foreground' : 'border-[#2a2a2a] text-muted-foreground hover:text-foreground'}`}>{v}</button>
                ))}
              </div>
            </Field>

            <Field label="Texto principal">
              <textarea value={form.primary_text} onChange={e => set('primary_text', e.target.value)} rows={4} placeholder="O texto que aparece em cima do anúncio" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Título (opcional)">
                <input value={form.headline} onChange={e => set('headline', e.target.value)} placeholder="Ex.: Reserve sua mesa" className={inputCls} />
              </Field>
              <Field label="Botão (CTA)">
                <select value={form.cta} onChange={e => set('cta', e.target.value as Form['cta'])} className={inputCls}>
                  {Object.entries(CTAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-[140px_1fr] gap-3">
              <Field label="Destino">
                <select value={form.destination_type} onChange={e => set('destination_type', e.target.value as Form['destination_type'])} className={inputCls}>
                  <option value="">Nenhum</option>
                  {Object.entries(DESTINATIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label={form.destination_type === 'whatsapp' ? 'Número do WhatsApp' : form.destination_type === 'instagram' ? 'Perfil' : 'Link'}>
                <input value={form.destination} onChange={e => set('destination', e.target.value)} disabled={!form.destination_type} placeholder={destPlaceholder} className={`${inputCls} disabled:opacity-40`} />
              </Field>
            </div>
            {initial && (
              <Field label="Status de aprovação">
                <select value={form.approval_status} onChange={e => set('approval_status', e.target.value as Form['approval_status'])} className={inputCls}>
                  {Object.entries(APPROVAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                {initial.approval_status !== form.approval_status && form.approval_status === 'aguardando' && (
                  <p className="text-[11px] text-muted-foreground mt-1">Vai voltar para o cliente aprovar de novo.</p>
                )}
              </Field>
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Prévia</p>
            <AdPreview creative={{ ...form, destination_type: form.destination_type || null }} clientName={clientName} />
          </div>
        </div>

        {error && <p className="text-xs text-[#ef4444] mt-4">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} disabled={!!uploading} className="text-sm px-4 py-2 text-muted-foreground hover:text-foreground disabled:opacity-40">Cancelar</button>
          <button onClick={save} disabled={saving || !!uploading} className="text-sm font-medium px-4 py-2 rounded-lg bg-[#efefef] text-[#111] disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 size={13} className="animate-spin" />}{initial ? 'Salvar' : 'Criar criativo'}
          </button>
        </div>
      </div>
    </div>
  )
}
