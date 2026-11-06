import { createHash } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

// Só a equipe OWL tem o token. No banco fica apenas o hash (SHA-256): se o banco vazar, o token não vaza.
// Para trocar o token: crie um novo e marque o antigo como revogado (revoked_at).
export async function verifyToken(token: string | null | undefined): Promise<boolean> {
  if (!token || token.length < 32 || token.length > 200) return false
  const db = createServiceClient()
  const { data } = await db
    .from('mcp_tokens')
    .select('id')
    .eq('token_hash', hashToken(token))
    .is('revoked_at', null)
    .maybeSingle()
  if (!data) return false
  // marca o último uso (não bloqueia a resposta)
  void db.from('mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
  return true
}
