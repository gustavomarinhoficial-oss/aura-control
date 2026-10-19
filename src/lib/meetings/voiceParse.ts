// Regras determinísticas do ditado de reunião: o modelo só diz O QUE foi falado,
// e aqui o código resolve data, horário, cliente e título (evita erro de conta do modelo).

export const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

// Chave "de som": o Whisper escreve nomes de marca como ouve ("Imove" em vez de "iMoowe").
// Tira letras mudas/duplicadas e junta sons parecidos pra comparar pelo som, não pela grafia.
function soundKey(s: string): string {
  return norm(s)
    .replace(/\s+/g, '')
    .replace(/w/g, 'u')
    .replace(/ph/g, 'f')
    .replace(/[ck]/g, 'k')
    .replace(/qu/g, 'k')
    .replace(/y/g, 'i')
    .replace(/h/g, '')
    .replace(/(.)\1+/g, '$1')
    .replace(/[aeiou]+/g, 'a') // sequências de vogais viram uma só
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

const similarity = (a: string, b: string) => (a || b ? 1 - levenshtein(a, b) / Math.max(a.length, b.length) : 0)

// Acha o item da lista que a pessoa citou: nome exato/parcial, ou parecido pelo som.
// `hints` = trechos da fala que podem conter o nome (ex.: a frase inteira).
export function matchByName<T extends { id: string }>(list: T[], getName: (x: T) => string, said: string | null | undefined, hints: string[] = []): T | null {
  const candidates = [said, ...hints].filter((x): x is string => !!x && !!norm(x))
  if (candidates.length === 0) return null

  let best: { x: T; score: number } | null = null
  const consider = (x: T, score: number) => { if (!best || score > best.score) best = { x, score } }

  for (const c of candidates) {
    const q = norm(c)
    for (const x of list) {
      const n = norm(getName(x))
      if (!n) continue
      if (n === q) consider(x, 3)
      else if (q.includes(n) || (q.length >= 3 && n.includes(q))) consider(x, 2.5)
      else {
        const words = q.split(' ').filter(w => w.length > 2)
        if (words.length && words.every(w => n.includes(w))) consider(x, 2)
      }
    }
  }
  if (best && (best as { score: number }).score >= 2) return (best as { x: T }).x

  // Parecido pelo som: compara a citação (e cada palavra/par de palavras da frase) com o nome
  const grams = new Set<string>()
  for (const c of candidates) {
    const w = norm(c).split(' ').filter(Boolean)
    for (let i = 0; i < w.length; i++) {
      grams.add(w[i])
      if (i + 1 < w.length) grams.add(`${w[i]} ${w[i + 1]}`)
    }
  }
  let phon: { x: T; score: number } | null = null
  for (const x of list) {
    const nk = soundKey(getName(x))
    if (nk.length < 3) continue
    for (const g of grams) {
      const gk = soundKey(g)
      if (gk.length < 3) continue
      const sim = similarity(gk, nk)
      if (!phon || sim > phon.score) phon = { x, score: sim }
    }
  }
  return phon && phon.score >= 0.8 ? phon.x : null
}

// ── Datas (fuso de Brasília) ─────────────────────────────────────────────────
const WEEKDAYS: Record<string, number> = {
  domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface DateSpec {
  kind?: string | null // hoje | amanha | depois_de_amanha | weekday | day_of_month | iso
  weekday?: string | null
  day?: number | null
  month?: number | null
  iso?: string | null
}

// today = "YYYY-MM-DD" de hoje em Brasília
export function resolveDate(spec: DateSpec | null | undefined, today: string): string | null {
  if (!spec || !spec.kind) return null
  const base = new Date(today + 'T12:00:00')
  const add = (n: number) => { const d = new Date(base); d.setDate(d.getDate() + n); return ymd(d) }

  switch (spec.kind) {
    case 'hoje': return today
    case 'amanha': return add(1)
    case 'depois_de_amanha': return add(2)
    case 'weekday': {
      const key = norm(spec.weekday ?? '').split(' ')[0].replace(/-?feira$/, '')
      const target = WEEKDAYS[key]
      if (target === undefined) return null
      // próxima ocorrência a partir de amanhã ("terça" dito numa terça = a da semana que vem)
      const diff = ((target - base.getDay() + 7) % 7) || 7
      return add(diff)
    }
    case 'day_of_month': {
      if (!spec.day || spec.day < 1 || spec.day > 31) return null
      let y = base.getFullYear()
      let m = spec.month && spec.month >= 1 && spec.month <= 12 ? spec.month - 1 : base.getMonth()
      let d = new Date(y, m, spec.day, 12)
      // sem mês dito e o dia já passou: vale o mês seguinte
      if (!spec.month && d < base) { m += 1; if (m > 11) { m = 0; y += 1 } d = new Date(y, m, spec.day, 12) }
      return d.getMonth() === m % 12 ? ymd(d) : null
    }
    case 'iso': return typeof spec.iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(spec.iso) ? spec.iso : null
    default: return null
  }
}

// ── Horários ────────────────────────────────────────────────────────────────
export const validTime = (t: unknown): string | null =>
  typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : null

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

// "das 10 às 2" (fim menor que o início) = 14:00. Fim igual ou ilegível vira null (1h padrão).
export function fixTimes(startRaw: unknown, endRaw: unknown): { start: string | null; end: string | null } {
  const start = validTime(startRaw)
  let end = validTime(endRaw)
  if (start && end && toMin(end) <= toMin(start)) {
    const pm = toMin(end) + 12 * 60
    end = pm > toMin(start) && pm < 24 * 60 ? fromMin(pm) : null
  }
  return { start, end: start ? end : null }
}

// ── Título ──────────────────────────────────────────────────────────────────
// Padrão: "Reunião iMoowe" / "Captação Stadium". Se foi dito um assunto, ele entra antes: "Alinhamento mensal – iMoowe".
export function buildTitle(opts: { type: 'reuniao' | 'captacao'; whoName: string | null; subject: string | null; fallback: string }): string {
  const label = opts.type === 'captacao' ? 'Captação' : 'Reunião'
  const who = opts.whoName?.trim() || ''
  const subject = opts.subject?.trim().replace(/^(uma?|a|o)\s+/i, '') || ''
  if (subject && norm(subject) !== norm(label)) return who ? `${capitalize(subject)} – ${who}` : capitalize(subject)
  if (who) return `${label} ${who}`
  return opts.fallback
}

function capitalize(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : s }
