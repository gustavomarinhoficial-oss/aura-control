'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, X, Pencil, Trash2, Paperclip, Loader2, Package, Camera, Mic, Monitor, Video, Box, AlertCircle } from 'lucide-react'
import { formatBRL, formatDate } from '@/lib/utils/format'
import { MoneyInput } from '@/components/ui/MoneyInput'
import { addMonthsClamped, installmentAmounts, parseInstallments, MAX_INSTALLMENTS } from '@/lib/finance/installments'

// Patrimônio da empresa: os bens (câmeras, lentes, iluminação...) e quanto deles já foi pago

interface Asset {
  id: string
  name: string
  category: string
  brand_model: string | null
  serial_number: string | null
  purchase_date: string
  total_amount: number
  payment_method: 'avista' | 'parcelado'
  installments: number | null
  first_installment_date: string | null
  card: string | null
  holder: string | null
  condition: string
  invoice_url: string | null
  invoice_name: string | null
  notes: string | null
  finance: { total: number; paid: number; count: number; paidCount: number }
}

const CATEGORIES: Record<string, { label: string; icon: React.ElementType }> = {
  video:       { label: 'Vídeo',       icon: Video },
  foto:        { label: 'Foto',        icon: Camera },
  audio:       { label: 'Áudio',       icon: Mic },
  informatica: { label: 'Informática', icon: Monitor },
  outros:      { label: 'Outros',      icon: Box },
}
const CONDITIONS: Record<string, { label: string; color: string }> = {
  novo:       { label: 'Novo',           color: '#22c55e' },
  em_uso:     { label: 'Em uso',         color: '#60a5fa' },
  manutencao: { label: 'Em manutenção',  color: '#f59e0b' },
  vendido:    { label: 'Vendido',        color: '#a3a3a3' },
  perdido:    { label: 'Perdido',        color: '#ef4444' },
}

const inputCls = 'w-full bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef] transition-colors'
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

export function AssetsTab({ onChanged }: { onChanged?: () => void }) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [totals, setTotals] = useState({ value: 0, count: 0, pendingInstallments: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('todas')
  const [condition, setCondition] = useState('ativos')
  const [editing, setEditing] = useState<Asset | 'new' | null>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/assets')
    const d = await res.json().catch(() => ({}))
    if (res.ok) { setAssets(d.assets ?? []); setTotals(d.totals); setError('') } else setError(d.error ?? 'Erro ao carregar o patrimônio')
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function remove(a: Asset) {
    const pending = a.finance.count - a.finance.paidCount
    const msg = pending > 0
      ? `Apagar "${a.name}"?\n\n${pending} parcela(s) ainda não paga(s) saem do Financeiro. As já pagas continuam lá.`
      : `Apagar "${a.name}"? Os lançamentos já pagos continuam no Financeiro.`
    if (!confirm(msg)) return
    await fetch(`/api/assets/${a.id}`, { method: 'DELETE' })
    load(); onChanged?.()
  }

  const filtered = assets.filter(a =>
    (category === 'todas' || a.category === category) &&
    (condition === 'todos' || (condition === 'ativos' ? !['vendido', 'perdido'].includes(a.condition) : a.condition === condition)),
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-[#1a1a1a] border border-[#efefef]/30 rounded-xl p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Valor do patrimônio</p>
          <p className="text-2xl font-bold">{formatBRL(totals.value)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">bens ativos (sem vendidos/perdidos)</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Itens</p>
          <p className="text-2xl font-bold">{totals.count}</p>
        </div>
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 col-span-2 md:col-span-1">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">Parcelas a pagar</p>
          <p className="text-2xl font-bold text-[#f59e0b]">{formatBRL(totals.pendingInstallments)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">ainda em aberto no Financeiro</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <select value={category} onChange={e => setCategory(e.target.value)} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs">
            <option value="todas">Todas as categorias</option>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={condition} onChange={e => setCondition(e.target.value)} className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs">
            <option value="ativos">Ativos</option>
            <option value="todos">Todos os estados</option>
            {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <button onClick={() => setEditing('new')} className="flex items-center gap-1.5 bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111] text-xs font-medium px-3 py-2 rounded-lg">
          <Plus size={13} /> Novo bem
        </button>
      </div>

      {error && <p className="text-xs text-[#ef4444] flex items-center gap-1"><AlertCircle size={12} />{error}</p>}

      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><div className="w-5 h-5 border-2 border-[#efefef] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-sm text-muted-foreground">
            <Package size={22} className="opacity-30" />
            {assets.length === 0 ? 'Nenhum bem cadastrado ainda' : 'Nenhum bem com esses filtros'}
          </div>
        ) : (
          <div className="divide-y divide-[#2a2a2a]">
            {filtered.map(a => {
              const cat = CATEGORIES[a.category] ?? CATEGORIES.outros
              const cond = CONDITIONS[a.condition] ?? CONDITIONS.em_uso
              return (
                <div key={a.id} className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#111111] border border-[#2a2a2a] flex items-center justify-center shrink-0">
                    <cat.icon size={15} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{a.name}</p>
                      <span style={{ color: cond.color, backgroundColor: cond.color + '1a' }} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full">{cond.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[cat.label, a.brand_model, a.serial_number ? `nº ${a.serial_number}` : null, a.holder ? `com ${a.holder}` : null].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Comprado em {formatDate(a.purchase_date)} · {a.payment_method === 'parcelado'
                        ? <>{a.installments}x{a.card ? ` no ${a.card}` : ''} · <span className={a.finance.paidCount === a.finance.count ? 'text-[#22c55e]' : 'text-[#f59e0b]'}>{a.finance.paidCount}/{a.finance.count} pagas</span></>
                        : <>à vista{a.card ? ` (${a.card})` : ''}</>}
                    </p>
                    {a.invoice_url && (
                      <a href={a.invoice_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-[#60a5fa] hover:underline mt-1">
                        <Paperclip size={10} /> {a.invoice_name || 'Nota fiscal'}
                      </a>
                    )}
                    {a.notes && <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap">{a.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatBRL(Number(a.total_amount))}</p>
                    <div className="flex items-center justify-end gap-1 mt-2">
                      <button onClick={() => setEditing(a)} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-[#2a2a2a]" title="Editar"><Pencil size={12} /></button>
                      <button onClick={() => remove(a)} className="text-muted-foreground hover:text-[#ef4444] p-1.5 rounded-lg hover:bg-[#ef4444]/5" title="Apagar"><Trash2 size={12} /></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {editing && (
        <AssetModal
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); onChanged?.() }}
        />
      )}
    </div>
  )
}

function AssetModal({ initial, onClose, onSaved }: { initial: Asset | null; onClose: () => void; onSaved: () => void }) {
  const purchase = initial?.purchase_date ?? today()
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    category: initial?.category ?? 'video',
    brand_model: initial?.brand_model ?? '',
    serial_number: initial?.serial_number ?? '',
    purchase_date: purchase,
    total_amount: initial ? String(initial.total_amount) : '',
    payment_method: initial?.payment_method ?? 'avista',
    installments: initial?.installments ? String(initial.installments) : '',
    first_installment_date: initial?.first_installment_date ?? addMonthsClamped(purchase, 1),
    card: initial?.card ?? '',
    holder: initial?.holder ?? '',
    condition: initial?.condition ?? 'novo',
    invoice_url: initial?.invoice_url ?? '',
    invoice_name: initial?.invoice_name ?? '',
    notes: initial?.notes ?? '',
    paid_upfront: true,
  })
  // a data da 1ª parcela acompanha a compra (+1 mês) até ser mexida na mão
  const [firstTouched, setFirstTouched] = useState(!!initial)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))

  const locked = !!initial && initial.finance.paidCount > 0 // já tem parcela paga: valor e pagamento ficam travados
  const n = parseInstallments(form.installments)
  const total = Number(form.total_amount)
  const parts = form.payment_method === 'parcelado' && n && total > 0 ? installmentAmounts(total, n, 'total') : null

  async function uploadInvoice(file: File | undefined) {
    if (!file) return
    if (file.size > 15 * 1024 * 1024) { setError('A nota fiscal passa de 15 MB.'); return }
    setUploading(true); setError('')
    try {
      const contentType = file.type || 'application/octet-stream'
      const pre = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, contentType }) })
      const info = await pre.json()
      if (!pre.ok) throw new Error(info.error ?? 'Erro ao preparar o envio')
      const put = await fetch(info.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file })
      if (!put.ok) throw new Error(`Erro ao enviar (${put.status})`)
      set({ invoice_url: info.publicUrl, invoice_name: file.name })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar a nota fiscal')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function save() {
    setError('')
    if (!form.name.trim()) return setError('Informe o nome do bem.')
    if (!(total > 0)) return setError('Informe o valor total pago.')
    if (form.payment_method === 'parcelado' && !n) return setError(`Informe em quantas vezes (de 2 a ${MAX_INSTALLMENTS}).`)
    setSaving(true)
    const res = await fetch(initial ? `/api/assets/${initial.id}` : '/api/assets', {
      method: initial ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, total_amount: total, installments: n }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) { setError(d.error ?? 'Erro ao salvar'); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{initial ? 'Editar bem' : 'Novo bem'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Nome / descrição</label>
            <input value={form.name} onChange={e => set({ name: e.target.value })} placeholder="Ex: Câmera Sony A7 IV" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Categoria</label>
              <select value={form.category} onChange={e => set({ category: e.target.value })} className={inputCls}>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Estado</label>
              <select value={form.condition} onChange={e => set({ condition: e.target.value })} className={inputCls}>
                {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Marca / modelo</label>
              <input value={form.brand_model} onChange={e => set({ brand_model: e.target.value })} placeholder="Sony A7 IV" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Nº de série (opcional)</label>
              <input value={form.serial_number} onChange={e => set({ serial_number: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Com quem está</label>
            <input value={form.holder} onChange={e => set({ holder: e.target.value })} placeholder="Ex: Gabriel, escritório..." className={inputCls} />
          </div>

          <div className={`rounded-lg border border-[#2a2a2a] p-3 space-y-3 ${locked ? 'opacity-60' : ''}`}>
            {locked && <p className="text-[11px] text-[#f59e0b]">Já tem parcela paga: valor e pagamento ficam travados. Ajuste as parcelas no Financeiro.</p>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Data da compra</label>
                <input type="date" disabled={locked} value={form.purchase_date}
                  onChange={e => { const v = e.target.value; set({ purchase_date: v, ...(firstTouched || !v ? {} : { first_installment_date: addMonthsClamped(v, 1) }) }) }} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Valor total pago</label>
                <MoneyInput disabled={locked} value={form.total_amount} onValueChange={v => set({ total_amount: v })} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(['avista', 'parcelado'] as const).map(m => (
                <button key={m} type="button" disabled={locked} onClick={() => set({ payment_method: m })}
                  className={`text-xs font-medium py-2 rounded-lg border transition-colors ${form.payment_method === m ? 'bg-[#efefef] text-[#111111] border-[#efefef]' : 'border-[#2a2a2a] text-muted-foreground hover:text-foreground'}`}>
                  {m === 'avista' ? 'À vista' : 'Parcelado'}
                </button>
              ))}
            </div>
            {form.payment_method === 'parcelado' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">Em quantas vezes?</label>
                  <input type="number" min={2} max={MAX_INSTALLMENTS} disabled={locked} value={form.installments} onChange={e => set({ installments: e.target.value })} placeholder="Ex: 10" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">1ª parcela (vencimento da fatura)</label>
                  <input type="date" disabled={locked} value={form.first_installment_date} onChange={e => { set({ first_installment_date: e.target.value }); setFirstTouched(true) }} className={inputCls} />
                </div>
              </div>
            ) : !initial && (
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={form.paid_upfront} onChange={e => set({ paid_upfront: e.target.checked })} className="accent-[#22c55e]" />
                Já está pago (lança no Financeiro como pago no dia da compra)
              </label>
            )}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Cartão / forma (opcional)</label>
              <input value={form.card} onChange={e => set({ card: e.target.value })} placeholder="Ex: Nubank, Inter, Pix" className={inputCls} />
            </div>
            {parts && (
              <p className="text-[11px] text-muted-foreground">
                {n}x de <span className="text-foreground font-medium">{formatBRL(parts[0])}</span>
                {parts[n! - 1] !== parts[0] ? ` (última ${formatBRL(parts[n! - 1])})` : ''}
                {form.first_installment_date ? <> · de {formatDate(form.first_installment_date)} até {formatDate(addMonthsClamped(form.first_installment_date, n! - 1))}</> : null}
                {' · '}cada parcela entra como Reinvestimento no mês da fatura.
              </p>
            )}
            {form.payment_method === 'avista' && total > 0 && (
              <p className="text-[11px] text-muted-foreground">Entra como 1 despesa de Reinvestimento em {formatDate(form.purchase_date)}.</p>
            )}
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Nota fiscal (PDF ou foto)</label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 text-xs border border-[#2a2a2a] hover:border-[#efefef] rounded-lg px-3 py-2 transition-colors">
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />} {form.invoice_url ? 'Trocar arquivo' : 'Anexar'}
              </button>
              {form.invoice_url && (
                <>
                  <a href={form.invoice_url} target="_blank" rel="noreferrer" className="text-xs text-[#60a5fa] hover:underline truncate max-w-[200px]">{form.invoice_name || 'Nota fiscal'}</a>
                  <button type="button" onClick={() => set({ invoice_url: '', invoice_name: '' })} className="text-muted-foreground hover:text-[#ef4444]"><X size={12} /></button>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={e => uploadInvoice(e.target.files?.[0])} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Observações</label>
            <textarea rows={2} value={form.notes} onChange={e => set({ notes: e.target.value })} className={`${inputCls} resize-none`} />
          </div>
        </div>

        {error && <p className="text-xs text-[#ef4444] flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-[#2a2a2a] text-sm py-2.5 rounded-lg hover:bg-[#222222] transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving || uploading} className="flex-1 bg-[#efefef] hover:bg-[#d9d9d9] text-[#111111] text-sm py-2.5 rounded-lg transition-colors disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}
