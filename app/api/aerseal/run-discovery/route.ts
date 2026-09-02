import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAerSealDiscovery } from '@/lib/aerseal-orchestrator'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// Status for the "Run AERSeal Discovery" button/panel — no auth required,
// same convention as every other manual-trigger endpoint in this app (this is
// a private single-user tool, see lib/aerseal-customers.ts header and prior
// project notes on the no-auth RLS model).
export async function GET() {
  const supabase = client()
  const [{ data: latest }, { data: runningRows }] = await Promise.all([
    supabase.from('aerseal_discovery_runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('aerseal_discovery_runs').select('id').eq('status', 'running'),
  ])
  return NextResponse.json({ latest_run: latest || null, is_running: (runningRows?.length || 0) > 0 })
}

// The manual "Run AERSeal Discovery" action. Body: { mode?: 'manual' | 'full' }
// — 'manual' (default) reconciles everything due exactly like a full run but
// is tagged separately in the run ledger so it's clear a person, not the
// clock, triggered it; 'full' forces the same broad reconciliation the daily
// cron does. Either way this goes through the same lock as the cron routes —
// a manual click while a scheduled run is in flight is refused, not queued.
export async function POST(req: NextRequest) {
  const supabase = client()
  const body = await req.json().catch(() => ({}))
  const mode = (body?.mode === 'full' ? 'full' : 'manual') as 'full' | 'manual'

  try {
    const result = await runAerSealDiscovery(supabase, { mode, triggeredBy: 'user' })
    if ('locked' in result) {
      return NextResponse.json({ error: 'A discovery run is already in progress. Try again shortly.' }, { status: 409 })
    }
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AERSeal discovery run failed'
    console.error('[aerseal:run-discovery]', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
