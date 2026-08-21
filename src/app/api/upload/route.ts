import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Gera uma URL assinada pra o navegador enviar o arquivo direto pro R2,
// sem passar pela função serverless da Vercel (que tem limite de ~4.5MB
// de corpo de requisição — era isso que causava "erro ao enviar arquivo"
// em fotos maiores, de forma intermitente dependendo do tamanho).
export async function POST(request: Request) {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    return NextResponse.json({ error: 'R2 não configurado no servidor (variáveis ausentes)' }, { status: 500 })
  }

  const body = await request.json().catch(() => null)
  const filename = body?.filename as string | undefined
  // O navegador manda o mesmo contentType que vai usar no PUT direto pro R2 —
  // tem que ser IDÊNTICO ao que foi assinado aqui, senão o R2 recusa com
  // SignatureDoesNotMatch (era a causa do "erro ao enviar arquivo" em fotos
  // cujo file.type vinha vazio no navegador, ex: alguns HEIC de iPhone).
  const contentType = (body?.contentType as string | undefined) || 'application/octet-stream'
  if (!filename) return NextResponse.json({ error: 'Nome do arquivo obrigatório' }, { status: 400 })

  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  })

  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg'
  const key = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  try {
    const uploadUrl = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, ContentType: contentType }),
      { expiresIn: 300 }
    )
    return NextResponse.json({ uploadUrl, publicUrl: `${R2_PUBLIC_URL}/${key}` })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Erro ao gerar URL de upload: ${msg}` }, { status: 500 })
  }
}
