import { createClient } from '@/lib/supabase/server'
import { getRole, canAccessFdmc } from '@/lib/roles'

// FDMC Hub é privado (só Gustavo e Gabriel) — o proxy já bloqueia /api/fdmc/*
// pra outros papéis, mas cada rota confere de novo direto no dado sensível.
export async function requireFdmcAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const role = getRole(user.user_metadata)
  if (!canAccessFdmc(role)) return null
  return user
}
