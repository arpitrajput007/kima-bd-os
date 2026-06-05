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
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://kima-bd-os.vercel.app'

    // Process each source sequentially and await it — the response is held
    // open until all sources are done (maxDuration = 300s keeps us alive).
    let totalSaved = 0
    let done = 0
    for (const source of sources) {
      try {
        const res = await fetch(`${appUrl}/api/ai/discover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source_id: source.id }),
        })
        const data = await res.json()
        totalSaved += data.saved || 0
      } catch { /* one source failing shouldn't stop the rest */ }
      done++
      if (jobId) {
        await supabase.from('discovery_jobs')
          .update({ sources_done: done, leads_saved: totalSaved })
          .eq('id', jobId)
      }
    }

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
