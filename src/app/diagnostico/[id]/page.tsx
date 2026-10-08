'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { buildDiagnostic } from '@/lib/onboarding/format'
import type { Answers } from '@/lib/onboarding/form'

// Página limpa pra imprimir / salvar como PDF (senhas não aparecem).
export default function DiagnosticoPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<{ clientName: string; submittedAt: string | null; answers: Answers } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/clients/${id}/onboarding`)
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok) setError(d.error ?? 'Erro')
        else setData(d)
      })
      .catch(() => setError('Erro'))
  }, [id])

  useEffect(() => {
    if (data) setTimeout(() => window.print(), 400)
  }, [data])

  if (error) return <p style={{ padding: 24 }}>{error}</p>
  if (!data) return <p style={{ padding: 24 }}>Carregando...</p>

  const sections = buildDiagnostic(data.answers)
  return (
    <div style={{ background: '#fff', color: '#111', minHeight: '100vh', padding: '32px 40px', fontFamily: 'system-ui, sans-serif', maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, margin: 0 }}>Diagnóstico — {data.clientName}</h1>
      <p style={{ color: '#666', fontSize: 12, margin: '4px 0 24px' }}>
        OWL Creative Club{data.submittedAt ? ` · respondido em ${new Date(data.submittedAt).toLocaleDateString('pt-BR')}` : ''}
      </p>
      {sections.map(s => (
        <section key={s.id} style={{ marginBottom: 22, breakInside: 'avoid' }}>
          <h2 style={{ fontSize: 15, borderBottom: '1px solid #ddd', paddingBottom: 4 }}>{s.title}</h2>
          {s.entries.map(e => (
            <div key={e.key} style={{ margin: '10px 0' }}>
              <div style={{ fontSize: 11, color: '#666' }}>{e.label}</div>
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
                {e.files.length ? e.files.map(f => f.name).join(', ') + ' (arquivo no Documentos)' : e.secret ? '(informada, veja no Hub da marca)' : e.text}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
