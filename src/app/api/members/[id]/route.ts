import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServiceClient()
  const { id } = await params
  const { error } = await supabase.from('members').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
