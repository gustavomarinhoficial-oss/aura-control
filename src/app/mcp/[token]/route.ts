import { postMcp, methodNotAllowed } from '@/lib/mcp/http'

export const maxDuration = 60

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return postMcp(request, token)
}

export async function GET() { return methodNotAllowed() }
export async function DELETE() { return methodNotAllowed() }
