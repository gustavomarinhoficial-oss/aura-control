import { NextResponse } from 'next/server'
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { createServiceClient } from '@/lib/supabase/server'

// Retenção de mídia: passou de 90 dias da data agendada/publicação, a foto/vídeo
// sai do R2 (economiza armazenamento) e some do post — mas o post em si
// (título, legenda, métricas, status) continua no histórico.
const RETENTION_DAYS = 90

function checkAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

function keyFromUrl(url: string, publicBase: string): string | null {
  if (!url.startsWith(publicBase + '/')) return null
  return url.slice(publicBase.length + 1)
}

async function run() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    return NextResponse.json({ error: 'R2 não configurado no servidor' }, { status: 500 })
  }

  const supabase = createServiceClient()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const { data: posts, error } = await supabase
    .from('content_posts')
    .select('id, media_url, media_urls, scheduled_date, published_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const candidates = (posts ?? []).filter(p => {
    if (!p.media_url && (!p.media_urls || p.media_urls.length === 0)) return false
    const relevantDate = (p.published_at ? p.published_at.split('T')[0] : null) ?? p.scheduled_date
    if (!relevantDate) return false
    return relevantDate < cutoffStr
  })

  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  })

  let cleaned = 0
  let mediaDeleted = 0

  for (const post of candidates) {
    const urls = [post.media_url, ...(post.media_urls ?? [])].filter((u): u is string => !!u)
    const keys = Array.from(new Set(urls))
      .map(u => keyFromUrl(u, R2_PUBLIC_URL))
      .filter((k): k is string => !!k)

    if (keys.length > 0) {
      try {
        await r2.send(new DeleteObjectsCommand({
          Bucket: R2_BUCKET_NAME,
          Delete: { Objects: keys.map(Key => ({ Key })) },
        }))
        mediaDeleted += keys.length
      } catch {
        continue // se falhar ao apagar do R2, não mexe no registro — tenta de novo na próxima execução
      }
    }

    const { error: updErr } = await supabase
      .from('content_posts')
      .update({ media_url: null, media_urls: null })
      .eq('id', post.id)
    if (!updErr) cleaned++
  }

  return NextResponse.json({ checked: candidates.length, cleaned, mediaDeleted, cutoff: cutoffStr })
}

// Vercel Cron dispara via GET
export async function GET(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return run()
}

export async function POST(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return run()
}
