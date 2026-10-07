'use client'

import { useState } from 'react'
import { Loader2, X, Check } from 'lucide-react'
import { addDays, daysInclusive, todayStr } from '@/lib/traffic/metrics'

// A Meta guarda ~37 meses de histórico; o calendário não deixa passar disso.
const MAX_LOOKBACK_DAYS = 1095

function buildPresets(today: string) {
  const [y, m] = today.split('-').map(Number)
  const firstThisMonth = `${y}-${String(m).padStart(2, '0')}-01`
  const lastPrevMonth = addDays(firstThisMonth, -1)
  const firstPrevMonth = `${lastPrevMonth.slice(0, 8)}01`
  return [
    { label: 'Últimos 7 dias', from: addDays(today, -6), to: today },
    { label: 'Últimos 30 dias', from: addDays(today, -29), to: today },
    { label: 'Últimos 90 dias', from: addDays(today, -89), to: today },
    { label: 'Este mês', from: firstThisMonth, to: today },
    { label: 'Mês passado', from: firstPrevMonth, to: lastPrevMonth },
    { label: 'Este ano', from: `${y}-01-01`, to: today },
    { label: 'Ano passado', from: `${y - 1}-01-01`, to: `${y - 1}-12-31` },
  ]
}

const dateInputCls =
  'w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#efefef] transition-colors [color-scheme:dark]'

// Painel "escolha o período": atalhos + dois calendários (De / Até).
export function PeriodPicker({ active, busy, error, onApply, onClose }: {
  active: { from: string; to: string } | null
  busy: boolean
  error: string
  onApply: (from: string, to: string) => void
  onClose: () => void
}) {
  const today = todayStr()
  const earliest = addDays(today, -MAX_LOOKBACK_DAYS)
  const presets = buildPresets(today)
  const [fromInput, setFromInput] = useState(active?.from ?? '')
  const [toInput, setToInput] = useState(active?.to ?? '')
  const [localError, setLocalError] = useState('')

  function apply(from: string, to: string) {
    if (!from || !to) return
    if (from > to) { setLocalError('A data inicial precisa ser antes da final.'); return }
    setLocalError('')
    onApply(from, to)
  }

  const inputDays = fromInput && toInput && fromInput <= toInput ? daysInclusive(fromInput, toInput) : null

  return (
    <div className="mt-3 rounded-2xl border border-[#232323] bg-[#141414] p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[#9ca3af]">Escolha o período que quer ver</p>
        <button onClick={onClose} aria-label="Fechar" className="text-[#7a7a7a] hover:text-white transition-colors">
          <X size={15} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {presets.map(p => {
          const isActive = active?.from === p.from && active?.to === p.to
          return (
            <button
              key={p.label}
              onClick={() => { setFromInput(p.from); setToInput(p.to); apply(p.from, p.to) }}
              disabled={busy}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                isActive
                  ? 'bg-[#efefef] text-[#111111] border-[#efefef]'
                  : 'text-[#d4d4d4] border-[#2a2a2a] hover:border-[#efefef]'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      <p className="text-[11px] text-[#7a7a7a] mb-2">Ou escolha as datas no calendário:</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] text-[#7a7a7a] mb-1">De</label>
          <input type="date" value={fromInput} min={earliest} max={today} onChange={e => setFromInput(e.target.value)} className={dateInputCls} />
        </div>
        <div>
          <label className="block text-[10px] text-[#7a7a7a] mb-1">Até</label>
          <input type="date" value={toInput} min={earliest} max={today} onChange={e => setToInput(e.target.value)} className={dateInputCls} />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <button
          onClick={() => apply(fromInput, toInput)}
          disabled={busy || !fromInput || !toInput}
          className="flex items-center gap-1.5 bg-[#efefef] hover:bg-[#d9d9d9] disabled:opacity-50 disabled:cursor-not-allowed text-[#111111] text-xs font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Ver período
        </button>
        {inputDays && <span className="text-[11px] text-[#7a7a7a]">{inputDays} {inputDays === 1 ? 'dia' : 'dias'} selecionados</span>}
        {(localError || error) && <span className="text-xs text-[#f87171]">{localError || error}</span>}
      </div>
    </div>
  )
}
