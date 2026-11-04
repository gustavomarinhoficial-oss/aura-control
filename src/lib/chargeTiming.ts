// Atraso de pagamento: sempre contra o vencimento OFICIAL (o do painel do cliente),
// mesmo que a data daquele mês tenha sido reagendada.

const brDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

const diffDays = (a: string, b: string) =>
  Math.round((new Date(a + 'T12:00:00Z').getTime() - new Date(b + 'T12:00:00Z').getTime()) / 86400000)

export const paidDay = (paidAt: string) => brDate(paidAt)

export const officialDue = (c: { due_date: string; original_due_date?: string | null }) => c.original_due_date ?? c.due_date

// Dias de atraso (positivo), no prazo (0) ou adiantado (negativo). null = ainda não pago.
export function paymentDelay(c: { due_date: string; original_due_date?: string | null; paid_at: string | null }): number | null {
  return c.paid_at ? diffDays(paidDay(c.paid_at), officialDue(c)) : null
}

export function delayLabel(days: number): string {
  if (days > 0) return `${days} dia${days === 1 ? '' : 's'} de atraso`
  if (days < 0) return `${Math.abs(days)} dia${days === -1 ? '' : 's'} adiantado`
  return 'no prazo'
}

export const delayColor = (days: number) => (days > 0 ? '#ef4444' : '#22c55e')

export { diffDays }
