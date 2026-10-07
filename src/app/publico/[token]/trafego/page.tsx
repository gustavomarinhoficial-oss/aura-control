'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, CalendarRange } from 'lucide-react'
import { TrafficDashboard } from '@/components/domain/traffic/TrafficDashboard'
import { PeriodPicker } from '@/components/domain/traffic/PeriodPicker'
import {
  addDays, fmtDayMonthYear, periodChip, periodLabel, periodStatus, todayStr,
  type TrafficBundle,
} from '@/lib/traffic/metrics'

type Payload = TrafficBundle & {
  client: { id: string; name: string }
  mode?: 'period' | 'custom'
  canCustom?: boolean
  days?: number
  granularity?: 'day' | 'month'
}

export default function PublicTrafficPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<'invalid' | 'disabled' | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)

  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [customError, setCustomError] = useState('')

  const today = todayStr()
  const earliest = addDays(today, -1095)

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
  const updated = !isCustom && report?.updated_at
    ? new Date(report.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null

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
          <PeriodPicker
            active={isCustom ? custom : null}
            busy={switching}
            error={customError}
            onApply={applyCustom}
            onClose={() => setPickerOpen(false)}
          />
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
