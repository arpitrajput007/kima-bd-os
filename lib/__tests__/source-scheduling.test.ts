import { describe, it, expect } from 'vitest'
import { isSourceDue, isSourceDueByHours } from '@/lib/source-scheduling'

describe('isSourceDue — daily/weekly cron cadence', () => {
  it('a manual-frequency source is due only in the manual context', () => {
    expect(isSourceDue({ frequency: 'manual' }, 'manual')).toBe(true)
    expect(isSourceDue({ frequency: 'manual' }, 'cron')).toBe(false)
  })

  it('a never-run source is always due', () => {
    expect(isSourceDue({ frequency: 'daily', last_run_at: null }, 'cron')).toBe(true)
    expect(isSourceDue({ frequency: 'weekly', last_run_at: null }, 'cron')).toBe(true)
  })

  it('a daily source run 12h ago is not due; run 25h ago is due', () => {
    const twelveHoursAgo = new Date(Date.now() - 12 * 3600_000).toISOString()
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 3600_000).toISOString()
    expect(isSourceDue({ frequency: 'daily', last_run_at: twelveHoursAgo }, 'cron')).toBe(false)
    expect(isSourceDue({ frequency: 'daily', last_run_at: twentyFiveHoursAgo }, 'cron')).toBe(true)
  })

  it('a weekly source run 3 days ago is not due; run 8 days ago is due', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400_000).toISOString()
    const eightDaysAgo = new Date(Date.now() - 8 * 86400_000).toISOString()
    expect(isSourceDue({ frequency: 'weekly', last_run_at: threeDaysAgo }, 'cron')).toBe(false)
    expect(isSourceDue({ frequency: 'weekly', last_run_at: eightDaysAgo }, 'cron')).toBe(true)
  })

  it('an unrecognized frequency value defaults to due rather than silently never running', () => {
    expect(isSourceDue({ frequency: 'hourly' }, 'cron')).toBe(true)
  })
})

describe('isSourceDueByHours — AERSeal recurring scanner cadence', () => {
  it('a target with no last_success_at is always due', () => {
    expect(isSourceDueByHours({ scan_interval_hours: 6, last_success_at: null }, 6)).toBe(true)
  })

  it('respects a per-target scan_interval_hours override over the fallback', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString()
    // Fallback is 6h (would say "not due"), but this target overrides to 1h.
    expect(isSourceDueByHours({ scan_interval_hours: 1, last_success_at: twoHoursAgo }, 6)).toBe(true)
  })

  it('falls back to the global interval when scan_interval_hours is null', () => {
    const sevenHoursAgo = new Date(Date.now() - 7 * 3600_000).toISOString()
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString()
    expect(isSourceDueByHours({ scan_interval_hours: null, last_success_at: sevenHoursAgo }, 6)).toBe(true)
    expect(isSourceDueByHours({ scan_interval_hours: null, last_success_at: twoHoursAgo }, 6)).toBe(false)
  })

  it('uses last_success_at, not merely "was attempted" — a source due 6h ago stays due even if it was retried more recently and failed', () => {
    // This mirrors how the orchestrator calls it: last_success_at is only
    // updated on a successful scan (lib/aerseal-orchestrator.ts recordScanOutcome),
    // so a source that keeps failing stays "due" every cycle rather than
    // looking freshly scanned.
    const eightHoursAgo = new Date(Date.now() - 8 * 3600_000).toISOString()
    expect(isSourceDueByHours({ scan_interval_hours: 6, last_success_at: eightHoursAgo }, 6)).toBe(true)
  })
})
