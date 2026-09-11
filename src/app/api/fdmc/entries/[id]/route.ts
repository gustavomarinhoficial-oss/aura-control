import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getRole, canAccessFdmc } from '@/lib/roles'

async function requireFdmcAccess() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const role = getRole(user.user_metadata)
  if (!canAccessFdmc(role)) return null
  return user
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireFdmcAccess())) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase.from('fdmc_entries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
