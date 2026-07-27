import { NextRequest, NextResponse } from 'next/server'
import { generateWeeklyReport } from '@/app/api/ai/weekly-report/route'

// Generates the BD learning report on demand. The actual weekly schedule
// lives inside /api/cron/check-replies (runs on Mondays) rather than as its
// own vercel.json entry, to stay within the Hobby-tier 2-cron-job cap — this
// route exists for manual runs/testing with the same CRON_SECRET auth.
export const maxDuration = 120
export const dynamic = 'force-dynamic'

function auth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return req.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!auth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await generateWeeklyReport('last_7_days')
  if ('error' in result) return NextResponse.json(result, { status: 500 })
  return NextResponse.json(result)
}
