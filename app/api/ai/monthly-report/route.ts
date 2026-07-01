import { NextRequest, NextResponse } from 'next/server'
import { claudeText, claudeConfigured } from '@/lib/claude'
import { fmtMonthYear } from '@/lib/monthly-reports-types'
import type { MonthlyDeal, DealActivity } from '@/lib/monthly-reports-types'
import type { OutreachStats } from '@/lib/monthly-outreach-stats'

export async function POST(req: NextRequest) {
  if (!claudeConfigured()) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured.' }, { status: 400 })
  }

  const body = await req.json() as {
    month: string
    deals: MonthlyDeal[]
    activities: DealActivity[]
    outreach: OutreachStats
  }

  const { month, deals, activities, outreach } = body
  const won    = deals.filter(d => d.status === 'closed_won')
  const lost   = deals.filter(d => d.status === 'closed_lost')
  const active = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.status))

  const productFeedback = deals.flatMap(d => {
    const pf = d.product_feedback || {}
    return Object.values(pf).filter(Boolean)
  })

  const blockers = deals.flatMap(d => (d.blockers || []).filter(b => !b.resolved).map(b => b.type))

  const system = `You are a BD performance analyst writing a monthly business development report for a business development representative at Kima Finance (cross-chain/fiat settlement infrastructure). Be specific, factual, and concise — ground every claim in the data given, never invent numbers. Write in plain prose (no markdown headers, no bullet asterisks), organized into short paragraphs separated by blank lines, covering in order: (1) activity & efficiency, (2) pipeline status, (3) business opportunities & expected volumes, (4) product insights/feedback and blockers, (5) recommended focus for next month. Keep it under 350 words total.`

  const user = `Data for ${fmtMonthYear(month)}:

OUTREACH ACTIVITY:
- Total outreach touches: ${outreach.totalOutreach}
- Companies contacted: ${outreach.companiesContacted}
- Individuals contacted: ${outreach.individualsContacted}
- Replies received: ${outreach.replies}
- Meetings booked: ${outreach.meetingsBooked}
- Follow-ups sent: ${outreach.followUpsSent}
- Channel breakdown: ${JSON.stringify(outreach.channelBreakdown)}

DEAL PIPELINE (manually tracked):
- Total deals: ${deals.length} (active: ${active.length}, won: ${won.length}, lost: ${lost.length})
- Deal activities logged: ${activities.length}
- Deals: ${deals.map(d => `${d.company_name} [${d.status}]${d.lead_type ? ` (${d.lead_type})` : ''} — vol: ${d.expected_monthly_volume || 'n/a'}, revenue: ${d.estimated_revenue || 'n/a'}, importance: ${d.strategic_importance || 'n/a'}`).join('; ') || 'none'}
- Won deals detail: ${won.map(d => `${d.company_name}: ${d.business_impact || d.why_valuable || 'no detail'}`).join('; ') || 'none'}
- Active blockers: ${blockers.join(', ') || 'none'}

PRODUCT FEEDBACK COLLECTED FROM PROSPECTS:
${productFeedback.length ? productFeedback.map(f => `- ${f}`).join('\n') : '- none collected this month'}

Write the monthly report now.`

  try {
    const summary = await claudeText({ system, user, maxTokens: 900 })
    return NextResponse.json({ summary: summary.trim() })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
