import { randomUUID } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { addMonthsClamped, installmentAmounts, parseInstallments } from '@/lib/finance/installments'

export const ASSET_CATEGORIES = ['video', 'foto', 'audio', 'informatica', 'outros'] as const
export const ASSET_CONDITIONS = ['novo', 'em_uso', 'manutencao', 'vendido', 'perdido'] as const
export const INACTIVE_CONDITIONS = ['vendido', 'perdido']

export interface AssetInput {
  name: string
  category: string
  brand_model: string | null
  serial_number: string | null
  purchase_date: string
  total_amount: number
  payment_method: 'avista' | 'parcelado'
  installments: number | null
  first_installment_date: string | null
  card: string | null
  holder: string | null
  condition: string
  invoice_url: string | null
  invoice_name: string | null
  notes: string | null
  paid_upfront?: boolean // à vista: já está pago (padrão: sim)
}

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const text = (v: unknown, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

// Valida o corpo da requisição. Devolve a mensagem de erro (texto) ou o bem pronto pra gravar.
export function parseAsset(body: Record<string, unknown>): AssetInput | string {
  const name = text(body.name, 200)
  if (!name) return 'Informe o nome do bem.'
  const category = String(body.category ?? 'outros')
  if (!(ASSET_CATEGORIES as readonly string[]).includes(category)) return 'Categoria inválida.'
  const condition = String(body.condition ?? 'novo')
  if (!(ASSET_CONDITIONS as readonly string[]).includes(condition)) return 'Estado inválido.'
  if (!isDate(body.purchase_date)) return 'Informe a data da compra.'
  const total = Number(body.total_amount)
  if (!(total > 0)) return 'Informe o valor total pago.'
  const payment_method = body.payment_method === 'parcelado' ? 'parcelado' : 'avista'
  let installments: number | null = null
  let first: string | null = null
  if (payment_method === 'parcelado') {
    installments = parseInstallments(body.installments)
    if (!installments) return 'Informe em quantas vezes foi parcelado (de 2 a 60).'
    if (!isDate(body.first_installment_date)) return 'Informe a data da 1ª parcela (vencimento da fatura).'
    first = body.first_installment_date
  }
  return {
    name, category, condition, payment_method, installments,
    brand_model: text(body.brand_model),
    serial_number: text(body.serial_number),
    purchase_date: body.purchase_date as string,
    total_amount: Math.round(total * 100) / 100,
    first_installment_date: first,
    card: text(body.card, 80),
    holder: text(body.holder, 120),
    invoice_url: text(body.invoice_url, 1000),
    invoice_name: text(body.invoice_name, 200),
    notes: text(body.notes, 2000),
    paid_upfront: body.paid_upfront !== false,
  }
}

// Lança no Financeiro, como Reinvestimento: à vista = 1 despesa; parcelado = N parcelas, uma por mês
export async function createAssetExpenses(assetId: string, a: AssetInput): Promise<string | null> {
  const db = createServiceClient()
  const notes = [a.card ? `Cartão: ${a.card}` : null, 'Patrimônio'].filter(Boolean).join(' · ')
  const base = { description: a.name, category: 'reinvestimento', recurrent: false, recurrence_end_date: null, notes, asset_id: assetId }
  let rows: Record<string, unknown>[]
  if (a.payment_method === 'parcelado' && a.installments && a.first_installment_date) {
    const group = randomUUID()
    rows = installmentAmounts(a.total_amount, a.installments, 'total').map((amount, i) => ({
      ...base, amount,
      due_date: addMonthsClamped(a.first_installment_date!, i),
      paid_at: null,
      recurrence_group: group,
      installment_number: i + 1,
      installments_total: a.installments,
    }))
  } else {
    rows = [{ ...base, amount: a.total_amount, due_date: a.purchase_date, paid_at: a.paid_upfront ? new Date(a.purchase_date + 'T12:00:00').toISOString() : null, recurrence_group: null }]
  }
  const { error } = await db.from('expenses').insert(rows)
  return error ? error.message : null
}
