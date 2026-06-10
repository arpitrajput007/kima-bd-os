// ============================================================
// /api/ai/use-cases
//
// Generates 2-3 concrete, story-driven use cases showing exactly
// how Kima / Aeredium can work with a specific company.
// Only generates realistic scenarios — never forces a fit.
//
// POST { lead_id: string }
// Returns { success: true, use_cases: UseCase[] }
// Also saves use_cases to leads.use_cases in Supabase.
// ============================================================

import { claudeJSON, CLAUDE_RESEARCH } from '@/lib/claude'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PRODUCT_BRAIN } from '@/lib/kima-knowledge'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  const { lead_id } = await req.json()
  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  // Load full lead context
  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', lead_id)
    .single()

  if (error || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const system = `You are a senior BD strategist for Kima and Aeredium.

${PRODUCT_BRAIN}

Your job is to generate 2-3 REAL, CONCRETE use cases showing exactly how Kima and/or Aeredium can work with a specific company. These are not sales pitches — they are honest scenario analyses.

RULES:
- Only generate use cases where the fit is genuine and specific to this company's actual product/workflow
- Each use case must tell a mini story: a specific transaction or workflow the company does TODAY, and how it changes with Kima/Aeredium
- Numbers matter: if you know their volume, transaction size, or settlement frequency, use them
- If Aeredium adds value to a use case, include it — if it doesn't, leave it out
- Be honest about feasibility. A use case with medium feasibility but high impact is still worth showing
- 2 use cases if the fit is moderate; 3 if the company is a strong ICP match
- NEVER invent a use case just to fill space. Fewer honest ones > more forced ones

Return ONLY valid JSON — no markdown, no text outside the array.`

  const user = `Generate real use cases for this company:

Company: ${lead.company_name}
Website: ${lead.website || 'N/A'}
Description: ${lead.description || lead.product_summary || 'N/A'}
Business Model: ${lead.business_model || 'N/A'}
Industry: ${lead.industry_category || 'N/A'}
Product to Sell: ${lead.product_to_sell || 'N/A'}
Supported Chains/Rails: ${lead.supported_chains_or_rails || 'N/A'}
Current Providers: ${lead.current_providers || 'N/A'}
Competitor/Incumbent: ${lead.competitor_or_current_provider || 'N/A'}
Competitor Context: ${lead.competitor_context || 'N/A'}
Pain Point: ${lead.pain_point || 'N/A'}
Pain Severity: ${lead.pain_point_severity || 'N/A'}
Kima Fit: ${lead.kima_fit || 'N/A'}
Aeredium Fit: ${lead.aeredium_fit || 'N/A'}
Settlement Angle: ${lead.settlement_angle || 'N/A'}
Security Angle: ${lead.security_angle || 'N/A'}
Risk Angle: ${lead.risk_angle || 'N/A'}
Revenue Potential: ${lead.revenue_potential || 'N/A'}

Return a JSON array of 2-3 use case objects, each with this exact shape:

[
  {
    "id": "short-kebab-slug",
    "title": "Precise, specific title (not generic — name the actual workflow)",
    "category": "Settlement | Payments | Treasury | Security | On/Off-ramp | Agentic | DvP | Other",
    "scenario": "Tell the story. Start with what the company does TODAY in this specific workflow. Then show the before/after with Kima. Use specific details — transaction sizes, chain names, time delays, counterparty names if known. 3-4 sentences. Plain English, no jargon.",
    "kima_role": "Exactly what Kima does in this scenario — which API, which settlement path, which chains. Be technically specific. 2-3 sentences.",
    "aeredium_role": "What Aeredium's TEE layer adds in this scenario, or empty string if Aeredium isn't relevant here.",
    "outcome_for_company": "Concrete measurable outcome: settlement time, cost reduction, new market access, risk eliminated. 1-2 sentences with specifics.",
    "outcome_for_kima": "What Kima gets: transaction volume, fee revenue, partnership type, reference customer value. 1 sentence.",
    "feasibility": "high | medium | low",
    "impact": "transformative | significant | incremental",
    "why_now": "Why this use case is particularly relevant RIGHT NOW (recent funding, product launch, chain expansion, regulation, hack etc.). 1 sentence. Empty string if no strong trigger."
  }
]`

  try {
    const useCases = await claudeJSON({
      model: CLAUDE_RESEARCH,
      system,
      user,
      maxTokens: 3000,
    })

    // Save to leads table
    await supabase
      .from('leads')
      .update({ use_cases: useCases, updated_at: new Date().toISOString() })
      .eq('id', lead_id)

    return NextResponse.json({ success: true, use_cases: useCases })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Use case generation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
