import { NextResponse } from 'next/server'
import { verifyToken } from '@/lib/mcp/auth'
import { storeBytes, MAX_IMAGE_BYTES } from '@/lib/mcp/r2'
import { ToolError } from '@/lib/mcp/errors'

export const maxDuration = 60

// POST /api/claude/upload  (multipart/form-data, campo "arquivo")
// Header: Authorization: Bearer <token>. Aceita JPEG/PNG até 5 MB e devolve { url } — a mesma url que
// o enviar_imagem do conector devolve, pronta pra usar em criar_post/atualizar_post ({ url }).
export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!(await verifyToken(token))) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_IMAGE_BYTES + 512 * 1024) {
    return NextResponse.json({ error: 'Arquivo grande demais. O limite é 5 MB.' }, { status: 413 })
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('arquivo')
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: 'Envie o arquivo no campo "arquivo" (multipart/form-data).' }, { status: 400 })
  }

  try {
    const url = await storeBytes(Buffer.from(await file.arrayBuffer()), undefined, 'Imagem')
    return NextResponse.json({ url })
  } catch (e) {
    if (e instanceof ToolError) return NextResponse.json({ error: e.message }, { status: 400 })
    return NextResponse.json({ error: 'Erro ao salvar a imagem.' }, { status: 500 })
  }
}
