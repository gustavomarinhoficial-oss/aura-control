'use client'

import { useEffect, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { ArrowUpRight, ArrowDownRight, Minus, Eye, Users, MousePointerClick, Wallet, Target, BarChart3, Quote, Megaphone, Percent } from 'lucide-react'
import {
  computeMetrics, pctChange, monthLabel, monthLabelShort, fmtInt, fmtBRL, fmtDec, fmtDayMonth, TRAFFIC_COLORS,
  type TrafficReport,
} from '@/lib/traffic/metrics'

function useCountUp(target: number, duration = 1000) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dur = reduced ? 0 : duration
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = dur === 0 ? 1 : Math.min(1, (now - start) / dur)
      setValue(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value
}

function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const v = useCountUp(value)
  return <>{format(v)}</>
}

function Delta({ cur, prev, good, compact }: { cur: number | null; prev: number | null; good: 'up' | 'down' | 'neutral'; compact?: boolean }) {
  const change = pctChange(cur, prev)
  if (change === null) return null
  const flat = Math.abs(change) < 0.05
  const up = change > 0
  const positive = good === 'neutral' ? null : good === 'up' ? up : !up
  const color = flat || positive === null ? '#9ca3af' : positive ? '#34d399' : '#f87171'
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ color, backgroundColor: color + '1f' }}>
      <Icon size={11} />
      {fmtDec(Math.abs(change))}%
      <span className={`opacity-70 font-normal ml-0.5 ${compact ? 'hidden sm:inline' : ''}`}>vs mês anterior</span>
    </span>
  )
}

function BigCard({ icon: Icon, color, label, hint, value, format, delta }: {
  icon: React.ElementType; color: string; label: string; hint: string
  value: number; format: (n: number) => string; delta: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#232323] bg-[#141414] p-5">
      <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-3xl opacity-25" style={{ backgroundColor: color }} />
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: color + '22', color }}>
          <Icon size={15} />
        </span>
        <p className="text-xs font-medium uppercase tracking-wider text-[#9ca3af]">{label}</p>
      </div>
      <p className="text-3xl sm:text-4xl font-bold tracking-tight tabular-nums" style={{ color }}>
        <AnimatedNumber value={value} format={format} />
      </p>
      <p className="mt-1.5 text-xs text-[#7a7a7a] leading-snug">{hint}</p>
      <div className="mt-3 min-h-[22px]">{delta}</div>
    </div>
  )
}

function SmallCard({ icon: Icon, color, label, hint, value, format, delta, sub }: {
  icon: React.ElementType; color: string; label: string; hint: string
  value: number | null; format: (n: number) => string; delta: React.ReactNode; sub?: string
}) {
  return (
    <div className="rounded-2xl border border-[#232323] bg-[#141414] p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} style={{ color }} />
        <p className="text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">{label}</p>
      </div>
      <p className="text-2xl font-bold tracking-tight tabular-nums text-white">
        {value === null ? '—' : <AnimatedNumber value={value} format={format} />}
      </p>
      {sub && <p className="text-[11px] font-medium mt-0.5" style={{ color }}>{sub}</p>}
      <p className="mt-1 text-[11px] text-[#7a7a7a] leading-snug">{hint}</p>
      <div className="mt-2 min-h-[22px]">{delta}</div>
    </div>
  )
}

function Funnel({ r }: { r: TrafficReport }) {
  const m = computeMetrics(r)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const steps = [
    { label: 'Impressões', value: r.impressions, color: TRAFFIC_COLORS.impressions, note: 'vezes que o anúncio apareceu na tela das pessoas' },
    { label: 'Pessoas alcançadas', value: r.reach, color: TRAFFIC_COLORS.reach, note: m.frequency ? `cada pessoa viu o anúncio em média ${fmtDec(m.frequency)}x` : '' },
    { label: 'Cliques no link', value: r.link_clicks, color: TRAFFIC_COLORS.clicks, note: m.ctr !== null ? `${fmtDec(m.ctr, 2)}% de quem viu o anúncio clicou (CTR)` : '' },
    {
      label: r.result_label || 'Resultados', value: r.results, color: TRAFFIC_COLORS.results,
      note: r.link_clicks > 0 && r.results > 0 && r.results <= r.link_clicks ? `${fmtDec((r.results / r.link_clicks) * 100)}% dos cliques viraram resultado` : '',
    },
  ].filter(s => s.value > 0)

  if (steps.length < 2) return null
  const n = steps.length
  return (
    <div className="rounded-2xl border border-[#232323] bg-[#141414] p-5">
      <div className="flex items-center gap-2 mb-1">
        <BarChart3 size={14} className="text-[#9ca3af]" />
        <h3 className="text-xs font-medium uppercase tracking-wider text-[#9ca3af]">Do anúncio ao resultado</h3>
      </div>
      <p className="text-xs text-[#7a7a7a] mb-5">O caminho que as pessoas percorreram, da primeira vez que viram a campanha até agir.</p>
      <div className="space-y-2.5">
        {steps.map((s, i) => {
          const width = 100 - (i * 56) / Math.max(1, n - 1)
          return (
            <div key={s.label}>
              <div
                className="mx-auto flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-all duration-700 ease-out"
                style={{
                  width: mounted ? `${width}%` : '0%',
                  minWidth: mounted ? '220px' : 0,
                  maxWidth: '100%',
                  background: `linear-gradient(90deg, ${s.color}cc, ${s.color}66)`,
                  transitionDelay: `${i * 120}ms`,
                  overflow: 'hidden',
                }}
              >
                <span className="text-xs sm:text-sm font-medium text-white truncate">{s.label}</span>
                <span className="text-sm sm:text-base font-bold text-white tabular-nums whitespace-nowrap">{fmtInt(s.value)}</span>
              </div>
              {s.note && <p className="mt-1 text-center text-[11px] text-[#7a7a7a]">{s.note}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const TREND_METRICS = [
  { key: 'reach', label: 'Alcance', color: TRAFFIC_COLORS.reach, get: (r: TrafficReport) => Number(r.reach), fmt: fmtInt },
  { key: 'impressions', label: 'Impressões', color: TRAFFIC_COLORS.impressions, get: (r: TrafficReport) => Number(r.impressions), fmt: fmtInt },
  { key: 'clicks', label: 'Cliques no link', color: TRAFFIC_COLORS.clicks, get: (r: TrafficReport) => Number(r.link_clicks), fmt: fmtInt },
  { key: 'spend', label: 'Investimento', color: TRAFFIC_COLORS.spend, get: (r: TrafficReport) => Number(r.spend), fmt: fmtBRL },
  { key: 'cpc', label: 'Custo por clique', color: '#fb923c', get: (r: TrafficReport) => computeMetrics(r).cpcLink ?? 0, fmt: fmtBRL },
]

function Trend({ history }: { history: TrafficReport[] }) {
  const [key, setKey] = useState('reach')
  const metric = TREND_METRICS.find(m => m.key === key) ?? TREND_METRICS[0]
  const data = history.map(r => ({ month: monthLabelShort(r.month), value: metric.get(r) }))

  return (
    <div className="rounded-2xl border border-[#232323] bg-[#141414] p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wider text-[#9ca3af]">Evolução mês a mês</h3>
          <p className="text-xs text-[#7a7a7a] mt-1">Passe o dedo ou o mouse sobre o gráfico pra ver o valor de cada mês.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TREND_METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setKey(m.key)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors"
              style={key === m.key
                ? { color: m.color, borderColor: m.color + '66', backgroundColor: m.color + '1a' }
                : { color: '#9ca3af', borderColor: '#2a2a2a' }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {history.length < 2 ? (
        <div className="flex h-40 items-center justify-center text-center text-xs text-[#7a7a7a] px-6">
          A evolução aparece a partir do segundo mês de campanha.
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={metric.color} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={metric.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1f1f1f" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#7a7a7a', fontSize: 11 }} axisLine={false} tickLine={false} interval={0} padding={{ left: 20, right: 20 }} />
              <YAxis hide domain={[0, (max: number) => max * 1.15]} />
              <Tooltip
                cursor={{ stroke: '#333' }}
                contentStyle={{ background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#fff' }}
                formatter={(v) => [metric.fmt(Number(v)), metric.label] as [string, string]}
              />
              <Area type="monotone" dataKey="value" stroke={metric.color} strokeWidth={2.5} fill={`url(#grad-${metric.key})`} dot={{ r: 3, fill: metric.color, strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

const CAMPAIGN_METRICS = [
  { key: 'spend', label: 'Investimento', color: TRAFFIC_COLORS.spend, fmt: fmtBRL },
  { key: 'link_clicks', label: 'Cliques no link', color: TRAFFIC_COLORS.clicks, fmt: fmtInt },
  { key: 'results', label: 'Resultados', color: TRAFFIC_COLORS.results, fmt: fmtInt },
  { key: 'reach', label: 'Alcance', color: TRAFFIC_COLORS.reach, fmt: fmtInt },
] as const

function Campaigns({ r }: { r: TrafficReport }) {
  const [pick, setPick] = useState<(typeof CAMPAIGN_METRICS)[number]['key']>('link_clicks')
  const options = CAMPAIGN_METRICS.filter(m => r.campaigns.some(c => c[m.key] > 0))
  const metric = options.find(m => m.key === pick) ?? options[0] ?? CAMPAIGN_METRICS[0]
  const key = metric.key
  const rows = [...r.campaigns].sort((a, b) => b[key] - a[key])
  const max = Math.max(1, ...rows.map(c => c[key]))

  return (
    <div className="rounded-2xl border border-[#232323] bg-[#141414] p-5">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Megaphone size={14} className="text-[#9ca3af]" />
          <h3 className="text-xs font-medium uppercase tracking-wider text-[#9ca3af]">Campanhas do mês</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {options.map(m => (
            <button
              key={m.key}
              onClick={() => setPick(m.key)}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors"
              style={key === m.key
                ? { color: m.color, borderColor: m.color + '66', backgroundColor: m.color + '1a' }
                : { color: '#9ca3af', borderColor: '#2a2a2a' }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3.5">
        {rows.map((c, i) => {
          const cm = computeMetrics(c)
          const ended = !!c.end_date
          return (
            <div key={`${c.id ?? c.name}-${i}`}>
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.name}</p>
                  {(c.start_date || ended) && (
                    <span
                      className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={ended ? { color: '#fbbf24', backgroundColor: '#fbbf241f' } : { color: '#34d399', backgroundColor: '#34d3991f' }}
                    >
                      {ended ? 'Encerrada' : 'No ar'}
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold tabular-nums whitespace-nowrap" style={{ color: metric.color }}>{metric.fmt(c[key])}</p>
              </div>
              <div className="h-2 rounded-full bg-[#1f1f1f] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(c[key] / max) * 100}%`, backgroundColor: metric.color }} />
              </div>
              {(c.start_date || c.end_date) && (
                <p className="mt-1 text-[11px] text-[#9ca3af]">
                  {c.start_date && c.end_date ? `Rodou de ${fmtDayMonth(c.start_date)} a ${fmtDayMonth(c.end_date)}`
                    : c.start_date ? `No ar desde ${fmtDayMonth(c.start_date)}`
                    : `Encerrada em ${fmtDayMonth(c.end_date as string)}`}
                </p>
              )}
              <p className="mt-1 text-[11px] text-[#7a7a7a]">
                {fmtBRL(c.spend)} investidos
                {cm.cpcLink !== null && ` · ${fmtBRL(cm.cpcLink)} por clique`}
                {cm.costPerResult !== null && c.results > 0 && ` · ${fmtBRL(cm.costPerResult)} por resultado`}
              </p>
              {c.note && <p className="mt-1 text-[11px] italic text-[#7a7a7a]">{c.note}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function TrafficDashboard({ report, previous, history, month }: {
  report: TrafficReport | null
  previous: TrafficReport | null
  history: TrafficReport[]
  month: string
}) {
  if (!report) {
    return (
      <div className="rounded-2xl border border-dashed border-[#2a2a2a] bg-[#141414] px-6 py-14 text-center">
        <BarChart3 size={28} className="mx-auto mb-3 text-[#4b4b4b]" strokeWidth={1.2} />
        <p className="text-sm font-medium text-white">Ainda não há números de {monthLabel(month)}</p>
        <p className="mt-1 text-xs text-[#7a7a7a]">Assim que o mês for atualizado, o relatório aparece aqui.</p>
      </div>
    )
  }

  const m = computeMetrics(report)
  const pm = previous ? computeMetrics(previous) : null
  const label = report.result_label || 'Resultados'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <BigCard
          icon={Users} color={TRAFFIC_COLORS.reach} label="Pessoas alcançadas"
          hint="Pessoas diferentes que viram o seu anúncio."
          value={report.reach} format={fmtInt}
          delta={<Delta cur={report.reach} prev={previous?.reach ?? null} good="up" />}
        />
        <BigCard
          icon={Eye} color={TRAFFIC_COLORS.impressions} label="Impressões"
          hint="Quantas vezes o anúncio foi exibido na tela."
          value={report.impressions} format={fmtInt}
          delta={<Delta cur={report.impressions} prev={previous?.impressions ?? null} good="up" />}
        />
        <BigCard
          icon={MousePointerClick} color={TRAFFIC_COLORS.clicks} label="Cliques no link"
          hint="Pessoas que clicaram pra conhecer mais."
          value={report.link_clicks} format={fmtInt}
          delta={<Delta cur={report.link_clicks} prev={previous?.link_clicks ?? null} good="up" />}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SmallCard
          icon={Wallet} color={TRAFFIC_COLORS.spend} label="Valor investido"
          hint="Total aplicado na campanha no mês."
          value={report.spend} format={fmtBRL}
          delta={<Delta cur={report.spend} prev={previous?.spend ?? null} good="neutral" compact />}
        />
        <SmallCard
          icon={MousePointerClick} color={TRAFFIC_COLORS.clicks} label="Custo por clique"
          hint="Quanto custou, em média, cada clique no link."
          value={m.cpcLink} format={fmtBRL}
          delta={<Delta cur={m.cpcLink} prev={pm?.cpcLink ?? null} good="down" compact />}
        />
        <SmallCard
          icon={Eye} color={TRAFFIC_COLORS.impressions} label="CPM"
          hint="Custo para mostrar o anúncio 1.000 vezes."
          value={m.cpm} format={fmtBRL}
          delta={<Delta cur={m.cpm} prev={pm?.cpm ?? null} good="down" compact />}
        />
        {report.results > 0 ? (
          <SmallCard
            icon={Target} color={TRAFFIC_COLORS.results} label="Custo por resultado"
            sub={`${fmtInt(report.results)} ${label.toLowerCase()}`}
            hint="Quanto custou, em média, cada resultado conquistado."
            value={m.costPerResult} format={fmtBRL}
            delta={<Delta cur={m.costPerResult} prev={pm?.costPerResult ?? null} good="down" compact />}
          />
        ) : (
          <SmallCard
            icon={Percent} color={TRAFFIC_COLORS.clicks} label="Taxa de cliques"
            hint="De cada 100 vezes que o anúncio apareceu, quantas viraram clique."
            value={m.ctr} format={n => `${fmtDec(n, 2)}%`}
            delta={<Delta cur={m.ctr} prev={pm?.ctr ?? null} good="up" compact />}
          />
        )}
      </div>

      <Funnel r={report} />
      <Trend history={history} />
      {report.campaigns.length > 0 && <Campaigns r={report} />}

      {report.analysis && (
        <div className="relative rounded-2xl border border-[#232323] bg-gradient-to-br from-[#161616] to-[#121212] p-5">
          <Quote size={18} className="mb-2 text-[#4b4b4b]" />
          <h3 className="text-xs font-medium uppercase tracking-wider text-[#9ca3af] mb-2">Análise do mês</h3>
          <p className="text-sm leading-relaxed text-[#d4d4d4] whitespace-pre-line">{report.analysis}</p>
        </div>
      )}
    </div>
  )
}
