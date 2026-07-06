// Shared cadence logic for discovery sources. Both the manual "Fetch fresh
// leads" button and the daily Vercel cron must agree on what "due" means —
// otherwise sources tagged 'weekly' silently run daily (7x the intended
// spend) and manual-only sources fire without anyone asking for them.

export interface SourceScheduleInfo {
  frequency?: string | null
  last_run_at?: string | null
}

const INTERVAL_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
}

// context: 'manual' = the user clicked the button (manual-frequency sources
// count as due — that IS their trigger). 'cron' = the automated daily job
// (manual-frequency sources must never fire on their own).
export function isSourceDue(source: SourceScheduleInfo, context: 'manual' | 'cron'): boolean {
  const freq = source.frequency || 'manual'

  if (freq === 'manual') return context === 'manual'

  const intervalMs = INTERVAL_MS[freq]
  if (!intervalMs) return true // unknown frequency value — default to due rather than silently never running

  if (!source.last_run_at) return true
  return Date.now() - new Date(source.last_run_at).getTime() >= intervalMs
}
