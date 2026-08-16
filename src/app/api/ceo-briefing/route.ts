import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRole } from '@/lib/roles'
import { generateBriefingForRole } from '@/lib/briefing/generate'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const force = searchParams.get('force') === 'true'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = getRole(user.user_metadata)

  try {
    const briefing = await generateBriefingForRole(role, force)
    return NextResponse.json(briefing)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro inesperado' }, { status: 500 })
  }
}
