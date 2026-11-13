'use client'

import { formatBRL, formatDate } from '@/lib/utils/format'
import { addMonthsClamped, installmentAmounts, parseInstallments, MAX_INSTALLMENTS } from '@/lib/finance/installments'

// "Como é pago": à vista, parcelado em N vezes ou recorrente (todo mês). Evita fazer conta de mês na cabeça.

export interface PaymentState {
  mode: 'avista' | 'parcelado' | 'recorrente'
  installments: string          // em quantas vezes
  amountMode: 'parcela' | 'total' // o valor digitado é da parcela ou do total
  recurrenceMonths: string      // recorrente: por quantos meses (vazio = sem prazo)
}

export const EMPTY_PAYMENT: PaymentState = { mode: 'avista', installments: '', amountMode: 'parcela', recurrenceMonths: '' }

// O que o formulário manda pra API
export function paymentPayload(p: PaymentState, firstDate: string): { recurrent: boolean; recurrence_end_date: string; installments?: number; amount_mode?: string } | string {
  if (p.mode === 'avista') return { recurrent: false, recurrence_end_date: '' }
  if (p.mode === 'parcelado') {
    const n = parseInstallments(p.installments)
    if (!n) return `Informe em quantas vezes foi parcelado (de 2 a ${MAX_INSTALLMENTS}).`
    return { recurrent: false, recurrence_end_date: '', installments: n, amount_mode: p.amountMode }
  }
  const months = Number(p.recurrenceMonths)
  // "por N meses": a última parcela é a de mês N; a data de fim fica logo depois dela
  const end = Number.isInteger(months) && months >= 1 ? addMonthsClamped(firstDate, months) : ''
  return { recurrent: true, recurrence_end_date: end }
}

const MODES: { key: PaymentState['mode']; label: string }[] = [
  { key: 'avista', label: 'À vista' },
  { key: 'parcelado', label: 'Parcelado' },
  { key: 'recorrente', label: 'Recorrente' },
]

export function PaymentMode({ value, onChange, amount, firstDate, inputCls, allowInstallments = true }: {
  allowInstallments?: boolean
  value: PaymentState
  onChange: (v: PaymentState) => void
  amount: string
  firstDate: string
  inputCls: string
}) {
  const set = (patch: Partial<PaymentState>) => onChange({ ...value, ...patch })
  const n = parseInstallments(value.installments)
  const amountNum = Number(amount)
  const parts = n && amountNum > 0 ? installmentAmounts(amountNum, n, value.amountMode) : null
  const months = Number(value.recurrenceMonths)

  return (
    <div className="rounded-lg border border-[#2a2a2a] p-3 space-y-3">
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Como é pago?</p>
        <div className={`grid gap-1.5 ${allowInstallments ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {MODES.filter(m => allowInstallments || m.key !== 'parcelado').map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => set({ mode: m.key })}
              className={`text-xs font-medium py-2 rounded-lg border transition-colors ${value.mode === m.key ? 'bg-[#efefef] text-[#111111] border-[#efefef]' : 'border-[#2a2a2a] text-muted-foreground hover:text-foreground'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {value.mode === 'parcelado' && (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Em quantas vezes?</label>
              <input type="number" min={2} max={MAX_INSTALLMENTS} value={value.installments} placeholder="Ex: 8"
                onChange={e => set({ installments: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">O valor acima é...</label>
              <select value={value.amountMode} onChange={e => set({ amountMode: e.target.value as PaymentState['amountMode'] })} className={inputCls}>
                <option value="parcela">de cada parcela</option>
                <option value="total">do total</option>
              </select>
            </div>
          </div>
          {parts && (
            <p className="text-[11px] text-muted-foreground">
              {n}x de <span className="text-foreground font-medium">{formatBRL(parts[0])}</span>
              {value.amountMode === 'total' && parts[n! - 1] !== parts[0] ? ` (última ${formatBRL(parts[n! - 1])})` : ''}
              {' · '}total <span className="text-foreground font-medium">{formatBRL(parts.reduce((s, x) => s + x, 0))}</span>
              {firstDate ? <> · de {formatDate(firstDate)} até {formatDate(addMonthsClamped(firstDate, n! - 1))}</> : null}
            </p>
          )}
        </div>
      )}

      {value.mode === 'recorrente' && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Por quantos meses? (vazio = sem prazo)</label>
          <input type="number" min={1} value={value.recurrenceMonths} placeholder="Sem prazo"
            onChange={e => set({ recurrenceMonths: e.target.value })} className={inputCls} />
          <p className="text-[11px] text-muted-foreground mt-1">
            {Number.isInteger(months) && months >= 1 && firstDate
              ? <>Repete todo mês até {formatDate(addMonthsClamped(firstDate, months - 1))} ({months} {months === 1 ? 'vez' : 'vezes'}).</>
              : 'Repete todo mês, sem data para acabar.'}
          </p>
        </div>
      )}
    </div>
  )
}
