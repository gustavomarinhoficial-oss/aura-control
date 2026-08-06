import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('ai_resources')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createServiceClient()
  const body = await request.json()
  const { data, error } = await supabase
    .from('ai_resources')
    .insert({
      title:       body.title,
      description: body.description || null,
      category:    body.category || 'prompt',
      content:     body.content || null,
      link:        body.link || null,
      tags:        body.tags ?? [],
      author:      body.author || null,
      featured:    body.featured ?? false,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
