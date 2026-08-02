// ── Monthly Outreach Stats ──────────────────────────────────────
// Pulls real outreach activity (leads / outreach_messages / lead_activities)
// for a given "YYYY-MM" month so the Monthly Performance dashboard reflects
// actual BD effort, not just manually-tracked deals.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface OutreachStats {
  totalOutreach: number
  companiesContacted: number
  individualsContacted: number
  replies: number
  meetingsBooked: number
  followUpsSent: number
  channelBreakdown: Record<string, number>
  companyCategoryBreakdown: Record<string, number>
}

export const EMPTY_OUTREACH_STATS: OutreachStats = {
  totalOutreach: 0,
  companiesContacted: 0,
  individualsContacted: 0,
  replies: 0,
  meetingsBooked: 0,
  followUpsSent: 0,
  channelBreakdown: {},
  companyCategoryBreakdown: {},
}

export function monthDateRange(monthYear: string): { start: string; end: string } {
  const [y, m] = monthYear.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end   = new Date(Date.UTC(y, m, 1))
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function getOutreachStats(
  supabase: SupabaseClient,
  monthYear: string,
): Promise<OutreachStats> {
  const { start, end } = monthDateRange(monthYear)

  const [msgsRes, leadsRes, actsRes] = await Promise.all([
    supabase
      .from('outreach_messages')
      .select('lead_id, contact_id, channel, status, created_at, updated_at')
      .gte('created_at', start).lt('created_at', end),
    supabase
      .from('leads')
      .select('id, status, contacted_at')
      .gte('contacted_at', start).lt('contacted_at', end),
    supabase
      .from('lead_activities')
      .select('lead_id, type, channel, created_at')
      .gte('created_at', start).lt('created_at', end),
  ])

  const msgs  = msgsRes.data || []
  const leads = leadsRes.data || []
  const acts  = actsRes.data || []

  if (msgsRes.error && leadsRes.error && actsRes.error) return EMPTY_OUTREACH_STATS

  // Total outreach and the channel breakdown must be built from the exact same
  // touches, or the headline number and the per-channel table silently drift
  // apart (previously totalOutreach only counted `msgs`, while channelBreakdown
  // also folded in `acts` — so the channel table could sum to more than the
  // headline total). Every message counts toward the total; only the ones with
  // a channel also land in the breakdown, same as activities.
  const channelBreakdown: Record<string, number> = {}
  let totalOutreach = 0
  msgs.forEach(m => {
    totalOutreach++
    if (m.channel) channelBreakdown[m.channel] = (channelBreakdown[m.channel] || 0) + 1
  })
  acts.forEach(a => {
    if (a.channel) {
      totalOutreach++
      channelBreakdown[a.channel] = (channelBreakdown[a.channel] || 0) + 1
    }
  })

  const companySet = new Set<string>()
  msgs.forEach(m => { if (m.lead_id) companySet.add(m.lead_id) })
  leads.forEach(l => companySet.add(l.id))
  acts.filter(a => ['email', 'call', 'meeting', 'follow_up'].includes(a.type)).forEach(a => companySet.add(a.lead_id))

  const individualSet = new Set<string>()
  msgs.forEach(m => { if (m.contact_id) individualSet.add(m.contact_id) })

  const repliesInMonth = msgs.filter(m => m.status === 'replied').length
  const meetingsBooked = acts.filter(a => a.type === 'meeting').length

  // Category breakdown of the companies contacted — grouped by leads.industry_category.
  // That field is AI-written free text per company (not a fixed list), so with
  // enough leads it produces dozens of near-unique one-off strings. Capping to
  // the top N + an "Other" bucket keeps this readable instead of dumping pages
  // of count-1 rows into the report.
  const CATEGORY_CAP = 8
  const companyCategoryBreakdown: Record<string, number> = {}
  if (companySet.size > 0) {
    const { data: catRows } = await supabase
      .from('leads')
      .select('id, industry_category')
      .in('id', Array.from(companySet))
    const rawBreakdown: Record<string, number> = {}
    ;(catRows || []).forEach(r => {
      const cat = (r.industry_category as string | null)?.trim() || 'Uncategorized'
      rawBreakdown[cat] = (rawBreakdown[cat] || 0) + 1
    })
    const sorted = Object.entries(rawBreakdown).sort((a, b) => b[1] - a[1])
    sorted.slice(0, CATEGORY_CAP).forEach(([cat, count]) => { companyCategoryBreakdown[cat] = count })
    const rest = sorted.slice(CATEGORY_CAP)
    const restTotal = rest.reduce((sum, [, count]) => sum + count, 0)
    if (restTotal > 0) companyCategoryBreakdown[`Other (${rest.length} categories)`] = restTotal
  }

  return {
    totalOutreach,
    companiesContacted: companySet.size,
    individualsContacted: individualSet.size,
    replies: repliesInMonth,
    meetingsBooked,
    followUpsSent: acts.filter(a => a.type === 'follow_up').length,
    channelBreakdown,
    companyCategoryBreakdown,
  }
}
