import { S3Client, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'

// Mesmo bucket e mesma pasta (posts/) que o Hub já usa pras imagens do calendário editorial.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_IMAGES = 10

const MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

function config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new Error('O armazenamento de imagens (R2) não está configurado no servidor.')
  }
  return { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL }
}

function client(c: ReturnType<typeof config>) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${c.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: c.R2_ACCESS_KEY_ID, secretAccessKey: c.R2_SECRET_ACCESS_KEY },
  })
}

export function isOurUrl(url: string): boolean {
  const base = process.env.R2_PUBLIC_URL
  return !!base && url.startsWith(base + '/')
}

// Confere se os bytes são mesmo JPEG/PNG/WebP (não confia só no mime informado)
function sniff(bytes: Buffer): string | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (bytes.length > 12 && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  return null
}

export interface ImageInput { nome_arquivo?: unknown; conteudo_base64?: unknown; mime?: unknown; url?: unknown }

// Recebe uma imagem em base64 (ou uma URL que já é nossa) e devolve a URL pública no R2.
export async function storeImage(input: ImageInput, label: string): Promise<string> {
  if (typeof input.url === 'string' && input.url) {
    if (!isOurUrl(input.url)) throw new Error(`${label}: só aceito URLs de imagens enviadas por este conector (use enviar_imagem ou conteudo_base64).`)
    return input.url
  }
  if (typeof input.conteudo_base64 !== 'string' || !input.conteudo_base64) {
    throw new Error(`${label}: informe "conteudo_base64" (ou "url" de uma imagem já enviada).`)
  }
  const raw = input.conteudo_base64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) throw new Error(`${label}: o base64 da imagem é inválido.`)
  const bytes = Buffer.from(raw, 'base64')
  if (bytes.length === 0) throw new Error(`${label}: a imagem está vazia.`)
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`${label}: a imagem tem ${(bytes.length / 1048576).toFixed(1)} MB; o limite é 5 MB.`)

  const real = sniff(bytes)
  if (!real) throw new Error(`${label}: formato não suportado. Envie JPEG ou PNG.`)
  const declared = typeof input.mime === 'string' ? input.mime.toLowerCase() : real
  if (!MIME_EXT[declared]) throw new Error(`${label}: mime "${declared}" não suportado. Use image/jpeg ou image/png.`)

  const c = config()
  const key = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${MIME_EXT[real]}`
  await client(c).send(new PutObjectCommand({ Bucket: c.R2_BUCKET_NAME, Key: key, Body: bytes, ContentType: real }))
  return `${c.R2_PUBLIC_URL}/${key}`
}

// Apaga do R2 as imagens (só as nossas) que não vão mais ser usadas
export async function deleteImages(urls: string[]): Promise<void> {
  const base = process.env.R2_PUBLIC_URL
  if (!base) return
  const keys = Array.from(new Set(urls.filter(isOurUrl).map(u => u.slice(base.length + 1))))
  if (keys.length === 0) return
  try {
    const c = config()
    await client(c).send(new DeleteObjectsCommand({ Bucket: c.R2_BUCKET_NAME, Delete: { Objects: keys.map(Key => ({ Key })) } }))
  } catch {
    // limpeza é best-effort: a imagem sobrar no bucket não pode quebrar a operação
  }
}
