// Web Speech API — não faz parte do lib.dom.d.ts padrão do TypeScript

export {}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
  interface SpeechRecognition extends EventTarget {
    lang: string
    continuous: boolean
    interimResults: boolean
    start(): void
    stop(): void
    onresult: ((e: SpeechRecognitionEvent) => void) | null
    onerror: ((e: Event) => void) | null
    onend: (() => void) | null
  }
  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList
  }
  interface SpeechRecognitionResultList {
    [index: number]: SpeechRecognitionResult
    length: number
  }
  interface SpeechRecognitionResult {
    [index: number]: SpeechRecognitionAlternative
    isFinal: boolean
  }
  interface SpeechRecognitionAlternative {
    transcript: string
  }
}
