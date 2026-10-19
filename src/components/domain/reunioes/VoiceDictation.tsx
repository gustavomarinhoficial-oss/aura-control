'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'

export interface VoiceDraft {
  title: string
  type: 'reuniao' | 'captacao'
  client_id: string | null
  lead_id: string | null
  meeting_date: string | null
  start_time: string | null
  end_time: string | null
  location: string | null
  meeting_link: string | null
  attendee_ids: string[]
  notes: string | null
}

const MAX_SECONDS = 120

function pickMimeType(): string {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
  return options.find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? ''
}

// Ditado por voz: grava o áudio, manda pro servidor (Whisper, grátis) e devolve o compromisso já interpretado.
// Funciona no iPhone (app instalado) e no computador, sem depender do reconhecimento de voz do navegador.
export function VoiceDictation({ me, onResult }: { me: string; onResult: (draft: VoiceDraft, transcript: string) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'processing'>('idle')
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const stream = useRef<MediaStream | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current)
    stream.current?.getTracks().forEach(t => t.stop())
  }, [])

  async function start() {
    setError('')
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Este aparelho não consegue gravar áudio aqui. Tente pelo app instalado ou outro navegador.')
      return
    }
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      stream.current = media
      const mimeType = pickMimeType()
      const rec = new MediaRecorder(media, mimeType ? { mimeType } : undefined)
      chunks.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.current.push(e.data) }
      rec.onstop = () => finish(rec.mimeType || mimeType || 'audio/webm')
      recorder.current = rec
      rec.start()
      setSeconds(0)
      setState('recording')
      timer.current = setInterval(() => {
        setSeconds(s => {
          if (s + 1 >= MAX_SECONDS) stop()
          return s + 1
        })
      }, 1000)
    } catch {
      setError('Não consegui acessar o microfone. Libere o microfone para o OWL Hub nos ajustes do celular ou do navegador.')
    }
  }

  function stop() {
    if (timer.current) { clearInterval(timer.current); timer.current = null }
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop()
    stream.current?.getTracks().forEach(t => t.stop())
  }

  async function finish(mime: string) {
    setState('processing')
    const blob = new Blob(chunks.current, { type: mime })
    if (blob.size < 2000) { setState('idle'); setError('Gravação muito curta. Toque, fale e toque de novo para parar.'); return }
    const fd = new FormData()
    fd.append('audio', blob, 'ditado')
    fd.append('me', me)
    try {
      const res = await fetch('/api/meetings/voice', { method: 'POST', body: fd })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error ?? 'Não consegui processar o áudio.'); setState('idle'); return }
      onResult(d.draft as VoiceDraft, d.transcript as string)
    } catch {
      setError('Sem conexão para enviar o áudio. Tente de novo.')
    }
    setState('idle')
  }

  const mm = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

  return (
    <div className="flex flex-col items-end gap-1">
      {state === 'idle' && (
        <button onClick={start} className="flex items-center gap-2 border border-[#2a2a2a] hover:bg-[#1a1a1a] text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Mic size={14} /> Ditar compromisso
        </button>
      )}
      {state === 'recording' && (
        <button onClick={stop} className="flex items-center gap-2 bg-[#ef4444] hover:bg-[#dc2626] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors animate-pulse">
          <Square size={13} fill="currentColor" /> Gravando {mm} · toque para parar
        </button>
      )}
      {state === 'processing' && (
        <span className="flex items-center gap-2 text-sm text-muted-foreground px-4 py-2"><Loader2 size={14} className="animate-spin" /> Entendendo o que você falou...</span>
      )}
      {error && <p className="text-[11px] text-[#ef4444] max-w-xs text-right">{error}</p>}
      {state === 'idle' && !error && <p className="text-[10px] text-muted-foreground hidden sm:block">Ex: “captação do Stadium sexta de meio-dia até as 3”</p>}
    </div>
  )
}
