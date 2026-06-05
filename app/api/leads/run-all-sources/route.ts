import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// The previous fire-and-forget IIFE pattern doesn't work on Vercel — the
// function is killed the moment the response is sent, so no leads were ever
// saved. We now await all the work before returning. The UI loading state
// handles the wait, and maxDuration keeps us alive for the full run.
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const { data: sources } = await supabase
      .from('sources')
      .select('id, source_name')
      .eq('status', 'active')
      .not('source_url_or_query', 'is', null)

    if (!sources?.length) {
      return NextResponse.json({ error: 'No active sources. Add some in Discovery Sources.' }, { status: 400 })
    }

    // Create the job record so the UI can track progress.
    const { data: job } = await supabase
      .from('discovery_jobs')
      .insert({ status: 'running', sources_total: sources.length, sources_done: 0, leads_saved: 0 })
      .select('id')
      .single()

    const jobId = job?.id
    // Resolve the correct base URL so the self-call to /api/ai/discover works
    // whether we're on Vercel production, a preview deploy, or local dev.
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null) ||
      'https://kima-bd-os.vercel.app'

    // Fire all sources in PARALLEL so total time ≈ slowest single source
    // (~40s with 8 companies each), not sum of all sources. This keeps us
    // within Vercel Hobby's 60s per-function timeout.
    const settled = await Promise.allSettled(
      sources.map(source =>
        fetch(`${appUrl}/api/ai/discover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_id: source.id }),
        })
          .then(r => r.json())
          .catch(() => ({ saved: 0, error: 'fetch failed' }))
      )
    )

    const totalSaved = settled.reduce((sum, r) =>
      sum + (r.status === 'fulfilled' ? (r.value?.saved || 0) : 0), 0)
    const done = sources.length

    if (jobId) {
      await supabase.from('discovery_jobs')
        .update({ status: 'done', sources_done: done, leads_saved: totalSaved, finished_at: new Date().toISOString() })
        .eq('id', jobId)
    }

    return NextResponse.json({ started: true, done: true, job_id: jobId, sources: sources.length, leads_saved: totalSaved })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to start discovery'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Returns the most recent job status for the polling UI.
export async function GET() {
  const { data } = await supabase
    .from('discovery_jobs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()
  return NextResponse.json(data || null)
}
