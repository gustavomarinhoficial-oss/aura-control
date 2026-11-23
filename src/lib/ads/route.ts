import { NextResponse } from 'next/server'
import { ToolError } from '@/lib/mcp/errors'
import { canManageAds } from './server'

// Embrulho das rotas internas: confere acesso e transforma erro de validação em 400 com a mensagem
export async function adsRoute(fn: () => Promise<Response>): Promise<Response> {
  if (!(await canManageAds())) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ToolError) return NextResponse.json({ error: e.message }, { status: 400 })
    const msg = e instanceof Error ? e.message : 'Erro interno'
    const missing = /ad_campaigns|ad_creatives/.test(msg) && /does not exist|schema cache/.test(msg)
    return NextResponse.json({ error: missing ? 'Falta rodar o SQL da migration 059 (criativos de tráfego) no Supabase.' : msg }, { status: 500 })
  }
}

export function dbError(error: { message: string } | null): never | void {
  if (error) throw new Error(error.message)
}
