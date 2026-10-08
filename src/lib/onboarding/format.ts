import {
  isField, isFilled, isVisible, visibleSections,
  type Answers, type Field, type UploadedFile,
} from './form'

export interface DiagEntry {
  key: string
  label: string
  // texto já legível (checkboxes viram "A, B, C"; radios viram o rótulo da opção)
  text: string
  files: UploadedFile[]
  secret: boolean
}

export interface DiagSection {
  id: string
  title: string
  entries: DiagEntry[]
}

function display(field: Field, v: unknown): string {
  if (Array.isArray(v) && field.type !== 'file') {
    const labels = new Map((field.options ?? []).map(o => [o.value, o.label]))
    return v.map(x => labels.get(String(x)) ?? String(x)).join(', ')
  }
  if (field.type === 'radio' || field.type === 'select') {
    return (field.options ?? []).find(o => o.value === String(v))?.label ?? String(v)
  }
  return String(v)
}

// Só o que o cliente de fato respondeu, organizado por seção, na ordem do formulário.
export function buildDiagnostic(answers: Answers): DiagSection[] {
  const out: DiagSection[] = []
  for (const section of visibleSections(answers)) {
    const entries: DiagEntry[] = []
    for (const b of section.blocks) {
      if (!isField(b) || !isVisible(b.showIf, answers)) continue
      const v = answers[b.key]
      if (!isFilled(v)) continue
      entries.push({
        key: b.key,
        label: b.label,
        text: b.type === 'file' ? '' : display(b, v),
        files: b.type === 'file' ? (v as UploadedFile[]) : [],
        secret: !!b.secret,
      })
    }
    if (entries.length) out.push({ id: section.id, title: section.title, entries })
  }
  return out
}

// Texto puro do diagnóstico (TXT). Senhas não vão pro arquivo.
export function diagnosticToText(clientName: string, answers: Answers, submittedAt?: string | null): string {
  const lines: string[] = []
  lines.push(`DIAGNÓSTICO DO CLIENTE — ${clientName}`)
  if (submittedAt) lines.push(`Respondido em ${new Date(submittedAt).toLocaleDateString('pt-BR')}`)
  lines.push('')
  for (const s of buildDiagnostic(answers)) {
    lines.push(`== ${s.title.toUpperCase()} ==`)
    for (const e of s.entries) {
      if (e.files.length) lines.push(`${e.label}: ${e.files.map(f => f.name).join(', ')} (arquivo no Documentos do cliente)`)
      else if (e.secret) lines.push(`${e.label}: (informada, veja no Hub da marca)`)
      else lines.push(`${e.label}: ${e.text}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
