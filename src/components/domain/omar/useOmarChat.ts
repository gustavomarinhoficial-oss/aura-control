'use client'

import { useCallback, useRef, useState } from 'react'

export interface OmarToolEvent {
  tool: string
  kind: 'consulting' | 'executing'
  label: string
  status: 'running' | 'done'
}

export interface OmarTaskCard {
  id: string
  title: string
  priority?: string
  due_date?: string | null
}

export interface OmarUIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolEvents: OmarToolEvent[]
  taskCards: OmarTaskCard[]
  streaming?: boolean
}

function uid() {
  return Math.random().toString(36).slice(2)
}

export function useOmarChat() {
  const [messages, setMessages] = useState<OmarUIMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const loadConversation = useCallback(async (id: string) => {
    const res = await fetch(`/api/omar/conversations/${id}`)
    if (!res.ok) return
    const data = await res.json()
    setConversationId(id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setMessages((data as any[]).map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolEvents: (m.tool_calls ?? []).map((t: { name: string }) => ({
        tool: t.name, kind: 'consulting', label: t.name, status: 'done',
      })),
      taskCards: [],
    })))
  }, [])

  const newConversation = useCallback(() => {
    setConversationId(null)
    setMessages([])
    setStatus(null)
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return

    const userMsg: OmarUIMessage = { id: uid(), role: 'user', content: trimmed, toolEvents: [], taskCards: [] }
    const assistantMsg: OmarUIMessage = { id: uid(), role: 'assistant', content: '', toolEvents: [], taskCards: [], streaming: true }
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setSending(true)
    setStatus('thinking')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/omar/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, conversation_id: conversationId }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) throw new Error('Falha ao conectar com o Omar')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          const jsonStr = line.slice(5).trim()
          if (!jsonStr) continue
          let evt: Record<string, unknown>
          try { evt = JSON.parse(jsonStr) } catch { continue }

          if (evt.type === 'conversation') {
            setConversationId(evt.id as string)
          } else if (evt.type === 'status') {
            setStatus('thinking')
          } else if (evt.type === 'text_delta') {
            setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: m.content + (evt.text as string) } : m))
          } else if (evt.type === 'tool_start') {
            setStatus(evt.label as string)
            setMessages(prev => prev.map(m => m.id === assistantMsg.id
              ? { ...m, toolEvents: [...m.toolEvents, { tool: evt.tool as string, kind: evt.kind as 'consulting' | 'executing', label: evt.label as string, status: 'running' }] }
              : m))
          } else if (evt.type === 'task_card') {
            const task = evt.task as OmarTaskCard
            setMessages(prev => prev.map(m => m.id === assistantMsg.id
              ? { ...m, taskCards: [...m.taskCards, task] }
              : m))
          } else if (evt.type === 'tool_done') {
            setMessages(prev => prev.map(m => m.id === assistantMsg.id
              ? { ...m, toolEvents: m.toolEvents.map(te => te.tool === evt.tool && te.status === 'running' ? { ...te, status: 'done' } : te) }
              : m))
            setStatus('thinking')
          } else if (evt.type === 'done') {
            setStatus(null)
          } else if (evt.type === 'error') {
            setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: m.content || `Erro: ${evt.message}` } : m))
            setStatus(null)
          }
        }
      }
    } catch {
      setMessages(prev => prev.map(m => m.id === assistantMsg.id
        ? { ...m, content: m.content || 'Não consegui me conectar. Tenta de novo?' }
        : m))
    } finally {
      setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, streaming: false } : m))
      setSending(false)
      setStatus(null)
    }
  }, [conversationId, sending])

  return { messages, conversationId, status, sending, sendMessage, loadConversation, newConversation }
}
