import { NextResponse } from 'next/server'
import { generateBriefingForRole } from '@/lib/briefing/generate'
import type { Role } from '@/lib/roles'

const DAILY_ROLES: Role[] = ['gustavo', 'gabriel', 'thomas', 'julia']

function checkAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true
  return request.headers.get('authorization') === `Bearer ${cronSecret}`
}

async function runDailyBriefings() {
  const results: Record<string, string> = {}
  for (const role of DAILY_ROLES) {
    try {
      await generateBriefingForRole(role, true)
      results[role] = 'ok'
    } catch (err) {
      results[role] = err instanceof Error ? err.message : 'erro'
    }
  }
  return results
}

// Vercel Cron dispara via GET
export async function GET(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await runDailyBriefings())
}

export async function POST(request: Request) {
  if (!checkAuth(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await runDailyBriefings())
}
