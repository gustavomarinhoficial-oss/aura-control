'use client'

import { useCallback, useRef, useState } from 'react'

export function useSpeechToText(onFinalText: (text: string) => void) {
  const [recording, setRecording] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const supported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setError('Seu navegador não suporta reconhecimento de voz. Use o Chrome.'); return }

    setError('')
    setInterim('')

    const rec = new SR()
    rec.lang = 'pt-BR'
    rec.continuous = false
    rec.interimResults = true
    recognitionRef.current = rec

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let liveText = ''
      for (let i = 0; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          onFinalText(chunk)
        } else {
          liveText += chunk
        }
      }
      if (liveText) setInterim(liveText)
    }

    rec.onerror = () => {
      setError('Erro ao capturar áudio. Verifique a permissão do microfone.')
      setRecording(false)
    }

    rec.onend = () => { setRecording(false); setInterim('') }

    rec.start()
    setRecording(true)
  }, [onFinalText])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setRecording(false)
  }, [])

  return { supported, recording, interim, error, start, stop }
}
