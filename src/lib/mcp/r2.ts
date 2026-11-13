import { ToolError } from './errors'
import { S3Client, PutObjectCommand, DeleteObjectsCommand, HeadObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Mesmo bucket e mesma pasta (posts/) que o Hub já usa pras imagens do calendário editorial.

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_IMAGES = 10
export const MAX_VIDEO_BYTES = 500 * 1024 * 1024
export const MAX_DIRECT_IMAGE_BYTES = 25 * 1024 * 1024 // imagem enviada direto pro R2 (url pré-assinada)
export const UPLOAD_URL_TTL_SECONDS = 30 * 60

const MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const VIDEO_EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov' }

function config() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new ToolError('O armazenamento de imagens (R2) não está configurado no servidor.')
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
    if (!isOurUrl(input.url)) throw new ToolError(`${label}: só aceito URLs de imagens enviadas por este conector (use enviar_imagem ou conteudo_base64).`)
    return input.url
  }
  if (typeof input.conteudo_base64 !== 'string' || !input.conteudo_base64) {
    throw new ToolError(`${label}: informe "conteudo_base64" (ou "url" de uma imagem já enviada).`)
  }
  const raw = input.conteudo_base64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) throw new ToolError(`${label}: o base64 da imagem é inválido.`)
  return storeBytes(Buffer.from(raw, 'base64'), typeof input.mime === 'string' ? input.mime : undefined, label)
}

// Valida os bytes (tamanho e formato reais) e grava no R2. Usado pelo base64 e pelo upload por arquivo.
export async function storeBytes(bytes: Buffer, declaredMime: string | undefined, label: string): Promise<string> {
  if (bytes.length === 0) throw new ToolError(`${label}: a imagem está vazia.`)
  if (bytes.length > MAX_IMAGE_BYTES) throw new ToolError(`${label}: a imagem tem ${(bytes.length / 1048576).toFixed(1)} MB; o limite é 5 MB.`)

  const real = sniff(bytes)
  if (!real) throw new ToolError(`${label}: formato não suportado. Envie JPEG ou PNG.`)
  const declared = declaredMime ? declaredMime.toLowerCase() : real
  if (!MIME_EXT[declared]) throw new ToolError(`${label}: mime "${declared}" não suportado. Use image/jpeg ou image/png.`)

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

export type MediaKind = 'image' | 'video'

// ── envio direto pro R2 (vídeos e imagens pesadas) ───────────────────────────
// O arquivo NÃO passa pelo servidor do Hub (a Vercel limita a ~4,5 MB): o Claude faz um PUT
// direto na url_upload e depois usa a url_publica no post.
export async function createUploadUrl(mimeRaw: string, size: number): Promise<{ url_upload: string; url_publica: string; tipo: MediaKind; ext: string; content_type: string; expira_em_minutos: number }> {
  const mime = mimeRaw.toLowerCase().trim()
  const isVideo = !!VIDEO_EXT[mime]
  const isImage = !!MIME_EXT[mime]
  if (!isVideo && !isImage) throw new ToolError('"mime" não suportado. Use video/mp4, video/quicktime, image/jpeg ou image/png.')
  const limit = isVideo ? MAX_VIDEO_BYTES : MAX_DIRECT_IMAGE_BYTES
  if (!Number.isFinite(size) || size <= 0) throw new ToolError('Informe "tamanho" em bytes (número maior que zero).')
  if (size > limit) throw new ToolError(`O arquivo tem ${(size / 1048576).toFixed(1)} MB; o limite para ${isVideo ? 'vídeo é 500 MB' : 'imagem é 25 MB'}.`)

  const c = config()
  const ext = isVideo ? VIDEO_EXT[mime] : MIME_EXT[mime]
  const key = `posts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const url_upload = await getSignedUrl(
    client(c),
    new PutObjectCommand({ Bucket: c.R2_BUCKET_NAME, Key: key, ContentType: mime }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  )
  return { url_upload, url_publica: `${c.R2_PUBLIC_URL}/${key}`, tipo: isVideo ? 'video' : 'image', ext, content_type: mime, expira_em_minutos: UPLOAD_URL_TTL_SECONDS / 60 }
}

// Confere no R2 que o arquivo da url foi mesmo enviado, é do tipo permitido e não passa do limite
export async function verifyUploaded(url: string, label: string): Promise<MediaKind> {
  if (!isOurUrl(url)) throw new ToolError(`${label}: só aceito URLs geradas por este conector (gerar_url_upload, enviar_imagem ou o upload por arquivo).`)
  const c = config()
  const key = url.slice(c.R2_PUBLIC_URL.length + 1)
  let head
  try {
    head = await client(c).send(new HeadObjectCommand({ Bucket: c.R2_BUCKET_NAME, Key: key }))
  } catch {
    throw new ToolError(`${label}: esse arquivo ainda não foi enviado (ou a url expirou). Faça o PUT do arquivo na url_upload e tente de novo.`)
  }
  let type = (head.ContentType ?? '').toLowerCase()
  const size = head.ContentLength ?? 0
  // O R2 não obriga o Content-Type do PUT. Se veio sem ele (ou errado) mas o nome do arquivo é de um tipo
  // permitido, corrige o tipo no próprio R2 (cópia no mesmo lugar) em vez de obrigar a reenviar um vídeo pesado.
  if (!VIDEO_EXT[type] && !MIME_EXT[type]) {
    const ext = key.split('.').pop()?.toLowerCase() ?? ''
    const fixed = ext === 'mp4' ? 'video/mp4' : ext === 'mov' ? 'video/quicktime' : ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : null
    if (fixed) {
      try {
        await client(c).send(new CopyObjectCommand({ Bucket: c.R2_BUCKET_NAME, Key: key, CopySource: `${c.R2_BUCKET_NAME}/${encodeURIComponent(key).replace(/%2F/g, '/')}`, ContentType: fixed, MetadataDirective: 'REPLACE' }))
        type = fixed
      } catch {
        // segue: cai no erro de tipo abaixo
      }
    }
  }
  const kind: MediaKind | null = VIDEO_EXT[type] ? 'video' : MIME_EXT[type] ? 'image' : null
  if (!kind) {
    await deleteImages([url])
    throw new ToolError(`${label}: tipo de arquivo "${type || 'desconhecido'}" não suportado. Use video/mp4, video/quicktime, image/jpeg ou image/png (o Content-Type do PUT deve ser o mesmo informado em gerar_url_upload).`)
  }
  const limit = kind === 'video' ? MAX_VIDEO_BYTES : MAX_DIRECT_IMAGE_BYTES
  if (size === 0 || size > limit) {
    await deleteImages([url])
    throw new ToolError(`${label}: o arquivo enviado tem ${(size / 1048576).toFixed(1)} MB; ${size === 0 ? 'está vazio' : `o limite para ${kind === 'video' ? 'vídeo é 500 MB' : 'imagem é 25 MB'}`}.`)
  }
  return kind
}

// Mídia de um post: base64 (só imagem) ou url já enviada (imagem ou vídeo)
export async function storeMedia(input: ImageInput, label: string): Promise<{ url: string; kind: MediaKind }> {
  if (typeof input.url === 'string' && input.url) return { url: input.url, kind: await verifyUploaded(input.url, label) }
  return { url: await storeImage(input, label), kind: 'image' }
}
