import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// GET /api/public/projects?token=X
// Retorna só os projetos do cliente dono do token — nunca outros clientes,
// nunca campos internos (owner/dono do sócio). Só funciona se o cliente
// tiver o cronograma liberado (project_sharing_enabled).
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  const supabase = createServiceClient()

  const { data: client } = await supabase.from('clients').select('id, name, project_sharing_enabled').eq('share_token', token).maybeSingle()
  if (!client) return NextResponse.json({ error: 'Link inválido' }, { status: 404 })
  if (!client.project_sharing_enabled) {
    return NextResponse.json({ error: 'Cronograma não está disponível pra esse cliente' }, { status: 403 })
  }

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, title, description, status, deadline, responsaveis, checklist, created_at')
    .eq('client_id', client.id)
    .neq('status', 'arquivo')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    client: { id: client.id, name: client.name },
    projects: projects ?? [],
  })
}
