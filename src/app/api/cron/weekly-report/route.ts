import { NextResponse } from 'next/server'
import { generateWeeklyReports } from '@/lib/weeklyReport/generate'

function checkAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

async function run() {
  const result = await generateWeeklyReports(true)
  return NextResponse.json(result)
}

// Vercel Cron dispara via GET
export async function GET(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return run()
}

export async function POST(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return run()
}
