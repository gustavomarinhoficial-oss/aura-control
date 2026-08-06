// Parser de linguagem natural em português para criar tarefas por voz

const WEEKDAYS: Record<string, number> = {
  domingo: 0, segunda: 1, 'segunda-feira': 1, terca: 2, terça: 2, 'terça-feira': 2,
  quarta: 3, 'quarta-feira': 3, quinta: 4, 'quinta-feira': 4,
  sexta: 5, 'sexta-feira': 5, sabado: 6, sábado: 6,
}

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
}

const FILLER = [
  // Verbos de comando (o que o usuário pediu para fazer)
  'marque', 'marcar', 'marca', 'agende', 'agendar', 'agenda',
  'crie', 'criar', 'cria', 'anote', 'anotar', 'anota',
  'adicione', 'adicionar', 'adiciona', 'coloque', 'colocar', 'coloca',
  'registre', 'registrar', 'registra', 'lembre', 'lembrar', 'lembra',
  'faça', 'fazer', 'faz', 'bote', 'botar', 'ponha', 'mande', 'mandar',
  'preciso', 'precisa', 'quero', 'queria', 'gostaria',
  'deixar', 'deixa', 'deixe',
  // Palavras de preenchimento
  'marcada', 'marcado', 'agendada', 'agendado',
  'uma', 'um', 'uns', 'umas', 'pra', 'pro', 'para',
  'o', 'a', 'os', 'as', 'de', 'do', 'da', 'dos', 'das',
  'no', 'na', 'nos', 'nas', 'ao', 'aos', 'às',
  'e', 'que', 'eu', 'me', 'se', 'tem', 'tenho',
  'vai', 'vai ter', 'vai ser', 'será', 'é', 'com', 'só',
  'lembrete', 'tarefa', 'evento',
]

export interface ParsedEvent {
  title: string
  due_date: string       // YYYY-MM-DD
  time: string | null    // HH:MM
  client_hint: string | null
}

function nextWeekday(target: number): Date {
  const today = new Date()
  const current = today.getDay()
  let diff = target - current
  if (diff <= 0) diff += 7
  const d = new Date(today)
  d.setDate(today.getDate() + diff)
  return d
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function parseVoiceInput(text: string, clientNames: string[] = []): ParsedEvent {
  const raw = text.toLowerCase().trim()
  let remaining = raw

  const today = new Date()
  let due: Date | null = null
  let time: string | null = null
  let clientHint: string | null = null

  // --- Detectar cliente mencionado (mantém o nome no texto para o título) ---
  for (const name of clientNames) {
    const first = name.split(' ')[0].toLowerCase()
    if (raw.includes(first.toLowerCase())) {
      clientHint = name
      break
    }
  }

  // --- Horário ---
  // "às 15h", "às 15:30", "às 15 horas", "3 da tarde", "9 da manhã", "meio dia"
  let m: RegExpMatchArray | null

  m = remaining.match(/\b(\d{1,2})[h:](\d{2})?\s*(horas?)?\b/)
  if (m) {
    const h = parseInt(m[1])
    const min = m[2] ? m[2] : '00'
    if (h >= 0 && h <= 23) { time = `${String(h).padStart(2, '0')}:${min}`; remaining = remaining.replace(m[0], '') }
  }

  if (!time) {
    m = remaining.match(/(\d{1,2})\s*da\s*(tarde|noite)/)
    if (m) {
      let h = parseInt(m[1])
      if (m[2] === 'tarde' || m[2] === 'noite') h = h < 12 ? h + 12 : h
      time = `${String(h).padStart(2, '0')}:00`
      remaining = remaining.replace(m[0], '')
    }
  }

  if (!time) {
    m = remaining.match(/(\d{1,2})\s*da\s*manhã/)
    if (m) {
      const h = parseInt(m[1])
      time = `${String(h < 12 ? h : h - 12).padStart(2, '0')}:00`
      remaining = remaining.replace(m[0], '')
    }
  }

  if (!time && remaining.includes('meio dia')) {
    time = '12:00'
    remaining = remaining.replace('meio dia', '')
  }

  // --- Data ---

  // "depois de amanhã"
  if (remaining.includes('depois de amanhã') || remaining.includes('depois de amanha')) {
    const d = new Date(today); d.setDate(today.getDate() + 2)
    due = d
    remaining = remaining.replace(/depois de amanhã?/g, '')
  }

  // "amanhã"
  else if (!due && (remaining.includes('amanhã') || remaining.includes('amanha'))) {
    const d = new Date(today); d.setDate(today.getDate() + 1)
    due = d
    remaining = remaining.replace(/amanhã?/g, '')
  }

  // "hoje"
  else if (!due && remaining.includes('hoje')) {
    due = new Date(today)
    remaining = remaining.replace('hoje', '')
  }

  // "semana que vem"
  else if (!due && remaining.match(/semana\s+que\s+vem/)) {
    const d = new Date(today); d.setDate(today.getDate() + 7)
    due = d
    remaining = remaining.replace(/semana\s+que\s+vem/, '')
  }

  // "mês que vem"
  else if (!due && remaining.match(/m[eê]s\s+que\s+vem/)) {
    const d = new Date(today); d.setMonth(today.getMonth() + 1)
    due = d
    remaining = remaining.replace(/m[eê]s\s+que\s+vem/, '')
  }

  // "próxima segunda", "próximo sábado"
  if (!due) {
    m = remaining.match(/pr[oó]xim[ao]\s+(\w+)/)
    if (m) {
      const wd = WEEKDAYS[m[1].toLowerCase()]
      if (wd !== undefined) { due = nextWeekday(wd); remaining = remaining.replace(m[0], '') }
    }
  }

  // "dia 16 de agosto", "dia 16/08", "16/08"
  if (!due) {
    m = remaining.match(/\bdia\s+(\d{1,2})\s+de\s+(\w+)/)
    if (m) {
      const mo = MONTHS[m[2].toLowerCase()]
      if (mo) {
        const d = new Date(today.getFullYear(), mo - 1, parseInt(m[1]))
        if (d < today) d.setFullYear(today.getFullYear() + 1)
        due = d; remaining = remaining.replace(m[0], '')
      }
    }
  }

  if (!due) {
    m = remaining.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
    if (m) {
      const year = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3])) : today.getFullYear()
      due = new Date(year, parseInt(m[2]) - 1, parseInt(m[1]))
      remaining = remaining.replace(m[0], '')
    }
  }

  // "dia 16"
  if (!due) {
    m = remaining.match(/\bdia\s+(\d{1,2})\b/)
    if (m) {
      const day = parseInt(m[1])
      const candidate = new Date(today.getFullYear(), today.getMonth(), day)
      if (candidate < today) candidate.setMonth(today.getMonth() + 1)
      due = candidate; remaining = remaining.replace(m[0], '')
    }
  }

  // Dia da semana avulso ("sexta", "segunda")
  if (!due) {
    for (const [name, wd] of Object.entries(WEEKDAYS)) {
      if (remaining.includes(name)) {
        due = nextWeekday(wd)
        remaining = remaining.replace(name, '')
        break
      }
    }
  }

  // Fallback: hoje
  if (!due) due = new Date(today)

  // --- Título: remover palavras de preenchimento e limpar ---
  let title = remaining
  for (const f of FILLER) {
    title = title.replace(new RegExp(`\\b${f}\\b`, 'gi'), '')
  }
  // remove horário textual residual
  title = title.replace(/\b\d{1,2}\s*h\b/gi, '').replace(/\bhoras?\b/gi, '').replace(/\bminutos?\b/gi, '')
  // remove pontuação e espaços extras
  title = title.replace(/[^\w\sáéíóúàâêôãõçÁÉÍÓÚÀÂÊÔÃÕÇ]/g, ' ').replace(/\s{2,}/g, ' ').trim()

  // Capitalizar
  if (title.length > 0) title = title.charAt(0).toUpperCase() + title.slice(1)
  if (!title) title = 'Nova tarefa'

  return {
    title,
    due_date: toDateStr(due),
    time,
    client_hint: clientHint,
  }
}
