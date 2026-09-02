// ============================================================================
// Aerpolice recurring-discovery orchestrator — MANUAL TRIGGER ONLY
// ============================================================================
// Deliberately simpler than lib/aerseal-orchestrator.ts: there is no cron
// registered for this pipeline (see vercel.json — Aerpolice discovery is not
// in the crons array, and per project policy it must never be added without
// asking first; a 6-hourly AERSeal cron already broke every Vercel deploy for
// ~5 hours on the Hobby plan once). Every run here is triggered by a person
// clicking "Run Aerpolice Discovery," so there is no backfill/incremental/
// full distinction to make — one run type, 'manual', always.
//
// What IS shared with the AERSeal orchestrator: the lock (one run at a time),
// per-source due-checking so a source isn't re-scanned the same day it was
// just run, batching + retry so one bad source can't sink the whole run, and
// a run ledger for history.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js'
import { isSourceDue } from '@/lib/source-scheduling'

const envInt = (name: string, fallback: number): number => {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// Daily sources look back 7 days, weekly sources look back 30 — per the spec.
export const AERPOLICE_DAILY_LOOKBACK_DAYS = envInt('AERPOLICE_DAILY_LOOKBACK_DAYS', 7)
export const AERPOLICE_WEEKLY_LOOKBACK_DAYS = envInt('AERPOLICE_WEEKLY_LOOKBACK_DAYS', 30)
export const AERPOLICE_MAX_SOURCES_PER_RUN = envInt('AERPOLICE_MAX_SOURCES_PER_RUN', 6)
export const AERPOLICE_RUN_CONCURRENCY = envInt('AERPOLICE_RUN_CONCURRENCY', 2)
export const AERPOLICE_STALE_LOCK_MINUTES = envInt('AERPOLICE_STALE_LOCK_MINUTES', 20)

interface ScanTarget {
  id: string
  label: string
  frequency: string | null
  last_run_at: string | null
}

function lookbackDaysFor(frequency: string | null): number {
  return frequency === 'weekly' ? AERPOLICE_WEEKLY_LOOKBACK_DAYS : AERPOLICE_DAILY_LOOKBACK_DAYS
}

async function gatherDueTargets(supabase: SupabaseClient): Promise<{ due: ScanTarget[]; total: number }> {
  const { data: sources } = await supabase
    .from('sources')
    .select('id, source_name, frequency, last_run_at')
    .eq('product_slug', 'aerpolice')
    .eq('status', 'active')
    .not('source_url_or_query', 'is', null)

  const all: ScanTarget[] = (sources || []).map(
    (s: { id: string; source_name: string; frequency: string | null; last_run_at: string | null }) => ({
      id: s.id, label: s.source_name, frequency: s.frequency, last_run_at: s.last_run_at,
    }),
  )
  const due = all.filter(t => isSourceDue({ frequency: t.frequency, last_run_at: t.last_run_at }, 'manual'))
  // Oldest-scanned first, so coverage rotates fairly across clicks rather
  // than the same alphabetically-first sources winning every run.
  due.sort((a, b) => {
    const at = a.last_run_at ? new Date(a.last_run_at).getTime() : -1
    const bt = b.last_run_at ? new Date(b.last_run_at).getTime() : -1
    return at - bt
  })
  return { due, total: all.length }
}

async function acquireRunLock(supabase: SupabaseClient, triggeredBy: string): Promise<string | null> {
  const staleThreshold = new Date(Date.now() - AERPOLICE_STALE_LOCK_MINUTES * 60_000).toISOString()

  const { data: runningRows } = await supabase
    .from('aerpolice_discovery_runs')
    .select('id')
    .eq('status', 'running')
    .gte('started_at', staleThreshold)
  if (runningRows && runningRows.length > 0) return null

  // A run stuck 'running' past the stale threshold almost certainly crashed
  // or hit the serverless timeout — mark it failed rather than let it lock
  // out every future click forever.
  await supabase
    .from('aerpolice_discovery_runs')
    .update({
      status: 'failed', finished_at: new Date().toISOString(),
      errors: [{ source: '(orchestrator)', error: `Marked failed — still 'running' past the ${AERPOLICE_STALE_LOCK_MINUTES}-minute stale-lock threshold.` }],
    })
    .eq('status', 'running')
    .lt('started_at', staleThreshold)

  const { data: row, error } = await supabase
    .from('aerpolice_discovery_runs')
    .insert({ run_type: 'manual', status: 'running', triggered_by: triggeredBy })
    .select('id')
    .single()
  if (error || !row) throw new Error(`Failed to create Aerpolice run lock: ${error?.message || 'no row returned'}`)
  return row.id
}

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

interface DiscoverAerpoliceResponse {
  saved?: number; candidates_found?: number; profiled?: number
  tier_1?: number; tier_2?: number; tier_3?: number
  contact_now?: number; validate_then_send?: number; monitor?: number
  error?: string
}

async function callDiscoverAerpolice(
  appUrl: string, target: ScanTarget, lookbackDays: number, attempts = 3,
): Promise<{ ok: true; data: DiscoverAerpoliceResponse } | { ok: false; error: string }> {
  let lastErr = 'unknown error'
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(`${appUrl}/api/ai/discover-aerpolice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: target.id, dry_run: false, research_ai: 'claude', lookback_days: lookbackDays }),
      })
      const data = (await res.json().catch(() => null)) as DiscoverAerpoliceResponse | null
      if (res.ok && data) return { ok: true, data }
      lastErr = data?.error || `HTTP ${res.status}`
      if (res.status >= 400 && res.status < 500) break
    } catch (e) {
      lastErr = e instanceof Error ? e.message : 'network error'
    }
    if (attempt < attempts - 1) await sleep(1000 * 2 ** attempt)
  }
  return { ok: false, error: lastErr }
}

async function recordScanOutcome(supabase: SupabaseClient, target: ScanTarget, outcome: { ok: boolean; saved?: number; profiled?: number; error?: string }): Promise<void> {
  const now = new Date().toISOString()
  const { data: current } = await supabase
    .from('sources')
    .select('total_runs, leads_generated, companies_evaluated, consecutive_failures')
    .eq('id', target.id)
    .maybeSingle()

  const update: Record<string, unknown> = {
    last_run_at: now,
    total_runs: (current?.total_runs || 0) + 1,
    leads_generated: (current?.leads_generated || 0) + (outcome.saved || 0),
    companies_evaluated: (current?.companies_evaluated || 0) + (outcome.profiled || 0),
  }
  if (outcome.ok) {
    update.last_success_at = now
    update.consecutive_failures = 0
    update.last_error = null
  } else {
    update.consecutive_failures = (current?.consecutive_failures || 0) + 1
    update.last_error = (outcome.error || 'Unknown error').slice(0, 500)
  }
  await supabase.from('sources').update(update).eq('id', target.id)
}

export interface AerpoliceRunSummary {
  run_id: string
  sources_scanned: number
  sources_skipped_not_due: number
  sources_failed: number
  leads_created: number
  candidates_found: number
  tier1_count: number
  tier2_count: number
  tier3_count: number
  contact_now_count: number
  validate_then_send_count: number
  monitor_count: number
  errors: Array<{ source: string; error: string }>
  started_at: string
  finished_at: string
}

export async function runAerpoliceDiscovery(
  supabase: SupabaseClient, opts: { triggeredBy: string },
): Promise<AerpoliceRunSummary | { locked: true }> {
  const startedAt = new Date().toISOString()
  const lockId = await acquireRunLock(supabase, opts.triggeredBy)
  if (!lockId) return { locked: true }

  try {
    const { due, total } = await gatherDueTargets(supabase)
    const batch = due.slice(0, AERPOLICE_MAX_SOURCES_PER_RUN)

    const appUrl = resolveAppUrl()
    let sourcesScanned = 0, sourcesFailed = 0, leadsCreated = 0, candidatesFound = 0
    let tier1Count = 0, tier2Count = 0, tier3Count = 0
    let contactNowCount = 0, validateThenSendCount = 0, monitorCount = 0
    const errors: Array<{ source: string; error: string }> = []

    for (let i = 0; i < batch.length; i += AERPOLICE_RUN_CONCURRENCY) {
      const slice = batch.slice(i, i + AERPOLICE_RUN_CONCURRENCY)
      await Promise.all(slice.map(async target => {
        const lookbackDays = lookbackDaysFor(target.frequency)
        const res = await callDiscoverAerpolice(appUrl, target, lookbackDays)
        sourcesScanned++
        if (res.ok) {
          leadsCreated += res.data.saved || 0
          candidatesFound += res.data.candidates_found || 0
          tier1Count += res.data.tier_1 || 0
          tier2Count += res.data.tier_2 || 0
          tier3Count += res.data.tier_3 || 0
          contactNowCount += res.data.contact_now || 0
          validateThenSendCount += res.data.validate_then_send || 0
          monitorCount += res.data.monitor || 0
          await recordScanOutcome(supabase, target, { ok: true, saved: res.data.saved, profiled: res.data.profiled })
        } else {
          sourcesFailed++
          errors.push({ source: target.label, error: res.error })
          await recordScanOutcome(supabase, target, { ok: false, error: res.error })
        }
      }))
    }

    const finishedAt = new Date().toISOString()
    const sourcesSkipped = total - due.length
    await supabase.from('aerpolice_discovery_runs').update({
      status: 'completed', finished_at: finishedAt,
      sources_scanned: sourcesScanned, sources_skipped: sourcesSkipped, sources_failed: sourcesFailed,
      leads_created: leadsCreated, candidates_found: candidatesFound,
      tier1_count: tier1Count, tier2_count: tier2Count, tier3_count: tier3Count,
      contact_now_count: contactNowCount, validate_then_send_count: validateThenSendCount, monitor_count: monitorCount,
      errors,
    }).eq('id', lockId)

    return {
      run_id: lockId, sources_scanned: sourcesScanned, sources_skipped_not_due: sourcesSkipped, sources_failed: sourcesFailed,
      leads_created: leadsCreated, candidates_found: candidatesFound,
      tier1_count: tier1Count, tier2_count: tier2Count, tier3_count: tier3Count,
      contact_now_count: contactNowCount, validate_then_send_count: validateThenSendCount, monitor_count: monitorCount,
      errors, started_at: startedAt, finished_at: finishedAt,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Aerpolice discovery run failed'
    await supabase.from('aerpolice_discovery_runs').update({
      status: 'failed', finished_at: new Date().toISOString(),
      errors: [{ source: '(orchestrator)', error: message }],
    }).eq('id', lockId)
    throw e
  }
}
