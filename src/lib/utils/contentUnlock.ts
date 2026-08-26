// Controla, mês a mês, o que o cliente pode ver no link público do calendário
// de conteúdo. O mês atual sempre aparece; o mês seguinte libera sozinho
// faltando poucos dias pra acabar o mês, ou antes disso se alguém liberar
// manualmente pelo botão na Central de Conteúdo.

const AUTO_UNLOCK_DAYS_BEFORE_END = 3

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function monthStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function nextMonthStr(d = new Date()): string {
  return monthStr(new Date(d.getFullYear(), d.getMonth() + 1, 1))
}

// Mês liberado automaticamente pela data de hoje, sem depender de nenhum ajuste manual
export function autoUnlockedMonth(d = new Date()): string {
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  const daysLeft = lastDay - d.getDate()
  return daysLeft <= AUTO_UNLOCK_DAYS_BEFORE_END ? nextMonthStr(d) : monthStr(d)
}

// Combina o automático com uma liberação manual (o que for mais permissivo vence)
export function effectiveUnlockedMonth(manualOverride: string | null | undefined, d = new Date()): string {
  const auto = autoUnlockedMonth(d)
  if (manualOverride && manualOverride > auto) return manualOverride
  return auto
}
