// Parcelamento: N parcelas mensais. Datas sempre no mesmo dia do mês (ou o último dia, em meses mais curtos).

export const MAX_INSTALLMENTS = 60

export function addMonthsClamped(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const total = (m - 1) + n
  const year = y + Math.floor(total / 12)
  const month = ((total % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(d, lastDay)).padStart(2, '0')}`
}

// mode "parcela": o valor informado é de cada parcela. mode "total": divide o total (a última parcela absorve os centavos).
export function installmentAmounts(value: number, count: number, mode: 'parcela' | 'total'): number[] {
  const cents = Math.round(value * 100)
  if (mode === 'parcela') return Array.from({ length: count }, () => cents / 100)
  const base = Math.floor(cents / count)
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? cents - base * (count - 1) : base) / 100)
}

export function parseInstallments(v: unknown): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n >= 2 && n <= MAX_INSTALLMENTS ? n : null
}
