import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAerpoliceDiscovery } from '@/lib/aerpolice-orchestrator'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// Status + short history for the "Run Aerpolice Discovery" button/panel.
export async function GET() {
  const supabase = client()
  const [{ data: recent }, { data: runningRows }] = await Promise.all([
    supabase.from('aerpolice_discovery_runs').select('*').order('started_at', { ascending: false }).limit(10),
    supabase.from('aerpolice_discovery_runs').select('id').eq('status', 'running'),
  ])
  return NextResponse.json({
    latest_run: recent?.[0] || null,
    recent_runs: recent || [],
    is_running: (runningRows?.length || 0) > 0,
  })
}

// The ONLY way this pipeline ever runs — a person clicking the button. There
// is no cron for Aerpolice discovery; see lib/aerpolice-orchestrator.ts.
export async function POST() {
  const supabase = client()
  try {
    const result = await runAerpoliceDiscovery(supabase, { triggeredBy: 'user' })
    if ('locked' in result) {
      return NextResponse.json({ error: 'A discovery run is already in progress. Try again shortly.' }, { status: 409 })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Aerpolice discovery run failed'
    console.error('[aerpolice:run-discovery]', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
