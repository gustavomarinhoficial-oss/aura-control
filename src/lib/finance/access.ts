import { createClient } from '@/lib/supabase/server'
import { requireFdmcAccess } from '@/lib/fdmc/auth'
import { getRole, isFinanceRestricted } from '@/lib/roles'

// Quem pode ver/mexer nos números de cada empresa: FDMC só Gustavo e Gabriel;
// OWL qualquer logado, menos Julia e Mari (sem acesso a financeiro).
export async function canAccessFinance(workspace: string): Promise<boolean> {
  if (workspace === 'fdmc') return !!(await requireFdmcAccess())
  if (workspace !== 'owl') return false
  const { data: { user } } = await (await createClient()).auth.getUser()
  return !!user && !isFinanceRestricted(getRole(user.user_metadata))
}
