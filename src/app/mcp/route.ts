import { postMcp, methodNotAllowed } from '@/lib/mcp/http'

export const maxDuration = 60

// Mesmo conector, com o token no header Authorization: Bearer <token> (para clientes MCP que permitem header)
export async function POST(request: Request) {
  return postMcp(request)
}

export async function GET() { return methodNotAllowed() }
export async function DELETE() { return methodNotAllowed() }
