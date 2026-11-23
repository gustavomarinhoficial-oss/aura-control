'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, Megaphone, ChevronRight } from 'lucide-react'
import { CampaignForm } from '@/components/domain/ads/CampaignForm'
import { OBJECTIVES, CAMPAIGN_STATUS, formatBudget, formatPeriod, type AdCampaign, type CreativeCounts } from '@/lib/ads/constants'

type Row = AdCampaign & { counts: CreativeCounts; clients: { id: string; name: string } | null }
interface ClientOpt { id: string; name: string; status: string }

// Criativos de Tráfego: campanhas de anúncios por cliente, com quantos criativos o cliente já aprovou
export default function CriativosPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [clients, setClients] = useState<ClientOpt[]>([])
  const [clientFilter, setClientFilter] = useState('')
  const [showEnded, setShowEnded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/ads/campaigns').catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    if (!res?.ok) setError(data?.error ?? 'Erro ao carregar')
    else { setRows(Array.isArray(data) ? data : []); setError('') }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    fetch('/api/clients').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setClients(d.map((c: ClientOpt) => ({ id: c.id, name: c.name, status: c.status })).sort((a: ClientOpt, b: ClientOpt) => a.name.localeCompare(b.name)))
    }).catch(() => {})
  }, [load])

  const activeClients = clients.filter(c => c.status !== 'encerrado')
  const visible = rows.filter(r => (!clientFilter || r.client_id === clientFilter) && (showEnded || r.status !== 'encerrada'))
  const endedCount = rows.filter(r => (!clientFilter || r.client_id === clientFilter) && r.status === 'encerrada').length

  // agrupado por cliente, em ordem alfabética
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; items: Row[] }>()
    for (const r of visible) {
      const name = r.clients?.name ?? 'Cliente'
      m.set(r.client_id, { name, items: [...(m.get(r.client_id)?.items ?? []), r] })
    }
    return Array.from(m.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name))
  }, [visible])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Criativos de Tráfego</h1>
          <p className="text-sm text-muted-foreground mt-1">Campanhas de anúncios e os criativos que o cliente aprova pelo link (aba Anúncios).</p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg bg-[#efefef] text-[#111]">
          <Plus size={14} /> Nova campanha
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select value={clientFilter} onChange={e => setClientFilter(e.target.value)} className="bg-[#111] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef]">
          <option value="">Todos os clientes</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.status === 'encerrado' ? ' (encerrado)' : ''}</option>)}
        </select>
        {endedCount > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showEnded} onChange={e => setShowEnded(e.target.checked)} className="accent-[#efefef]" />
            Mostrar encerradas ({endedCount})
          </label>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
      ) : error ? (
        <div className="bg-[#ef4444]/10 border border-[#ef4444]/25 text-[#fca5a5] text-sm rounded-xl px-4 py-3">{error}</div>
      ) : groups.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl flex flex-col items-center justify-center gap-2 h-48 text-sm text-muted-foreground">
          <Megaphone size={24} className="opacity-30" />
          Nenhuma campanha {clientFilter ? 'para este cliente' : 'ainda'}.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([clientId, g]) => (
            <section key={clientId} className="space-y-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.name}</h2>
              <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl divide-y divide-[#2a2a2a]">
                {g.items.map(r => <CampaignRow key={r.id} row={r} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {creating && (
        <CampaignForm
          clients={activeClients}
          defaultClientId={clientFilter || undefined}
          onClose={() => setCreating(false)}
          onSaved={c => { setCreating(false); router.push(`/criativos/${c.id}`) }}
        />
      )}
    </div>
  )
}

function CampaignRow({ row }: { row: Row }) {
  const st = CAMPAIGN_STATUS[row.status]
  const k = row.counts
  return (
    <Link href={`/criativos/${row.id}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-[#202020] transition-colors">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{row.name}</p>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: st.color + '22', color: st.color }}>{st.label}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {OBJECTIVES[row.objective]} · {formatBudget(row.budget_type, row.budget_amount)} · {formatPeriod(row.start_date, row.end_date)}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
        {k.total === 0 ? (
          <span className="text-[11px] text-muted-foreground">sem criativos</span>
        ) : (
          <>
            <Chip color="#22c55e" label={`${k.aprovado}/${k.total} aprovados`} />
            {k.aguardando > 0 && <Chip color="#f59e0b" label={`${k.aguardando} pendente${k.aguardando !== 1 ? 's' : ''}`} />}
            {k.ajuste > 0 && <Chip color="#fb923c" label={`${k.ajuste} ajuste${k.ajuste !== 1 ? 's' : ''}`} />}
            {k.reprovado > 0 && <Chip color="#ef4444" label={`${k.reprovado} reprovado${k.reprovado !== 1 ? 's' : ''}`} />}
          </>
        )}
        <ChevronRight size={15} className="text-muted-foreground ml-1" />
      </div>
    </Link>
  )
}

function Chip({ color, label }: { color: string; label: string }) {
  return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: color + '1f', color }}>{label}</span>
}
