import { TOOLS, type Tool } from './tools'
import { FINANCE_TOOLS } from './financeTools'
import { ToolError } from './errors'

// Servidor MCP mínimo, transporte Streamable HTTP, sem sessão (cada POST é independente).
// Cobre o que o claude.ai usa: initialize, ping, tools/list e tools/call.

const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05']
const SERVER_INFO = { name: 'owl-hub', title: 'OWL Hub — Calendário editorial', version: '1.0.0' }

interface RpcRequest { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }
type RpcResponse = { jsonrpc: '2.0'; id: string | number | null; result?: unknown; error?: { code: number; message: string } }

const ok = (id: RpcRequest['id'], result: unknown): RpcResponse => ({ jsonrpc: '2.0', id: id ?? null, result })
const err = (id: RpcRequest['id'], code: number, message: string): RpcResponse => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

// Cada token só enxerga as ferramentas dos seus escopos (conteúdo e/ou financeiro)
function toolsFor(scopes: string[]): Tool[] {
  return [...(scopes.includes('conteudo') ? TOOLS : []), ...(scopes.includes('financeiro') ? FINANCE_TOOLS : [])]
}

async function handleOne(msg: RpcRequest, scopes: string[]): Promise<RpcResponse | null> {
  const tools = toolsFor(scopes)
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    return err(msg?.id, -32600, 'Requisição inválida.')
  }
  const isNotification = msg.id === undefined
  const { method, params } = msg

  if (method.startsWith('notifications/')) return null

  switch (method) {
    case 'initialize': {
      const wanted = typeof params?.protocolVersion === 'string' ? params.protocolVersion : ''
      return ok(msg.id, {
        protocolVersion: SUPPORTED.includes(wanted) ? wanted : SUPPORTED[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: [
          scopes.includes('conteudo') ? 'Conteúdo: subir posts aprovados no calendário editorial dos clientes e ler o status de aprovação. Fluxo: listar_clientes → criar_post (só depois do Gustavo aprovar a arte) → ver_status → atualizar_post para ajustes.' : '',
          scopes.includes('financeiro') ? 'Financeiro (OWL e FDMC): fin_criar_despesa, fin_criar_receita, fin_listar, fin_marcar_pago e fin_resumo_mes. Sempre confirme valor, data, empresa e categoria com o Gustavo antes de lançar ou marcar como pago. Datas em AAAA-MM-DD (fuso de Brasília).' : '',
        ].filter(Boolean).join(' '),
      })
    }
    case 'ping':
      return ok(msg.id, {})
    case 'tools/list':
      return ok(msg.id, { tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) })
    case 'tools/call': {
      const name = typeof params?.name === 'string' ? params.name : ''
      const tool = tools.find(t => t.name === name)
      if (!tool) return err(msg.id, -32602, `Ferramenta desconhecida: ${name || '(vazio)'}`)
      const args = params?.arguments && typeof params.arguments === 'object' ? (params.arguments as Record<string, unknown>) : {}
      try {
        const out = await tool.run(args)
        return ok(msg.id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] })
      } catch (e) {
        // Erros de validação voltam como resultado (o Claude lê e corrige); falhas inesperadas viram mensagem genérica
        const text = e instanceof ToolError ? e.message : `Erro interno ao executar ${name}: ${e instanceof Error ? e.message : 'desconhecido'}`
        return ok(msg.id, { isError: true, content: [{ type: 'text', text }] })
      }
    }
    default:
      return isNotification ? null : err(msg.id, -32601, `Método não suportado: ${method}`)
  }
}

// Aceita uma mensagem ou um lote. Devolve null quando só havia notificações (resposta 202, sem corpo).
export async function handleRpc(body: unknown, scopes: string[]): Promise<RpcResponse | RpcResponse[] | null> {
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(m => handleOne(m, scopes)))).filter((r): r is RpcResponse => r !== null)
    return out.length ? out : null
  }
  return handleOne(body as RpcRequest, scopes)
}
