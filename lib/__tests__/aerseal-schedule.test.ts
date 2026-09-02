// ============================================================================
// Tests for the pure scheduling-decision logic in lib/aerseal-schedule.ts —
// backfill vs incremental vs full/manual, lookback windows, and low-yield
// throttling. No I/O here (that's lib/aerseal-orchestrator.ts, which needs a
// live Supabase client); this is just "given these inputs, what does the
// scheduler decide", which is exactly what a recurring system needs covered.
// ============================================================================

import { describe, it, expect } from 'vitest'
import {
  determineRunType,
  lookbackDaysFor,
  nextScanIntervalHours,
  AERSEAL_BACKFILL_DAYS,
  AERSEAL_INCREMENTAL_LOOKBACK_HOURS,
  AERSEAL_FULL_LOOKBACK_DAYS,
  AERSEAL_INCREMENTAL_INTERVAL_HOURS,
  AERSEAL_LOW_YIELD_MIN_RUNS,
  AERSEAL_MAX_SCAN_INTERVAL_HOURS,
} from '@/lib/aerseal-schedule'

describe('determineRunType', () => {
  it('always backfills on the very first run, regardless of requested mode', () => {
    expect(determineRunType('incremental', false)).toBe('backfill')
    expect(determineRunType('full', false)).toBe('backfill')
    expect(determineRunType('manual', false)).toBe('backfill')
  })

  it('runs incremental when a prior full/backfill/manual run exists and mode is incremental', () => {
    expect(determineRunType('incremental', true)).toBe('incremental')
  })

  it('runs full reconciliation when requested and history exists', () => {
    expect(determineRunType('full', true)).toBe('full')
  })

  it('tags a manual trigger as manual once history exists', () => {
    expect(determineRunType('manual', true)).toBe('manual')
  })
})

describe('lookbackDaysFor', () => {
  it('backfill uses AERSEAL_BACKFILL_DAYS (default 30)', () => {
    expect(lookbackDaysFor('backfill')).toBe(AERSEAL_BACKFILL_DAYS)
  })

  it('incremental uses the hour-based lookback converted to days', () => {
    expect(lookbackDaysFor('incremental')).toBe(AERSEAL_INCREMENTAL_LOOKBACK_HOURS / 24)
  })

  it('full and manual both use the broad reconciliation window', () => {
    expect(lookbackDaysFor('full')).toBe(AERSEAL_FULL_LOOKBACK_DAYS)
    expect(lookbackDaysFor('manual')).toBe(AERSEAL_FULL_LOOKBACK_DAYS)
  })

  it('incremental lookback is always shorter than backfill, which is shorter than full', () => {
    expect(lookbackDaysFor('incremental')).toBeLessThan(lookbackDaysFor('backfill'))
    expect(lookbackDaysFor('backfill')).toBeLessThan(lookbackDaysFor('full'))
  })
})

describe('nextScanIntervalHours — low-yield throttling', () => {
  it('does not throttle before the minimum sample size is reached', () => {
    expect(nextScanIntervalHours(AERSEAL_LOW_YIELD_MIN_RUNS - 1, 0, null)).toBeNull()
  })

  it('does not throttle a source that is actually producing leads', () => {
    // 10 runs, 5 leads — well above AERSEAL_LOW_YIELD_THRESHOLD (default 0.05).
    expect(nextScanIntervalHours(AERSEAL_LOW_YIELD_MIN_RUNS, 5, AERSEAL_INCREMENTAL_INTERVAL_HOURS)).toBeNull()
  })

  it('doubles the interval once the sample is large enough and yield is below threshold', () => {
    const next = nextScanIntervalHours(20, 0, AERSEAL_INCREMENTAL_INTERVAL_HOURS)
    expect(next).toBe(AERSEAL_INCREMENTAL_INTERVAL_HOURS * 2)
  })

  it('never widens past AERSEAL_MAX_SCAN_INTERVAL_HOURS', () => {
    const next = nextScanIntervalHours(100, 0, AERSEAL_MAX_SCAN_INTERVAL_HOURS)
    expect(next).toBe(AERSEAL_MAX_SCAN_INTERVAL_HOURS)
  })

  it('falls back to the global default interval when the source has no interval recorded yet', () => {
    const next = nextScanIntervalHours(20, 0, null)
    expect(next).toBe(AERSEAL_INCREMENTAL_INTERVAL_HOURS * 2)
  })
})
