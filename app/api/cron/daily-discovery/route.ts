import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// This fans out to /api/ai/discover for every source and awaits each, so it needs
// the longest allowed runtime. Without it the cron is killed at the default
// timeout and only the first source (if any) gets processed.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// This route is called by Vercel Cron every day at 06:00 IST (00:30 UTC)
// It loops through all active sources and triggers the discover pipeline for each
export async function GET(req: NextRequest) {
  // Security: verify the cron secret so only Vercel (or you) can trigger this
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all active sources that have a URL configured
  const { data: sources, error } = await supabase
    .from('sources')
    .select('id, source_name, source_url_or_query')
    .eq('status', 'active')
    .not('source_url_or_query', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!sources || sources.length === 0) {
    return NextResponse.json({ message: 'No active sources to process', processed: 0 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kima-bd-os.vercel.app'
  const results = []

  // Process each source one by one (sequential to avoid rate limits)
  for (const source of sources) {
    try {
      const res = await fetch(`${appUrl}/api/ai/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: source.id }),
      })
      const data = await res.json()
      results.push({ source: source.source_name, ...data })
    } catch (e) {
      results.push({
        source: source.source_name,
        error: e instanceof Error ? e.message : 'Failed',
      })
    }
  }

  const totalSaved = results.reduce((sum, r) => sum + (r.saved || 0), 0)

  return NextResponse.json({
    success: true,
    run_at: new Date().toISOString(),
    sources_processed: sources.length,
    total_leads_saved: totalSaved,
    results,
  })
}
