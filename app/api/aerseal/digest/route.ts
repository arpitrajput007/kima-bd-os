import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { AersealDossier, OutreachHypothesis, ScoreBreakdown } from '@/lib/aerseal-discovery'

export const dynamic = 'force-dynamic'

// Daily AERSeal opportunity digest — every qualified lead already carries its
// full dossier (aerseal_dossier), hypothesis (aerseal_hypothesis) and
// computed score breakdown (aerseal_score_breakdown), all written once at
// save time by app/api/ai/discover-aerseal/route.ts. This route is a pure
// read + reshape into the 18-field digest format; it does no scoring or
// gating of its own, and it never re-ranks or re-approves anything.
//
// GET /api/aerseal/digest?since=today|24h|7d|<ISO date>&limit=50
// Default `since` is unset (all qualified leads, most recent research first).

interface DigestRow {
  id: string
  company_name: string
  website: string | null
  aerseal_score: number | null
  aerseal_tier: number | null
  aerseal_dossier: AersealDossier | null
  aerseal_hypothesis: OutreachHypothesis | null
  aerseal_score_breakdown: ScoreBreakdown | null
  status: string
  created_at: string
}

function resolveSince(param: string | null): string | null {
  if (!param) return null
  const now = new Date()
  if (param === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  if (param === '24h') return new Date(now.getTime() - 24 * 3600_000).toISOString()
  if (param === '7d') return new Date(now.getTime() - 7 * 24 * 3600_000).toISOString()
  const parsed = new Date(param)
  return isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { searchParams } = req.nextUrl
  const since = resolveSince(searchParams.get('since'))
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit')) || 50))

  let query = supabase
    .from('leads')
    .select('id, company_name, website, aerseal_score, aerseal_tier, aerseal_dossier, aerseal_hypothesis, aerseal_score_breakdown, status, created_at')
    .not('aerseal_score', 'is', null)
    .order('aerseal_score', { ascending: false })
    .limit(limit)
  if (since) query = query.gte('created_at', since)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data || []) as unknown as DigestRow[]

  const items = rows.map(l => {
    const d = l.aerseal_dossier || ({} as Partial<AersealDossier>)
    const h = l.aerseal_hypothesis
    const tier = (l.aerseal_tier as 1 | 2 | 3) ?? 3
    const primaryContract = (d.evm_footprint?.contracts || [])[0]

    // Recommended action mirrors the tier definitions in the spec/rubric:
    // Tier 1 with a valid hypothesis is send-ready; Tier 1 whose hypothesis
    // failed validation (banned language, missing evidence URL — see
    // validateHypothesis in lib/aerseal-discovery.ts) or Tier 2 needs one more
    // piece of research before outreach; Tier 3 is a watch-list account.
    // 'reject' never appears here because a rejected/gate-failed candidate is
    // never persisted as a lead in the first place (see evaluateGate).
    const recommended_action: 'outreach' | 'further_research' | 'monitor' =
      tier === 1 ? (h ? 'outreach' : 'further_research') : tier === 2 ? 'further_research' : 'monitor'

    return {
      lead_id: l.id,
      company: l.company_name,
      score: l.aerseal_score,
      tier,
      tier_label: tier === 1 ? 'Tier 1' : tier === 2 ? 'Tier 2' : 'Tier 3',
      trigger_event: d.trigger?.what_happened || null,
      trigger_date: d.trigger?.date || null,
      why_trigger_matters_now: d.why_now || null,
      trigger_evidence_url: d.trigger?.evidence_url || null,
      evm_chain: (d.evm_footprint?.chains || [])[0] || null,
      contract_address: primaryContract?.address || null,
      privileged_role: (d.privileged_powers || [])[0]?.power || null,
      controller_classification: d.authority_control?.model || 'unknown',
      structural_evidence_url: d.structural_fit?.evidence_url || null,
      confirmed_facts: d.facts || [],
      inferences: d.inferences || [],
      unknowns: d.unknowns || [],
      material_consequence: d.authority_loss_scenario || null,
      likely_buyer: d.buyer?.role || null,
      reachability: l.aerseal_score_breakdown?.reachability ?? null,
      aerseal_fit_hypothesis: d.aerseal_use_case || null,
      first_intelligent_discovery_question: h?.intelligent_question || null,
      recommended_action,
      website: l.website,
      created_at: l.created_at,
    }
  })

  return NextResponse.json({
    generated_at: new Date().toISOString(),
    since: since || 'all-time',
    count: items.length,
    tier1_count: items.filter(i => i.tier === 1).length,
    tier2_count: items.filter(i => i.tier === 2).length,
    tier3_count: items.filter(i => i.tier === 3).length,
    items,
  })
}
