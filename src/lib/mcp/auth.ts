import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

// Só a equipe OWL tem o token. No banco fica apenas o hash (SHA-256): se o banco vazar, o token não vaza.
// Para trocar o token: crie um novo e marque o antigo como revogado (revoked_at).
// Devolve os escopos do token ("conteudo", "financeiro") ou null se o token não vale.
export async function verifyToken(token: string | null | undefined): Promise<string[] | null> {
  if (!token || token.length < 32 || token.length > 200) return null
  const db = createServiceClient()
  const find = (cols: string) => db.from('mcp_tokens').select(cols).eq('token_hash', hashToken(token)).is('revoked_at', null).maybeSingle()
  let res = await find('id, scopes')
  if (res.error) res = await find('id') // antes da migration 058 (sem escopos): só conteúdo
  const row = res.data as { id: string; scopes?: string[] | null } | null
  if (!row) return null
  // marca o último uso (não bloqueia a resposta)
  void db.from('mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', row.id)
  return row.scopes?.length ? row.scopes : ['conteudo']
}
