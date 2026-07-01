// ============================================================
// /api/ai/product-demand
//
// Reads product_feedback + unresolved technical/product-limitation
// blockers off every tracked deal (monthly_deals), asks Claude to
// cluster them into distinct feature/product gaps, then upserts the
// result into product_feature_demand — a running, de-duplicated
// backlog of what prospects say we're missing. Re-running this only
// grows/refreshes the backlog; it never deletes existing entries.
// ============================================================

import { NextResponse } from 'next/server'
import { claudeJSON, CLAUDE_RESEARCH } from '@/lib/claude'
import { createClient } from '@/lib/supabase/server'
import { PRODUCT_DEMAND_CATEGORIES, blockerLabel } from '@/lib/monthly-reports-types'
import type { MonthlyDeal } from '@/lib/monthly-reports-types'

interface DemandCluster {
  title: string
  description: string
  category: string
  companies: string[]
}

export async function POST() {
  const supabase = await createClient()

  const { data: dealsData, error: dealsError } = await supabase
    .from('monthly_deals')
    .select('id,company_name,product_feedback,blockers')

  if (dealsError?.message?.includes('does not exist')) {
    return NextResponse.json({ error: 'Monthly deals table not set up yet.' }, { status: 400 })
  }

  const deals = (dealsData || []) as Pick<MonthlyDeal, 'id' | 'company_name' | 'product_feedback' | 'blockers'>[]

  // Collect raw feedback snippets, tagged with which company said it.
  const snippets: { company: string; text: string }[] = []
  deals.forEach(d => {
    const pf = d.product_feedback || {}
    Object.values(pf).forEach(v => { if (v) snippets.push({ company: d.company_name, text: v }) })
    ;(d.blockers || [])
      .filter(b => !b.resolved && (b.type === 'technical' || b.type === 'product_limitation' || b.type.startsWith('custom_')) && b.notes)
      .forEach(b => snippets.push({ company: d.company_name, text: `${blockerLabel(b)}: ${b.notes}` }))
  })

  if (snippets.length === 0) {
    return NextResponse.json({ success: true, items: [], message: 'No product feedback collected yet — fill in the Product Feedback or Blockers section on a deal first.' })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured.' }, { status: 400 })
  }

  const categoryValues = PRODUCT_DEMAND_CATEGORIES.map(c => c.value).join(' | ')

  const system = `You analyze raw product feedback collected from BD prospect conversations at Kima Finance (cross-chain/fiat settlement infrastructure) and cluster it into a de-duplicated backlog of distinct feature/product gaps. Merge near-duplicate mentions of the same underlying gap into one cluster. Be concrete and specific — do not invent detail beyond what's given.`

  const user = `Raw feedback snippets, each tagged with the company that raised it:

${snippets.map((s, i) => `${i + 1}. [${s.company}] ${s.text}`).join('\n')}

Cluster these into distinct feature/product gaps. Return JSON:
{
  "clusters": [
    {
      "title": "short 3-8 word name for this gap, e.g. 'Webhook support for settlement events'",
      "description": "1-2 sentence synthesis of what's missing and why it matters, grounded in the snippets",
      "category": "${categoryValues}",
      "companies": ["company names that raised this, from the list above"]
    }
  ]
}`

  let clusters: DemandCluster[]
  try {
    const result = await claudeJSON<{ clusters: DemandCluster[] }>({
      system, user, model: CLAUDE_RESEARCH, maxTokens: 2000,
    })
    clusters = (result.clusters || []).filter(c => c.title && c.companies?.length)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const { data: existingRows } = await supabase
    .from('product_feature_demand')
    .select('id,title,description,category,companies,mention_count')

  const existing = existingRows || []
  const now = new Date().toISOString()

  for (const cluster of clusters) {
    const match = existing.find(e => e.title.trim().toLowerCase() === cluster.title.trim().toLowerCase())
    const companies = Array.from(new Set(cluster.companies))

    if (match) {
      const mergedCompanies = Array.from(new Set([...(match.companies || []), ...companies]))
      await supabase.from('product_feature_demand').update({
        description: cluster.description || match.description,
        companies: mergedCompanies,
        mention_count: mergedCompanies.length,
        last_seen: now,
      }).eq('id', match.id)
    } else {
      await supabase.from('product_feature_demand').insert({
        title: cluster.title,
        description: cluster.description,
        category: cluster.category,
        companies,
        mention_count: companies.length || 1,
        status: 'open',
        first_seen: now,
        last_seen: now,
      })
    }
  }

  const { data: finalRows } = await supabase
    .from('product_feature_demand')
    .select('*')
    .order('mention_count', { ascending: false })

  return NextResponse.json({ success: true, items: finalRows || [] })
}
