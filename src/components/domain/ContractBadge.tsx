import { Clock } from 'lucide-react'
import { contractInfo, contractLabel, CONTRACT_COLOR } from '@/lib/contracts'

// Selo do fim de contrato. Só aparece quando há algo a dizer (sem data, não mostra nada).
export function ContractBadge({ end, always = false }: { end: string | null; always?: boolean }) {
  const info = contractInfo(end)
  if (info.level === 'none' || (info.level === 'ok' && !always)) return null
  const color = CONTRACT_COLOR[info.level]
  const strong = info.level === 'ended' || info.level === 'last_month'
  return (
    <span
      style={{ color, backgroundColor: color + (strong ? '22' : '1a'), borderColor: color + '55' }}
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap"
    >
      <Clock size={9} /> {contractLabel(info)}
    </span>
  )
}
