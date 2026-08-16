'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Sparkles, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { formatDate } from '@/lib/utils/format'
import { useRole } from '@/lib/hooks/useRole'
import { ROLE_NAME } from '@/lib/roles'

interface Foco {
  title: string
  due_date: string | null
  priority: string
  cliente: string | null
}

interface Stat {
  label: string
  value: string
  href: string
}

interface Briefing {
  recommendation: string
  focos: Foco[]
  data: { stats: Stat[]; alerts: string[] }
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function CeoBriefingHeader() {
  const role = useRole()
  const name = ROLE_NAME[role] || ''
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem('aura_omarBriefingCollapsed') === '1')
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('aura_omarBriefingCollapsed', next ? '1' : '0')
  }

  const load = useCallback((force = false) => {
    if (force) setRefreshing(true)
    fetch(`/api/ceo-briefing${force ? '?force=true' : ''}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setBriefing(d) })
      .finally(() => { setLoading(false); setRefreshing(false) })
  }, [])

  useEffect(() => { load() }, [load])

  if (!name) return null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{greeting()}, {name} 👋</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {collapsed ? (
        <button
          onClick={toggleCollapsed}
          className="flex items-center gap-2 text-sm text-[#a78bfa] bg-[#7c3aed]/10 hover:bg-[#7c3aed]/15 border border-[#7c3aed]/25 rounded-lg px-3 py-2 transition-colors"
        >
          <Sparkles size={13} />
          Recomendação do Omar
          <ChevronDown size={13} />
        </button>
      ) : (
        <>
          <div className="bg-gradient-to-br from-[#7c3aed]/10 to-transparent border border-[#7c3aed]/25 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#a78bfa]" />
                <h2 className="text-sm font-medium text-[#a78bfa]">Recomendação do Omar pra hoje</h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => load(true)}
                  disabled={refreshing || loading}
                  title="Gerar recomendação de novo"
                  className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 p-1"
                >
                  <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={toggleCollapsed}
                  title="Recolher"
                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                >
                  <ChevronUp size={13} />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="h-4 w-2/3 bg-[#2a2a2a] rounded animate-pulse" />
            ) : (
              <p className="text-sm leading-relaxed text-foreground">{briefing?.recommendation}</p>
            )}

            {briefing && briefing.focos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#7c3aed]/15">
                {briefing.focos.map((f, i) => (
                  <Link
                    key={i}
                    href="/tarefas"
                    className="flex items-center gap-1.5 text-xs bg-[#111111] border border-[#2a2a2a] hover:border-[#7c3aed]/40 rounded-full px-3 py-1.5 transition-colors"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${f.priority === 'alta' ? 'bg-[#ef4444]' : 'bg-[#f59e0b]'}`} />
                    <span className="font-medium">{f.title}</span>
                    {f.cliente && <span className="text-muted-foreground">· {f.cliente}</span>}
                    {f.due_date && <span className="text-muted-foreground">· {formatDate(f.due_date)}</span>}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {briefing && (briefing.data.stats ?? []).length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {briefing.data.stats.map((s, i) => (
                <Link key={i} href={s.href} className="bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-xl p-4 transition-colors">
                  <p className="text-xs text-muted-foreground mb-1.5">{s.label}</p>
                  <p className="text-lg font-semibold">{s.value}</p>
                </Link>
              ))}
            </div>
          )}

          {(briefing?.data.alerts ?? []).map((a, i) => (
            <p key={i} className="text-xs text-muted-foreground">{a}.</p>
          ))}
        </>
      )}
    </div>
  )
}
