'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, CalendarRange, X, Check } from 'lucide-react'
import { TrafficDashboard } from '@/components/domain/traffic/TrafficDashboard'
import {
  addDays, daysInclusive, fmtDayMonthYear, periodChip, periodLabel, periodStatus, todayStr,
  type TrafficBundle,
} from '@/lib/traffic/metrics'

type Payload = TrafficBundle & {
  client: { id: string; name: string }
  mode?: 'period' | 'custom'
  canCustom?: boolean
  days?: number
  granularity?: 'day' | 'month'
}

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

export default function PublicTrafficPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<'invalid' | 'disabled' | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)

  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [fromInput, setFromInput] = useState('')
  const [toInput, setToInput] = useState('')
  const [customError, setCustomError] = useState('')

  const today = todayStr()
  const earliest = addDays(today, -MAX_LOOKBACK_DAYS)

  const fetchPeriod = useCallback(async (start?: string) => {
    const qs = new URLSearchParams({ token })
    if (start) qs.set('start', start)
    const res = await fetch(`/api/public/traffic?${qs.toString()}`).catch(() => null)
    if (!res || !res.ok) {
      setError(res?.status === 403 ? 'disabled' : 'invalid')
    } else {
      setData(await res.json())
      setError(null)
      setCustom(null)
    }
    setLoading(false)
    setSwitching(false)
  }, [token])

  useEffect(() => { fetchPeriod() }, [fetchPeriod])

  function selectPeriod(start: string) {
    if (!data || (data.mode !== 'custom' && start === data.report?.period_start)) return
    setSwitching(true)
    setCustomError('')
    fetchPeriod(start)
  }

  async function applyCustom(from: string, to: string) {
    if (!from || !to || from > to) { setCustomError('A data inicial precisa ser antes da final.'); return }
    if (to > today) to = today
    if (from < earliest) from = earliest
    setSwitching(true)
    setCustomError('')
    const qs = new URLSearchParams({ token, from, to })
    const res = await fetch(`/api/public/traffic?${qs.toString()}`).catch(() => null)
    if (res?.ok) {
      setData(await res.json())
      setCustom({ from, to })
      setFromInput(from)
      setToInput(to)
      setPickerOpen(false)
    } else {
      const d = res ? await res.json().catch(() => ({})) : {}
      setCustomError(d.error ?? 'Não consegui buscar os números agora. Tente de novo.')
    }
    setSwitching(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d]">
        <Loader2 size={22} className="animate-spin text-[#efefef]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0d0d0d] text-center px-6">
        <p className="text-lg font-semibold text-white">{error === 'disabled' ? 'Relatório indisponível' : 'Link inválido'}</p>
        <p className="text-sm text-[#7a7a7a] mt-1">
          {error === 'disabled'
            ? 'O relatório de tráfego ainda não foi liberado. Fale com a equipe da OWL.'
            : 'Esse link não existe ou não é mais válido.'}
        </p>
      </div>
    )
  }

  const report = data.report
  const isCustom = data.mode === 'custom' && !!custom
  const canCustom = !!data.canCustom
  const presets = buildPresets(today)
  const updated = !isCustom && report?.updated_at
    ? new Date(report.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null
  const inputDays = fromInput && toInput && fromInput <= toInput ? daysInclusive(fromInput, toInput) : null

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="max-w-4xl mx-auto px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <p className="text-[10px] tracking-[0.25em] text-[#efefef] uppercase font-semibold">Relatório de tráfego pago</p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">{data.client.name}</h1>
        {report && <p className="text-sm text-[#9ca3af] mt-1">Período: {periodLabel(report.period_start, report.period_end)}</p>}

        {(data.periods.length > 0 || canCustom) && (
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wider text-[#5a5a5a] mb-1.5">Período</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {canCustom && (
                <button
                  onClick={() => setPickerOpen(o => !o)}
                  className={`shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    isCustom
                      ? 'bg-[#efefef] text-[#111111] border-[#efefef]'
                      : pickerOpen
                        ? 'text-white border-[#efefef]'
                        : 'text-white border-[#3a3a3a] hover:border-[#efefef]'
                  }`}
                >
                  <CalendarRange size={13} />
                  {isCustom && custom ? `${fmtDayMonthYear(custom.from)} – ${fmtDayMonthYear(custom.to)}` : 'Escolher período'}
                </button>
              )}
              {data.periods.map(p => {
                const active = !isCustom && p.start === report?.period_start
                const running = periodStatus(p.start, p.end) === 'running'
                return (
                  <button
                    key={p.start}
                    onClick={() => selectPeriod(p.start)}
                    className={`shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                      active
                        ? 'bg-[#efefef] text-[#111111] border-[#efefef]'
                        : 'text-[#9ca3af] border-[#2a2a2a] hover:text-white'
                    }`}
                  >
                    {running && <span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24]" />}
                    {periodChip(p.start, p.end)}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {pickerOpen && canCustom && (
          <div className="mt-3 rounded-2xl border border-[#232323] bg-[#141414] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium uppercase tracking-wider text-[#9ca3af]">Escolha o período que quer ver</p>
              <button onClick={() => setPickerOpen(false)} aria-label="Fechar" className="text-[#7a7a7a] hover:text-white transition-colors">
                <X size={15} />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {presets.map(p => {
                const active = isCustom && custom?.from === p.from && custom?.to === p.to
                return (
                  <button
                    key={p.label}
                    onClick={() => applyCustom(p.from, p.to)}
                    disabled={switching}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 ${
                      active
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
                <input
                  type="date"
                  value={fromInput}
                  min={earliest}
                  max={today}
                  onChange={e => setFromInput(e.target.value)}
                  className={dateInputCls}
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#7a7a7a] mb-1">Até</label>
                <input
                  type="date"
                  value={toInput}
                  min={earliest}
                  max={today}
                  onChange={e => setToInput(e.target.value)}
                  className={dateInputCls}
                />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button
                onClick={() => applyCustom(fromInput, toInput)}
                disabled={switching || !fromInput || !toInput}
                className="flex items-center gap-1.5 bg-[#efefef] hover:bg-[#d9d9d9] disabled:opacity-50 disabled:cursor-not-allowed text-[#111111] text-xs font-medium px-4 py-2 rounded-lg transition-colors"
              >
                {switching ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Ver período
              </button>
              {inputDays && <span className="text-[11px] text-[#7a7a7a]">{inputDays} {inputDays === 1 ? 'dia' : 'dias'} selecionados</span>}
              {customError && <span className="text-xs text-[#f87171]">{customError}</span>}
            </div>
          </div>
        )}

        <div className={`mt-5 transition-opacity ${switching ? 'opacity-50' : ''}`}>
          <TrafficDashboard
            key={isCustom && custom ? `custom-${custom.from}-${custom.to}` : report?.period_start ?? 'empty'}
            report={report}
            previous={data.previous}
            history={data.history}
            custom={isCustom && data.days && data.granularity ? { days: data.days, granularity: data.granularity } : null}
          />
        </div>

        <p className="mt-8 text-center text-[11px] text-[#5a5a5a]">
          Dados do Gerenciador de Anúncios da Meta{updated ? ` · atualizado em ${updated}` : ''} · OWL Creative Club
        </p>
      </div>
    </div>
  )
}
