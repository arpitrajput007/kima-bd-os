// ============================================================================
// AERSeal recurring-discovery configuration & pure scheduling logic
// ============================================================================
// Kept separate from lib/aerseal-orchestrator.ts (which does I/O — Supabase
// reads/writes, HTTP calls to discover-aerseal) so the actual scheduling
// DECISIONS are plain, synchronous, unit-testable functions with no network
// or database dependency. lib/source-scheduling.ts's isSourceDue /
// isSourceDueByHours are the same idea for the older daily/weekly cadence and
// the new hour-granularity one respectively; this module is what sits above
// them and decides backfill vs incremental vs full.
// ============================================================================

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// ── Configurable via environment variables — see README/docs for defaults ──
export const AERSEAL_BACKFILL_DAYS = envInt('AERSEAL_BACKFILL_DAYS', 30)
export const AERSEAL_INCREMENTAL_LOOKBACK_HOURS = envInt('AERSEAL_INCREMENTAL_LOOKBACK_HOURS', 24)
export const AERSEAL_FULL_LOOKBACK_DAYS = envInt('AERSEAL_FULL_LOOKBACK_DAYS', 240)
export const AERSEAL_INCREMENTAL_INTERVAL_HOURS = envInt('AERSEAL_INCREMENTAL_INTERVAL_HOURS', 6)
// Sources scanned per single invocation. Each discover-aerseal call is a live
// crawl plus one-to-several LLM calls and can take 1-3 minutes; a serverless
// function has a hard wall-clock budget (maxDuration=300 on this route, same
// as discover-aerseal itself). Keeping this small and running every 6 hours
// means full coverage rotates across cycles (gatherScanTargets sorts by
// staleness, oldest last_success_at first) rather than trying to fit
// everything into one invocation and timing out.
export const AERSEAL_MAX_SOURCES_PER_RUN = envInt('AERSEAL_MAX_SOURCES_PER_RUN', 4)
export const AERSEAL_RUN_CONCURRENCY = envInt('AERSEAL_RUN_CONCURRENCY', 2)
// A run stuck in 'running' past this long is treated as crashed/timed-out,
// not as a live lock — otherwise one dead invocation would permanently block
// every future scheduled and manual run.
export const AERSEAL_STALE_LOCK_MINUTES = envInt('AERSEAL_STALE_LOCK_MINUTES', 20)
// Low-yield throttling — same threshold shape as the Source Manager UI's own
// MIN_SAMPLE_FOR_YIELD_JUDGMENT / LOW_YIELD_THRESHOLD (app/(dashboard)/sources/page.tsx),
// applied automatically here rather than left for a human to notice.
export const AERSEAL_LOW_YIELD_MIN_RUNS = envInt('AERSEAL_LOW_YIELD_MIN_RUNS', 10)
export const AERSEAL_LOW_YIELD_THRESHOLD = Number(process.env.AERSEAL_LOW_YIELD_THRESHOLD) || 0.05
export const AERSEAL_MAX_SCAN_INTERVAL_HOURS = envInt('AERSEAL_MAX_SCAN_INTERVAL_HOURS', 96)

export type AersealRunMode = 'incremental' | 'full' | 'manual'
export type AersealRunType = 'backfill' | 'incremental' | 'full' | 'manual'

/**
 * Decide the actual run type to execute. Pure function — the "has a
 * backfill/full/manual run ever completed" check is done by the caller
 * (a DB query) and passed in as a boolean so this stays synchronous and
 * trivially testable.
 *
 * The very first successful run of the system, regardless of which cron
 * fired it, is always a backfill: an incremental 24h-lookback run against an
 * empty history would miss the 29 days of triggers the spec asks for.
 */
export function determineRunType(mode: AersealRunMode, hasPriorFullRun: boolean): AersealRunType {
  if (!hasPriorFullRun) return 'backfill'
  if (mode === 'manual') return 'manual'
  if (mode === 'full') return 'full'
  return 'incremental'
}

/** Lookback window (in days) to bias the harvest/extraction stage toward. */
export function lookbackDaysFor(runType: AersealRunType): number {
  switch (runType) {
    case 'backfill': return AERSEAL_BACKFILL_DAYS
    case 'incremental': return AERSEAL_INCREMENTAL_LOOKBACK_HOURS / 24
    case 'full':
    case 'manual':
    default:
      return AERSEAL_FULL_LOOKBACK_DAYS
  }
}

/**
 * Given a target's current sample (runs, leads produced), decide whether its
 * scan_interval_hours should widen (throttle) and by how much. Returns null
 * when no change is warranted. Doubling with a cap avoids a single bad run
 * (e.g. a transient outage that yields zero) permanently silencing a source —
 * it only kicks in once AERSEAL_LOW_YIELD_MIN_RUNS gives a real sample.
 */
export function nextScanIntervalHours(
  totalRuns: number,
  leadsGenerated: number,
  currentIntervalHours: number | null | undefined,
): number | null {
  if (totalRuns < AERSEAL_LOW_YIELD_MIN_RUNS) return null
  const yieldRate = leadsGenerated / totalRuns
  if (yieldRate >= AERSEAL_LOW_YIELD_THRESHOLD) return null
  const base = currentIntervalHours && currentIntervalHours > 0 ? currentIntervalHours : AERSEAL_INCREMENTAL_INTERVAL_HOURS
  return Math.min(AERSEAL_MAX_SCAN_INTERVAL_HOURS, base * 2)
}
