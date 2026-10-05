'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { TrafficDashboard } from '@/components/domain/traffic/TrafficDashboard'
import { monthTitle, monthLabelShort, type TrafficBundle } from '@/lib/traffic/metrics'

type Payload = TrafficBundle & { client: { id: string; name: string }; month: string }

export default function PublicTrafficPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<'invalid' | 'disabled' | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)

  const fetchMonth = useCallback(async (month?: string) => {
    const qs = new URLSearchParams({ token })
    if (month) qs.set('month', month)
    const res = await fetch(`/api/public/traffic?${qs.toString()}`).catch(() => null)
    if (!res || !res.ok) {
      setError(res?.status === 403 ? 'disabled' : 'invalid')
    } else {
      setData(await res.json())
      setError(null)
    }
    setLoading(false)
    setSwitching(false)
  }, [token])

  useEffect(() => { fetchMonth() }, [fetchMonth])

  function selectMonth(month: string) {
    if (!data || month === data.month) return
    setSwitching(true)
    fetchMonth(month)
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

  const updated = data.report?.updated_at
    ? new Date(data.report.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null
  const monthOptions = data.months.includes(data.month) ? data.months : [data.month, ...data.months]

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="max-w-4xl mx-auto px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <p className="text-[10px] tracking-[0.25em] text-[#efefef] uppercase font-semibold">Relatório de tráfego pago</p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-0.5">{data.client.name}</h1>
        <p className="text-sm text-[#9ca3af] mt-1">{monthTitle(data.month)}</p>

        {monthOptions.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto mt-4 pb-1" style={{ scrollbarWidth: 'none' }}>
            {monthOptions.map(m => (
              <button
                key={m}
                onClick={() => selectMonth(m)}
                className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors capitalize ${
                  m === data.month
                    ? 'bg-[#efefef] text-[#111111] border-[#efefef]'
                    : 'text-[#9ca3af] border-[#2a2a2a] hover:text-white'
                }`}
              >
                {monthLabelShort(m)}
              </button>
            ))}
          </div>
        )}

        <div className={`mt-5 transition-opacity ${switching ? 'opacity-50' : ''}`}>
          <TrafficDashboard key={data.month} report={data.report} previous={data.previous} history={data.history} month={data.month} />
        </div>

        <p className="mt-8 text-center text-[11px] text-[#5a5a5a]">
          Dados do Gerenciador de Anúncios da Meta{updated ? ` · atualizado em ${updated}` : ''} · OWL Creative Club
        </p>
      </div>
    </div>
  )
}
