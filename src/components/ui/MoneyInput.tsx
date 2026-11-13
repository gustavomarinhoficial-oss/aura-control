'use client'

import { useState } from 'react'

// Campo de valor em reais: você digita 386 e ao sair do campo vira 386,00 (e 1234,5 vira 1.234,50).
// O valor que sobe pro formulário é sempre um número em texto ("386.00"), pronto pra Number().

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// "1.234,56" | "1234,56" | "1234.56" | "386" -> 1234.56 | 386
export function parseMoney(text: string): number | null {
  const t = text.replace(/[^\d.,-]/g, '')
  if (!/\d/.test(t)) return null
  let normalized: string
  if (t.includes(',')) normalized = t.replace(/\./g, '').replace(',', '.')
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) normalized = t.replace(/\./g, '') // 1.234 / 12.345.678 = milhar
  else normalized = t // 82.13 = decimal
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

function show(value: string): string {
  if (value === '' || value == null) return ''
  const n = Number(value)
  return Number.isFinite(n) ? fmt(n) : ''
}

interface Props extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string
  onValueChange: (value: string) => void
}

export function MoneyInput({ value, onValueChange, className = '', placeholder = '0,00', onBlur, onFocus, ...rest }: Props) {
  // Digitando: mostra o texto cru. Fora do campo: sempre o valor formatado (386,00).
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={focused ? text : show(value)}
        onFocus={e => { setFocused(true); setText(value ? String(value).replace('.', ',') : ''); onFocus?.(e) }}
        onChange={e => {
          const raw = e.target.value.replace(/[^\d.,]/g, '')
          setText(raw)
          const n = parseMoney(raw)
          const out = raw === '' || n === null ? '' : String(Math.round(n * 100) / 100)
          onValueChange(out)
        }}
        onBlur={e => {
          setFocused(false)
          onBlur?.(e)
        }}
        className={`${className} pl-9`}
      />
    </div>
  )
}
