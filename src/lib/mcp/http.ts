import { NextResponse } from 'next/server'
import { verifyToken } from './auth'
import { handleRpc } from './rpc'

const UNAUTHORIZED = () => NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

// POST: mensagens JSON-RPC. O token vem na URL (/mcp/<token>) ou no header Authorization: Bearer <token>.
export async function postMcp(request: Request, urlToken?: string): Promise<Response> {
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!(await verifyToken(urlToken ?? bearer))) return UNAUTHORIZED()

  const body = await request.json().catch(() => undefined)
  if (body === undefined) {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido.' } }, { status: 400 })
  }
  const out = await handleRpc(body)
  if (out === null) return new Response(null, { status: 202 })
  return NextResponse.json(out)
}

// Sem stream de servidor: o transporte permite responder 405 ao GET
export function methodNotAllowed(): Response {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } })
}
