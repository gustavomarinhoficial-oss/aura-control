import Groq from 'groq-sdk'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/roles'
import { getToolsForRole, getToolByName } from '@/lib/omar/tools'
import { buildSystemPrompt } from '@/lib/omar/systemPrompt'
import { toolMeta } from '@/lib/omar/toolMeta'

export const runtime = 'nodejs'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const MODEL = 'openai/gpt-oss-120b'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
  tool_call_id?: string
}

function sse(obj: Record<string, unknown>) {
  return `data: ${JSON.stringify(obj)}\n\n`
}

function describeError(err: unknown): string {
  if (err instanceof Groq.RateLimitError) {
    const retryAfter = err.headers?.get?.('retry-after')
    const wait = retryAfter ? ` Tenta de novo em ~${retryAfter}s.` : ' Tenta de novo daqui a pouco.'
    return `Bati no limite gratuito de uso da Groq por agora (é o plano free da API).${wait}`
  }
  if (err instanceof Groq.APIError) {
    return `A Groq não respondeu direito agora (erro ${err.status ?? ''}). Tenta de novo em instantes.`
  }
  return err instanceof Error ? err.message : 'Erro inesperado'
}

function isTaskResult(result: unknown): result is { success: true; task: { id: string; title: string } } {
  if (!result || typeof result !== 'object') return false
  const r = result as Record<string, unknown>
  return r.success === true && typeof r.task === 'object' && r.task !== null && 'id' in (r.task as object)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const role = getRole(user.user_metadata)
  const body = await request.json()
  const userMessage = (body.message as string)?.trim()
  if (!userMessage) return new Response('Missing message', { status: 400 })

  const db = createServiceClient()
  let conversationId = body.conversation_id as string | undefined

  if (!conversationId) {
    const { data: conv, error } = await db
      .from('omar_conversations')
      .insert({ user_id: user.id, title: userMessage.slice(0, 60) })
      .select('id')
      .single()
    if (error || !conv) return new Response('Erro ao criar conversa', { status: 500 })
    conversationId = conv.id
  }

  const { data: history } = await db
    .from('omar_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  await db.from('omar_messages').insert({ conversation_id: conversationId, role: 'user', content: userMessage })
  await db.from('omar_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)

  const tools = getToolsForRole(role)
  const groqTools: Groq.Chat.Completions.ChatCompletionTool[] = tools.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema as Record<string, unknown>,
    },
  }))

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(role) },
    ...(history ?? []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ]

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const push = (obj: Record<string, unknown>) => controller.enqueue(encoder.encode(sse(obj)))
      push({ type: 'conversation', id: conversationId })

      let fullText = ''
      const toolCallLog: Array<{ name: string; input: unknown; result: unknown }> = []
      const MAX_TURNS = 25
      let hitTurnLimit = true

      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          push({ type: 'status', phase: 'thinking' })

          const completion = await groq.chat.completions.create({
            model: MODEL,
            max_tokens: 2048,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            messages: messages as any,
            tools: groqTools,
            stream: true,
          })

          let turnContent = ''
          let finishReason: string | null = null
          const toolCallsAcc: Record<number, { id?: string; name?: string; args: string }> = {}

          for await (const chunk of completion) {
            const choice = chunk.choices[0]
            if (!choice) continue
            if (choice.finish_reason) finishReason = choice.finish_reason
            const delta = choice.delta
            if (delta?.content) {
              turnContent += delta.content
              fullText += delta.content
              push({ type: 'text_delta', text: delta.content })
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0
                if (!toolCallsAcc[idx]) toolCallsAcc[idx] = { args: '' }
                if (tc.id) toolCallsAcc[idx].id = tc.id
                if (tc.function?.name) toolCallsAcc[idx].name = tc.function.name
                if (tc.function?.arguments) toolCallsAcc[idx].args += tc.function.arguments
              }
            }
          }

          const toolCallEntries = Object.values(toolCallsAcc).filter(tc => tc.id && tc.name)

          if (finishReason !== 'tool_calls' || toolCallEntries.length === 0) {
            if (turnContent) messages.push({ role: 'assistant', content: turnContent })
            hitTurnLimit = false
            break
          }

          messages.push({
            role: 'assistant',
            content: turnContent || null,
            tool_calls: toolCallEntries.map(tc => ({
              id: tc.id!,
              type: 'function',
              function: { name: tc.name!, arguments: tc.args },
            })),
          })

          for (const tc of toolCallEntries) {
            const meta = toolMeta(tc.name!)
            push({ type: 'tool_start', tool: tc.name, kind: meta.kind, label: meta.label })
            const tool = getToolByName(tc.name!)
            let result: unknown
            let parsedInput: Record<string, unknown> = {}
            try {
              parsedInput = tc.args ? JSON.parse(tc.args) : {}
            } catch {
              parsedInput = {}
            }
            try {
              result = tool ? await tool.execute(parsedInput, { role }) : { error: `Ferramenta desconhecida: ${tc.name}` }
            } catch (e) {
              result = { error: e instanceof Error ? e.message : 'Erro desconhecido' }
            }
            toolCallLog.push({ name: tc.name!, input: parsedInput, result })
            push({ type: 'tool_done', tool: tc.name, kind: meta.kind, label: meta.label })

            if ((tc.name === 'create_task' || tc.name === 'update_task') && isTaskResult(result)) {
              push({ type: 'task_card', task: result.task })
            }

            messages.push({ role: 'tool', tool_call_id: tc.id!, content: JSON.stringify(result) })
          }
        }

        if (hitTurnLimit) {
          const notice = '\n\nEsse pedido tinha muitas ações — parei no meio pra não travar. Pode me pedir pra continuar de onde parou.'
          fullText += notice
          push({ type: 'text_delta', text: notice })
        }

        await db.from('omar_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: fullText,
          tool_calls: toolCallLog.length ? toolCallLog : null,
        })

        push({ type: 'done' })
      } catch (err) {
        push({ type: 'error', message: describeError(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
