// ============================================================================
// AERSeal recurring-discovery orchestrator
// ============================================================================
// The pipeline itself (harvest -> extract -> profile -> score -> gate ->
// enrich -> hypothesise -> save) already exists and is untouched:
// app/api/ai/discover-aerseal/route.ts. This module is the layer ABOVE it —
// the thing that decides WHICH surfaces to run, HOW OFTEN, with WHAT lookback
// window, and makes sure two runs never overlap. It calls discover-aerseal
// the same way every other fan-out in this codebase does (see
// app/api/cron/daily-discovery/route.ts, app/api/leads/run-all-sources/route.ts):
// an internal HTTP POST, not a direct function import — that keeps this
// module decoupled from the route's Next.js request/response types and lets
// each discover-aerseal call run under its own execution boundary.
//
// One invocation of runAerSealDiscovery() is one "run": it acquires a lock
// row in aerseal_discovery_runs, decides backfill/incremental/full/manual,
// gathers due scan targets (both the hardcoded MONITORING_SURFACES and any
// product_slug='aerseal' row in the Source Manager), scans a bounded batch of
// them with retries, updates per-target last-success state, and closes out
// the run row. One failing source never aborts the run — it's caught,
// recorded, and the loop continues.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { MONITORING_SURFACES } from '@/lib/aerseal-discovery'
import { isSourceDueByHours } from '@/lib/source-scheduling'
import {
  AERSEAL_INCREMENTAL_INTERVAL_HOURS,
  AERSEAL_MAX_SOURCES_PER_RUN,
  AERSEAL_RUN_CONCURRENCY,
  AERSEAL_STALE_LOCK_MINUTES,
  determineRunType,
  lookbackDaysFor,
  nextScanIntervalHours,
  type AersealRunMode,
  type AersealRunType,
} from '@/lib/aerseal-schedule'

// ── Scan targets ─────────────────────────────────────────────────────────
// A unified shape over the two places an AERSeal source can live: a hardcoded
// MONITORING_SURFACES entry (state tracked in aerseal_surface_state, keyed by
// surface_key) or a `sources` row (state tracked on the row itself).
type StateRef =
  | { table: 'aerseal_surface_state'; keyCol: 'surface_key'; keyVal: string }
  | { table: 'sources'; keyCol: 'id'; keyVal: string }

interface ScanTarget {
  surface_key: string // what discover-aerseal's `surface_key` body param expects
  label: string
  last_success_at: string | null
  scan_interval_hours: number | null
  stateRef: StateRef
}

async function gatherScanTargets(supabase: SupabaseClient): Promise<ScanTarget[]> {
  const [{ data: states }, { data: dbSources }] = await Promise.all([
    supabase.from('aerseal_surface_state').select('surface_key, last_success_at, scan_interval_hours'),
    supabase
      .from('sources')
      .select('id, source_name, last_success_at, scan_interval_hours')
      .eq('product_slug', 'aerseal')
      .eq('status', 'active')
      .eq('verification_only', false)
      .not('source_url_or_query', 'is', null),
  ])

  const stateByKey = new Map<string, { last_success_at: string | null; scan_interval_hours: number | null }>(
    (states || []).map((s: { surface_key: string; last_success_at: string | null; scan_interval_hours: number | null }) => [
      s.surface_key,
      { last_success_at: s.last_success_at, scan_interval_hours: s.scan_interval_hours },
    ]),
  )

  const surfaceTargets: ScanTarget[] = MONITORING_SURFACES.map(s => {
    const st = stateByKey.get(s.key)
    return {
      surface_key: s.key,
      label: s.label,
      last_success_at: st?.last_success_at ?? null,
      scan_interval_hours: st?.scan_interval_hours ?? null,
      stateRef: { table: 'aerseal_surface_state', keyCol: 'surface_key', keyVal: s.key },
    }
  })

  const dbTargets: ScanTarget[] = (dbSources || []).map(
    (s: { id: string; source_name: string; last_success_at: string | null; scan_interval_hours: number | null }) => ({
      surface_key: `db:${s.id}`,
      label: s.source_name,
      last_success_at: s.last_success_at,
      scan_interval_hours: s.scan_interval_hours,
      stateRef: { table: 'sources', keyCol: 'id', keyVal: s.id },
    }),
  )

  return [...surfaceTargets, ...dbTargets]
}

// ── Lock ─────────────────────────────────────────────────────────────────
async function acquireRunLock(
  supabase: SupabaseClient,
  runType: AersealRunType,
  triggeredBy: string,
): Promise<string | null> {
  const staleThreshold = new Date(Date.now() - AERSEAL_STALE_LOCK_MINUTES * 60_000).toISOString()

  const { data: runningRows } = await supabase
    .from('aerseal_discovery_runs')
    .select('id')
    .eq('status', 'running')
    .gte('started_at', staleThreshold)
  if (runningRows && runningRows.length > 0) return null

  // A 'running' row older than the stale threshold almost certainly means the
  // invocation that owned it crashed or hit the serverless timeout without
  // ever reaching the finally-style update at the end of this function. Left
  // alone it would lock out every future run forever, so it gets marked
  // failed here rather than treated as evidence a run is still in progress.
  await supabase
    .from('aerseal_discovery_runs')
    .update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      errors: [{ source: '(orchestrator)', error: `Marked failed — still 'running' past the ${AERSEAL_STALE_LOCK_MINUTES}-minute stale-lock threshold.` }],
    })
    .eq('status', 'running')
    .lt('started_at', staleThreshold)

  const { data: row, error } = await supabase
    .from('aerseal_discovery_runs')
    .insert({ run_type: runType, status: 'running', triggered_by: triggeredBy })
    .select('id')
    .single()
  if (error || !row) throw new Error(`Failed to create AERSeal run lock: ${error?.message || 'no row returned'}`)
  return row.id
}

// ── Discover-aerseal call, with retry + exponential backoff ────────────────
function resolveAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'https://kima-bd-os.vercel.app'
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface DiscoverAersealResponse {
  saved?: number
  profiled?: number
  candidates_found?: number
  tier_1?: number
  tier_2?: number
  tier_3?: number
  error?: string
}

async function callDiscoverAerseal(
  appUrl: string,
  target: ScanTarget,
  lookbackDays: number,
  attempts = 3,
): Promise<{ ok: true; data: DiscoverAersealResponse } | { ok: false; error: string }> {
  let lastErr = 'unknown error'
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(`${appUrl}/api/ai/discover-aerseal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surface_key: target.surface_key,
          dry_run: false,
          deep_crawl: false,
          research_ai: 'claude',
          lookback_days: lookbackDays,
        }),
      })
      const data = (await res.json().catch(() => null)) as DiscoverAersealResponse | null
      if (res.ok && data) return { ok: true, data }
      lastErr = data?.error || `HTTP ${res.status}`
      // Client errors (bad probe, missing key, unknown surface) won't be
      // fixed by retrying — only retry on transient/server-side failure.
      if (res.status >= 400 && res.status < 500) break
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'network error'
    }
    if (attempt < attempts - 1) await sleep(1000 * 2 ** attempt)
  }
  return { ok: false, error: lastErr }
}

// ── Per-target state update (last-success cursor, yield counters, throttle) ─
async function recordScanOutcome(
  supabase: SupabaseClient,
  target: ScanTarget,
  outcome: { ok: boolean; saved?: number; profiled?: number; error?: string },
): Promise<void> {
  const now = new Date().toISOString()
  const { table, keyCol, keyVal } = target.stateRef

  const { data: current } = await supabase
    .from(table)
    .select('total_runs, leads_generated, companies_evaluated, consecutive_failures, scan_interval_hours')
    .eq(keyCol, keyVal)
    .maybeSingle()

  const totalRuns = (current?.total_runs || 0) + 1
  const leadsGenerated = (current?.leads_generated || 0) + (outcome.saved || 0)
  const companiesEvaluated = (current?.companies_evaluated || 0) + (outcome.profiled || 0)

  const update: Record<string, unknown> = {
    last_run_at: now,
    total_runs: totalRuns,
    leads_generated: leadsGenerated,
    companies_evaluated: companiesEvaluated,
  }
  if (table === 'aerseal_surface_state') update.updated_at = now

  if (outcome.ok) {
    update.last_success_at = now
    update.consecutive_failures = 0
    update.last_error = null
  } else {
    update.consecutive_failures = (current?.consecutive_failures || 0) + 1
    update.last_error = (outcome.error || 'Unknown error').slice(0, 500)
  }

  const widened = nextScanIntervalHours(totalRuns, leadsGenerated, current?.scan_interval_hours)
  if (widened != null) update.scan_interval_hours = widened

  if (table === 'sources') {
    // Row may have been deleted/paused between gather and record — don't
    // throw the whole run over a single missing row.
    await supabase.from('sources').update(update).eq('id', keyVal)
  } else {
    // aerseal_surface_state rows are shadow state for code-defined surfaces
    // and don't pre-exist — upsert creates the row on first sight.
    await supabase.from('aerseal_surface_state').upsert({ surface_key: keyVal, ...update })
  }
}

// ── Public entry point ──────────────────────────────────────────────────────
export interface AersealRunSummary {
  run_id: string
  run_type: AersealRunType
  lookback_days: number
  sources_scanned: number
  sources_skipped_not_due: number
  sources_failed: number
  leads_created: number
  candidates_found: number
  tier1_count: number
  tier2_count: number
  tier3_count: number
  errors: Array<{ source: string; error: string }>
  started_at: string
  finished_at: string
}

export async function runAerSealDiscovery(
  supabase: SupabaseClient,
  opts: { mode: AersealRunMode; triggeredBy: string },
): Promise<AersealRunSummary | { locked: true }> {
  const { data: priorFullRuns } = await supabase
    .from('aerseal_discovery_runs')
    .select('id')
    .eq('status', 'completed')
    .in('run_type', ['backfill', 'full', 'manual'])
    .limit(1)
  const hasPriorFullRun = !!(priorFullRuns && priorFullRuns.length > 0)
  const runType = determineRunType(opts.mode, hasPriorFullRun)

  const startedAt = new Date().toISOString()
  const lockId = await acquireRunLock(supabase, runType, opts.triggeredBy)
  if (!lockId) return { locked: true }

  try {
    const lookbackDays = lookbackDaysFor(runType)
    const allTargets = await gatherScanTargets(supabase)
    const dueTargets =
      runType === 'incremental'
        ? allTargets.filter(t =>
            isSourceDueByHours(
              { scan_interval_hours: t.scan_interval_hours, last_success_at: t.last_success_at },
              AERSEAL_INCREMENTAL_INTERVAL_HOURS,
            ),
          )
        : allTargets // backfill / full / manual: reconcile everything, ignore per-target cadence

    // Prioritize the most stale first (nulls — never successfully scanned —
    // sort first) so coverage rotates fairly across cycles rather than the
    // same handful of alphabetically-first sources winning every run.
    dueTargets.sort((a, b) => {
      const at = a.last_success_at ? new Date(a.last_success_at).getTime() : -1
      const bt = b.last_success_at ? new Date(b.last_success_at).getTime() : -1
      return at - bt
    })
    const batch = dueTargets.slice(0, AERSEAL_MAX_SOURCES_PER_RUN)

    const appUrl = resolveAppUrl()
    let sourcesScanned = 0
    let sourcesFailed = 0
    let leadsCreated = 0
    let candidatesFound = 0
    let tier1Count = 0
    let tier2Count = 0
    let tier3Count = 0
    const errors: Array<{ source: string; error: string }> = []

    for (let i = 0; i < batch.length; i += AERSEAL_RUN_CONCURRENCY) {
      const slice = batch.slice(i, i + AERSEAL_RUN_CONCURRENCY)
      await Promise.all(
        slice.map(async target => {
          const res = await callDiscoverAerseal(appUrl, target, lookbackDays)
          sourcesScanned++
          if (res.ok) {
            leadsCreated += res.data.saved || 0
            candidatesFound += res.data.candidates_found || 0
            tier1Count += res.data.tier_1 || 0
            tier2Count += res.data.tier_2 || 0
            tier3Count += res.data.tier_3 || 0
            await recordScanOutcome(supabase, target, { ok: true, saved: res.data.saved, profiled: res.data.profiled })
          } else {
            sourcesFailed++
            errors.push({ source: target.label, error: res.error })
            await recordScanOutcome(supabase, target, { ok: false, error: res.error })
          }
        }),
      )
    }

    const finishedAt = new Date().toISOString()
    const sourcesSkipped = allTargets.length - dueTargets.length
    await supabase
      .from('aerseal_discovery_runs')
      .update({
        status: 'completed',
        finished_at: finishedAt,
        lookback_days: lookbackDays,
        sources_scanned: sourcesScanned,
        sources_skipped: sourcesSkipped,
        sources_failed: sourcesFailed,
        leads_created: leadsCreated,
        candidates_found: candidatesFound,
        tier1_count: tier1Count,
        tier2_count: tier2Count,
        tier3_count: tier3Count,
        errors,
      })
      .eq('id', lockId)

    return {
      run_id: lockId,
      run_type: runType,
      lookback_days: lookbackDays,
      sources_scanned: sourcesScanned,
      sources_skipped_not_due: sourcesSkipped,
      sources_failed: sourcesFailed,
      leads_created: leadsCreated,
      candidates_found: candidatesFound,
      tier1_count: tier1Count,
      tier2_count: tier2Count,
      tier3_count: tier3Count,
      errors,
      started_at: startedAt,
      finished_at: finishedAt,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'AERSeal discovery run failed'
    await supabase
      .from('aerseal_discovery_runs')
      .update({ status: 'failed', finished_at: new Date().toISOString(), errors: [{ source: '(orchestrator)', error: message }] })
      .eq('id', lockId)
    throw e
  }
}
