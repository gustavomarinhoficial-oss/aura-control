'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Loader2, Search, Zap, Check, Send, History, Plus, ArrowRight, ClipboardCheck, CalendarClock, Mic, MicOff } from 'lucide-react'
import { useOmarChat, type OmarUIMessage } from './useOmarChat'
import { useSpeechToText } from './useSpeechToText'
import { formatDate } from '@/lib/utils/format'

const priorityLabel: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' }

function FormattedText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        const isBullet = /^\s*[-*]\s+/.test(line)
        const clean = isBullet ? line.replace(/^\s*[-*]\s+/, '') : line
        const parts = clean.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
        const rendered = parts.map((part, j) =>
          part.startsWith('**') && part.endsWith('**')
            ? <strong key={j} className="font-semibold">{part.slice(2, -2)}</strong>
            : <Fragment key={j}>{part}</Fragment>
        )
        return (
          <p key={i} className={isBullet ? 'pl-3 relative before:content-["•"] before:absolute before:left-0 before:text-muted-foreground' : undefined}>
            {rendered}
          </p>
        )
      })}
    </>
  )
}

interface Conversation { id: string; title: string | null; updated_at: string }

function ToolBadge({ tool }: { tool: OmarUIMessage['toolEvents'][number] }) {
  const Icon = tool.kind === 'executing' ? Zap : Search
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      {tool.status === 'running'
        ? <Loader2 size={11} className="animate-spin text-[#a78bfa]" />
        : <Check size={11} className="text-[#22c55e]" />}
      <Icon size={11} />
      <span>{tool.label}{tool.status === 'done' ? ' — feito' : '...'}</span>
    </div>
  )
}

function TaskCardView({ task }: { task: OmarUIMessage['taskCards'][number] }) {
  return (
    <div className="mt-2 bg-[#141414] border border-[#2a2a2a] rounded-lg p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-[#22c55e]/10 flex items-center justify-center shrink-0">
        <ClipboardCheck size={15} className="text-[#22c55e]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{task.title}</p>
        <p className="text-[11px] text-muted-foreground">
          {task.priority && (priorityLabel[task.priority] ?? task.priority)}
          {task.priority && task.due_date && ' · '}
          {task.due_date && formatDate(task.due_date)}
        </p>
      </div>
      <Link
        href={`/tarefas?task=${task.id}`}
        className="flex items-center gap-1 text-xs font-medium text-[#a78bfa] hover:text-white bg-[#7c3aed]/10 hover:bg-[#7c3aed] px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
      >
        Ver tarefa
        <ArrowRight size={12} />
      </Link>
    </div>
  )
}

function MeetingCardView({ meeting }: { meeting: OmarUIMessage['meetingCards'][number] }) {
  return (
    <div className="mt-2 bg-[#141414] border border-[#2a2a2a] rounded-lg p-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-[#f59e0b]/10 flex items-center justify-center shrink-0">
        <CalendarClock size={15} className="text-[#f59e0b]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{meeting.title}</p>
        <p className="text-[11px] text-muted-foreground">
          {meeting.meeting_date && formatDate(meeting.meeting_date)}
          {meeting.meeting_date && meeting.start_time && ' · '}
          {meeting.start_time && meeting.start_time.slice(0, 5)}
        </p>
      </div>
      <Link
        href={`/reunioes?meeting=${meeting.id}`}
        className="flex items-center gap-1 text-xs font-medium text-[#a78bfa] hover:text-white bg-[#7c3aed]/10 hover:bg-[#7c3aed] px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
      >
        Ver reunião
        <ArrowRight size={12} />
      </Link>
    </div>
  )
}

function MessageBubble({ msg }: { msg: OmarUIMessage }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
        isUser ? 'bg-[#7c3aed] text-white' : 'bg-[#1a1a1a] text-foreground'
      }`}>
        {!isUser && msg.toolEvents.length > 0 && (
          <div className="flex flex-col gap-1 mb-2 pb-2 border-b border-[#2a2a2a]">
            {msg.toolEvents.map((t, i) => <ToolBadge key={i} tool={t} />)}
          </div>
        )}
        {msg.content
          ? <div className="space-y-1 leading-relaxed"><FormattedText text={msg.content} /></div>
          : msg.streaming && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
        {msg.taskCards.map(task => <TaskCardView key={task.id} task={task} />)}
        {msg.meetingCards.map(meeting => <MeetingCardView key={meeting.id} meeting={meeting} />)}
      </div>
    </div>
  )
}

export function OmarPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { messages, conversationId, status, sending, sendMessage, loadConversation, newConversation } = useOmarChat()
  const [input, setInput] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const speech = useSpeechToText(text => setInput(prev => (prev.trim() ? prev.trim() + ' ' : '') + text))

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (showHistory) {
      fetch('/api/omar/conversations').then(r => r.json()).then(d => setConversations(Array.isArray(d) ? d : []))
    }
  }, [showHistory])

  function handleSend() {
    if (!input.trim() || sending) return
    sendMessage(input)
    setInput('')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="border-b border-[#1f1f1f]">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle>Omar</SheetTitle>
              <p className="text-xs text-muted-foreground">Agente de IA do Aura Control</p>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setShowHistory(v => !v)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] transition-colors"
                title="Histórico"
              >
                <History size={15} />
              </button>
              <button
                onClick={() => { newConversation(); setShowHistory(false) }}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-[#1a1a1a] transition-colors"
                title="Nova conversa"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
        </SheetHeader>

        {showHistory ? (
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
            {conversations.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma conversa ainda.</p>}
            {conversations.map(c => (
              <button
                key={c.id}
                onClick={() => { loadConversation(c.id); setShowHistory(false) }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-colors ${
                  c.id === conversationId ? 'bg-[#7c3aed]/10 text-[#a78bfa]' : 'text-foreground hover:bg-[#1a1a1a]'
                }`}
              >
                {c.title || 'Conversa sem título'}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  Pergunte sobre clientes, tarefas, números — ou peça pra criar e editar tarefas.
                </div>
              )}
              {messages.map(m => <MessageBubble key={m.id} msg={m} />)}
              {status && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pl-1">
                  <Loader2 size={11} className="animate-spin" />
                  <span>{status === 'thinking' ? 'Pensando...' : status}</span>
                </div>
              )}
            </div>

            {speech.error && (
              <p className="px-3 pb-1 text-[11px] text-[#ef4444]">{speech.error}</p>
            )}
            <div className="border-t border-[#1f1f1f] p-3 flex gap-2" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
              <input
                value={speech.recording && speech.interim ? speech.interim : input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder={speech.recording ? 'Ouvindo...' : 'Pergunte alguma coisa ao Omar...'}
                className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm outline-none focus:border-[#7c3aed] transition-colors"
                disabled={sending || speech.recording}
              />
              {speech.supported && (
                <button
                  type="button"
                  onClick={() => (speech.recording ? speech.stop() : speech.start())}
                  disabled={sending}
                  title={speech.recording ? 'Parar gravação' : 'Ditar por voz'}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors shrink-0 disabled:opacity-40 ${
                    speech.recording ? 'bg-[#ef4444] text-white animate-pulse' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {speech.recording ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={sending || !input.trim()}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#7c3aed] text-white disabled:opacity-40 transition-opacity shrink-0"
              >
                <Send size={15} />
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
