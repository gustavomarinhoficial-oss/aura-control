import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BUCKET = 'client-files'
const FOLDERS = ['contratos', 'identidade-visual', 'financeiro'] as const

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// GET: lista arquivos agrupados por pasta
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = adminClient()

  const results = await Promise.all(
    FOLDERS.map(async folder => {
      const { data } = await supabase.storage.from(BUCKET).list(`${id}/${folder}`, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' },
      })
      return { folder, files: data ?? [] }
    })
  )

  const grouped: Record<string, { name: string; metadata?: { size?: number } | null }[]> = {}
  for (const { folder, files } of results) {
    grouped[folder] = files.filter(f => f.name !== '.emptyFolderPlaceholder')
  }

  return NextResponse.json(grouped)
}

// POST: upload com pasta
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = adminClient()

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const folder = (formData.get('folder') as string) || 'contratos'

  if (!file) return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
  if (!FOLDERS.includes(folder as typeof FOLDERS[number])) {
    return NextResponse.json({ error: 'Pasta inválida' }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._\-À-ÿ]/g, '_')
  const filename = `${Date.now()}_${safeName}`
  const path = `${id}/${folder}/${filename}`

  const bytes = await file.arrayBuffer()
  const { error } = await supabase.storage.from(BUCKET).upload(path, Buffer.from(bytes), {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ folder, name: filename, original: file.name }, { status: 201 })
}
