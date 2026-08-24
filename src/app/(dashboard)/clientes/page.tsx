'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatBRL, formatDate } from '@/lib/utils/format'
import { Plus, Search, ChevronRight } from 'lucide-react'
import { NewClientModal } from '@/components/domain/NewClientModal'
import Link from 'next/link'
import { useRole } from '@/lib/hooks/useRole'
import { isFinanceRestricted } from '@/lib/roles'
import type { Client, Service } from '@/lib/supabase/types'

type ClientWithServices = Client & { services: Service[] }

const statusLabel: Record<string, string> = { ativo: 'Ativo', pausado: 'Pausado', encerrado: 'Encerrado' }
const statusColor: Record<string, string> = {
  ativo: 'text-[#22c55e] bg-[#22c55e]/10',
  pausado: 'text-[#f59e0b] bg-[#f59e0b]/10',
  encerrado: 'text-muted-foreground bg-[#2a2a2a]',
}

export default function ClientesPage() {
  const router = useRouter()
  const hideFinance = isFinanceRestricted(useRole())
  const [clients, setClients] = useState<ClientWithServices[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [showNew, setShowNew] = useState(false)

  const load = useCallback(() => {
    fetch('/api/clients')
      .then(r => r.json())
      .then(d => { setClients(d); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = clients.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'todos' || c.status === filterStatus
    return matchSearch && matchStatus
  })

  function clientMRR(c: ClientWithServices) {
    return (c.services ?? [])
      .filter(s => s.type === 'recorrente' && s.active)
      .reduce((sum, s) => sum + Number(s.amount), 0)
  }

  function activeServices(c: ClientWithServices) {
    return (c.services ?? []).filter(s => s.active).length
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">{clients.filter(c => c.status === 'ativo').length} ativos</p>
        </div>
        {!hideFinance && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Novo cliente
          </button>
        )}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg pl-8 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#7c3aed] transition-colors"
          />
        </div>
        <div className="flex gap-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1">
          {['todos', 'ativo', 'pausado', 'encerrado'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                filterStatus === s ? 'bg-[#2a2a2a] text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Mobile: cards ── */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl">
            {search || filterStatus !== 'todos' ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
          </div>
        ) : filtered.map(c => (
          <Link
            key={c.id}
            href={`/clientes/${c.id}`}
            className="block bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-4 flex items-center gap-3 hover:border-[#3a3a3a] active:bg-[#222] transition-colors"
          >
            {/* avatar */}
            <div className="w-10 h-10 rounded-full bg-[#7c3aed]/15 flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-[#a78bfa]">{c.name[0].toUpperCase()}</span>
            </div>
            {/* info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{c.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColor[c.status]}`}>
                  {statusLabel[c.status]}
                </span>
                {!hideFinance && clientMRR(c) > 0 && (
                  <span className="text-[10px] text-muted-foreground">{formatBRL(clientMRR(c))}/mês</span>
                )}
                {!hideFinance && activeServices(c) > 0 && (
                  <span className="text-[10px] text-muted-foreground">{activeServices(c)} serv.</span>
                )}
              </div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>

      {/* ── Desktop: tabela ── */}
      <div className="hidden md:block bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            {search || filterStatus !== 'todos' ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado ainda'}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {(hideFinance ? ['Nome', 'Status', 'Desde', ''] : ['Nome', 'Status', 'Serviços', 'MRR', 'Desde', '']).map(h => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-medium px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/clientes/${c.id}`)}
                  className="border-b border-[#2a2a2a] last:border-0 hover:bg-[#222222] cursor-pointer transition-colors"
                >
                  <td className="px-5 py-4 text-sm font-medium">{c.name}</td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusColor[c.status]}`}>
                      {statusLabel[c.status]}
                    </span>
                  </td>
                  {!hideFinance && <td className="px-5 py-4 text-sm text-muted-foreground">{activeServices(c)}</td>}
                  {!hideFinance && <td className="px-5 py-4 text-sm font-medium">{formatBRL(clientMRR(c))}</td>}
                  <td className="px-5 py-4 text-sm text-muted-foreground">{formatDate(c.started_at)}</td>
                  <td className="px-5 py-4">
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && (
        <NewClientModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); load() }}
        />
      )}
    </div>
  )
}
