import { ClipboardList } from 'lucide-react'
import { formatBRL } from '@/lib/utils/format'

// Fechamento do mês: custo da operação e reinvestimento separados, e quanto sobra.
// "Realizado" = só o que já foi recebido/pago. "Previsto" = o mês inteiro, contando o que ainda vai cair.
// Aplicação/aporte não entra: não é despesa, é dinheiro guardado.

interface Item { amount: number; paid: boolean; reinvest: boolean }

export function MonthClosing({ monthName, revenue, items }: { monthName: string; revenue: { real: number; prev: number }; items: Item[] }) {
  const sum = (list: Item[]) => list.reduce((s, i) => s + i.amount, 0)
  const op = items.filter(i => !i.reinvest)
  const re = items.filter(i => i.reinvest)
  const col = (onlyPaid: boolean) => {
    const pick = (l: Item[]) => sum(onlyPaid ? l.filter(i => i.paid) : l)
    const custo = pick(op)
    const reinvest = pick(re)
    const receitas = onlyPaid ? revenue.real : revenue.prev
    return { receitas, custo, reinvest, total: custo + reinvest, sobra: receitas - custo - reinvest }
  }
  const real = col(true)
  const prev = col(false)

  const rows: { label: string; hint?: string; key: keyof typeof real; color?: string; strong?: boolean }[] = [
    { label: 'Receitas', key: 'receitas', color: '#22c55e' },
    { label: 'Custo operacional', hint: 'equipe, pró-labore, fixos e variáveis', key: 'custo' },
    { label: 'Reinvestimento', hint: 'equipamentos, materiais e melhorias', key: 'reinvest', color: '#38bdf8' },
    { label: 'Total de despesas', key: 'total', strong: true },
    { label: 'Sobra do mês', hint: 'receitas − total de despesas', key: 'sobra', strong: true },
  ]

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList size={14} className="text-[#efefef]" />
        <h2 className="text-sm font-medium">Fechamento de {monthName}</h2>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 sm:gap-x-8 gap-y-2.5 items-baseline text-sm">
        <span />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Realizado</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground text-right">Previsto</span>
        {rows.map(r => {
          const isSobra = r.key === 'sobra'
          const color = (v: number) => (isSobra ? (v < 0 ? '#ef4444' : '#efefef') : r.color)
          return (
            <div key={r.key} className={`contents ${r.strong ? 'font-semibold' : ''}`}>
              <div className={r.strong ? 'pt-2 border-t border-[#2a2a2a]' : ''}>
                <p>{r.label}</p>
                {r.hint && <p className="text-[10px] text-muted-foreground font-normal">{r.hint}</p>}
              </div>
              <span className={`text-right ${r.strong ? 'pt-2 border-t border-[#2a2a2a]' : ''}`} style={{ color: color(real[r.key]) }}>{formatBRL(real[r.key])}</span>
              <span className={`text-right text-muted-foreground ${r.strong ? 'pt-2 border-t border-[#2a2a2a]' : ''}`} style={isSobra ? { color: color(prev[r.key]) } : undefined}>{formatBRL(prev[r.key])}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
