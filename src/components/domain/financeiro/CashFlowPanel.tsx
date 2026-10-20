'use client'

import { useCallback, useEffect, useState } from 'react'
import { Settings2, Check, X, Loader2, PiggyBank } from 'lucide-react'
import { formatBRL } from '@/lib/utils/format'

interface Flow {
  carryOver: number
  received: number
  spent: number
  prolabore: number
  invested: number
  final: number
  investedTotal: number
  openingBalance: number
  flowStartMonth: string | null
}

function Box({ label, value, color, sign }: { label: string; value: number; color?: string; sign?: string }) {
  return (
    <div className="flex-1 min-w-[120px]">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
      <p className="text-base font-semibold" style={color ? { color } : undefined}>{sign}{formatBRL(Math.abs(value))}</p>
    </div>
  )
}

// Fluxo de caixa do mês: o que veio do mês anterior + o que entrou - o que saiu - o que foi aplicado = saldo final.
// O saldo final de um mês é o "veio do mês anterior" do seguinte (o que não saiu vira caixa junto).
export function CashFlowPanel({ workspace, month, version }: { workspace: 'owl' | 'fdmc'; month: string; version: number }) {
  const [flow, setFlow] = useState<Flow | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [opening, setOpening] = useState('')
  const [startMonth, setStartMonth] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/financeiro/cash-flow?workspace=${workspace}&month=${month}`)
    const d = await res.json().catch(() => ({}))
    if (res.ok) { setFlow(d); setError('') } else setError(d.error ?? 'Erro ao carregar o fluxo de caixa')
  }, [workspace, month])

  useEffect(() => { load() }, [load, version])

  function startEdit() {
    setOpening(flow ? String(flow.openingBalance) : '0')
    setStartMonth(flow?.flowStartMonth ?? '')
    setEditing(true)
  }

  async function save() {
    setSaving(true)
    const res = await fetch('/api/financeiro/cash-flow', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace, opening_balance: parseFloat(opening.replace(',', '.')) || 0, flow_start_month: startMonth || null }),
    })
    setSaving(false)
    if (res.ok) { setEditing(false); load() }
  }

  if (error) return <p className="text-xs text-[#ef4444]">{error}</p>
  if (!flow) return null

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-medium">Fluxo de caixa do mês</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">O que sobra de um mês vira o caixa do mês seguinte. Conta só o que já foi pago ou recebido.</p>
        </div>
        <button onClick={startEdit} className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground border border-[#2a2a2a] rounded-lg px-2.5 py-1.5">
          <Settings2 size={12} /> Ponto de partida
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-x-3 gap-y-4">
        <Box label="Veio do mês anterior" value={flow.carryOver} color={flow.carryOver < 0 ? '#ef4444' : '#efefef'} />
        <span className="text-muted-foreground pb-1">+</span>
        <Box label="Entrou" value={flow.received} color="#22c55e" />
        <span className="text-muted-foreground pb-1">−</span>
        <Box label="Despesas" value={flow.spent} color="#ef4444" />
        <span className="text-muted-foreground pb-1">−</span>
        <Box label="Pró-labore" value={flow.prolabore} color="#efefef" />
        <span className="text-muted-foreground pb-1">−</span>
        <Box label="Aplicado" value={flow.invested} color="#e879f9" />
        <span className="text-muted-foreground pb-1">=</span>
        <div className="flex-1 min-w-[140px] rounded-lg border border-[#efefef]/30 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Saldo final do mês</p>
          <p className={`text-lg font-bold ${flow.final < 0 ? 'text-[#ef4444]' : ''}`}>{formatBRL(flow.final)}</p>
        </div>
      </div>

      {flow.investedTotal > 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <PiggyBank size={12} className="text-[#e879f9]" /> Total já aplicado: <span className="text-foreground font-medium">{formatBRL(flow.investedTotal)}</span>
        </p>
      )}

      {editing && (
        <div className="rounded-lg border border-[#2a2a2a] bg-[#111111] p-3 space-y-3">
          <p className="text-xs text-muted-foreground">Defina de onde a conta começa: o saldo que já existia e o primeiro mês que deve contar. Lançamentos de meses antes disso ficam de fora.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">Saldo inicial (R$)</label>
              <input type="number" step="0.01" value={opening} onChange={e => setOpening(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef]" />
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">Contar a partir de</label>
              <input type="month" value={startMonth} onChange={e => setStartMonth(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#efefef]" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 bg-[#efefef] text-[#111] text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-60">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Salvar
            </button>
            <button onClick={() => setEditing(false)} className="flex items-center gap-1 border border-[#2a2a2a] text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg"><X size={12} /> Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
