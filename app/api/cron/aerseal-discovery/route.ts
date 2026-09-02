import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAerSealDiscovery } from '@/lib/aerseal-orchestrator'

// Same budget as discover-aerseal itself — this route fans out to it
// sequentially/in small batches (see lib/aerseal-orchestrator.ts) and needs
// the same headroom, not the platform default.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

// Vercel Cron entry points (see vercel.json):
//   GET /api/cron/aerseal-discovery?mode=incremental   — every 6h
//   GET /api/cron/aerseal-discovery?mode=full           — daily ~08:00 IST
//
// The very first successful invocation of EITHER schedule always runs as a
// 30-day backfill regardless of `mode` — see determineRunType in
// lib/aerseal-schedule.ts. Concurrency is handled by the orchestrator's lock
// (aerseal_discovery_runs): if a run is already in progress this returns
// {skipped:true} rather than starting a second one.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const modeParam = req.nextUrl.searchParams.get('mode')
  const mode = modeParam === 'full' ? 'full' : 'incremental'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  try {
    const result = await runAerSealDiscovery(supabase, { mode, triggeredBy: 'cron' })
    if ('locked' in result) {
      return NextResponse.json({ skipped: true, reason: 'Another AERSeal discovery run is already in progress.' })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AERSeal discovery cron failed'
    console.error('[cron:aerseal-discovery]', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
