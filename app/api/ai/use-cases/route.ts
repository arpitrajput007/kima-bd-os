// ============================================================
// /api/ai/use-cases
//
// Generates 2-3 concrete, story-driven use cases showing exactly
// how Kima / Aeredium can work with a specific company.
//
// KEY: This route is customer-category aware:
//   - "Agentic Payments Customer" → Agentic Payments + Aergap playbook
//   - Everything else → Settlement / cross-chain playbook
//
// Also injects agent memory (learned knowledge + active rules)
// so the agent's ongoing learning is actually applied here.
//
// POST { lead_id: string }
// Returns { success: true, use_cases: UseCase[] }
// ============================================================

import { claudeJSON, CLAUDE_RESEARCH } from '@/lib/claude'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { PRODUCT_BRAIN, AGENTIC_PAYMENTS } from '@/lib/kima-knowledge'
import { buildMemoryContext } from '@/lib/agent-memory'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ── Category routing ───────────────────────────────────────────
function isAgenticLead(customerCategory: string | string[] | null | undefined): boolean {
  if (!customerCategory) return false
  const cats = Array.isArray(customerCategory) ? customerCategory : [customerCategory]
  return cats.some(c => c.toLowerCase().includes('agentic'))
}

function categoryRoutingBlock(lead: Record<string, unknown>): string {
  const cats = (lead.customer_category as string[] | null) ?? []
  const isAgentic = isAgenticLead(cats)

  if (isAgentic) {
    return `
══ CATEGORY ROUTING — AGENTIC PAYMENTS LEAD ══
This company is tagged as an Agentic Payments Customer.

YOUR PRIMARY FRAME IS THE AGENTIC PAYMENTS PLAYBOOK:
${AGENTIC_PAYMENTS}

MANDATORY RULES FOR THIS LEAD:
1. Focus on agent identity, spend policy enforcement, hardware-attested execution, and settlement rails for agentic flows — NOT generic cross-chain settlement.
2. The three gaps: (a) narrow settlement rails, (b) software-level mandate enforcement, (c) no verifiable audit trail. Map which ones apply to this company.
3. Kima's role: single-API settlement across any rail for agent-initiated transactions.
4. Aeredium's role: TEE-attested execution gate + AERKey threshold ECDSA = hardware-level policy enforcement + cryptographic audit trail.
5. If Aergap is a competitor or in their stack, explicitly address the "governance sidecar vs. full stack" angle.
6. Do NOT generate cross-chain settlement use cases unless the company explicitly does cross-chain work AND it's relevant to agent flows.
7. Use the ANUM framework (Authority, Need, Urgency, Money) lens when describing "why now" — enterprise deals stalling in security review is the strongest urgency signal.
`
  }

  return `
══ CATEGORY ROUTING — STANDARD LEAD ══
Categories: ${cats.join(', ') || 'unclassified'}
Use the appropriate section of the PRODUCT_BRAIN above for this company's category.
For LayerZero/bridge leads: focus on bridge-risk elimination angle.
For Hacked Protocols: focus on security hardening + no-smart-contract settlement.
For Needs On/Off Ramp: focus on UPR fiat corridor use cases.
For Fireblocks customers: use the Fireblocks battlecard.
For Web2 Stablecoin Settlement: focus on SWIFT replacement use cases.
`
}

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

  // ── Derive memory tags from lead context ─────────────────────
  const cats = (lead.customer_category as string[] | null) ?? []
  const memoryTags: string[] = [
    ...cats.map((c: string) => c.toLowerCase().replace(/\s+/g, '_')),
    lead.industry_category ? (lead.industry_category as string).toLowerCase().replace(/\s+/g, '_') : '',
    isAgenticLead(cats) ? 'agentic' : '',
    isAgenticLead(cats) ? 'agent' : '',
    isAgenticLead(cats) ? 'aergap' : '',
  ].filter(Boolean)

  // ── Load agent memory (learned knowledge + rules) ────────────
  const memory = await buildMemoryContext({
    tags: memoryTags,
    includeFeedback: true,
    maxContentLen: 400,
    knowledgeTypes: ['icp_signal', 'competitor_intel', 'market_trend', 'product_context', 'outreach_strategy', 'general'],
  })

  // ── Category routing block ───────────────────────────────────
  const routingBlock = categoryRoutingBlock(lead as Record<string, unknown>)

  const system = `You are a senior BD strategist for Kima and Aeredium.

${PRODUCT_BRAIN}

${routingBlock}

${memory}

Your job is to generate 2-3 REAL, CONCRETE use cases showing exactly how Kima and/or Aeredium can work with a specific company.

RULES:
- Only generate use cases where the fit is genuine and specific to this company's actual product/workflow
- Write each point as a SHORT, PUNCHY sentence (max 20 words). No long prose paragraphs.
- Numbers matter: if you know their volume, transaction size, or settlement frequency, use them
- If Aeredium adds value to a use case, include it — if it doesn't, leave it out
- Be honest about feasibility. Medium feasibility + high impact is still worth showing.
- 2 use cases if the fit is moderate; 3 if the company is a strong ICP match
- NEVER invent a use case just to fill space. Fewer honest ones > more forced ones
- For agentic leads: ALWAYS include at least one use case involving Aeredium's TEE/AERKey layer

MANDATORY FIELDS — populate all three in every use case:
1. our_products_used: name the EXACT products (Kima Settlement API / Kima UPR / Aeredium AERKey TEE / Aeredium Threshold ECDSA / Aergap Execution Gate). Do not write generic "Kima" — be specific.
2. pain_point_proof: cite observable facts that prove the pain is real for this company — their tech stack, architecture choices, competitor they displaced, public statements, known incidents, or regulatory pressure. Use the "Pain Evidence / Proof" field from the lead data if provided.
3. scenario: describe the company's CURRENT broken workflow, not the solution. Be specific to their product.

Return ONLY valid JSON — no markdown, no text outside the array.`

  const user = `Generate real use cases for this company:

Company: ${lead.company_name}
Website: ${lead.website || 'N/A'}
Customer Category: ${cats.join(', ') || 'N/A'}
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
Pain Evidence / Proof: ${lead.pain_point_evidence || 'N/A'}
Kima Fit: ${lead.kima_fit || 'N/A'}
Aeredium Fit: ${lead.aeredium_fit || 'N/A'}
Settlement Angle: ${lead.settlement_angle || 'N/A'}
Security Angle: ${lead.security_angle || 'N/A'}
Risk Angle: ${lead.risk_angle || 'N/A'}
Revenue Potential: ${lead.revenue_potential || 'N/A'}

Return a JSON array of 2-3 use case objects. Each field that is a list of points should be a SHORT array of strings (not one long prose string):

[
  {
    "id": "short-kebab-slug",
    "title": "Precise, specific title (not generic — name the actual workflow)",
    "category": "Settlement | Payments | Treasury | Security | On/Off-ramp | Agentic | DvP | Other",
    "our_products_used": ["Array of the EXACT Kima/Aeredium/Aergap product names used in this use case. Be specific — e.g. 'Kima Settlement API', 'Kima UPR (Universal Payment Rail)', 'Aeredium AERKey TEE', 'Aeredium Threshold ECDSA', 'Aergap Execution Gate'. Only include products that genuinely apply."],
    "scenario": ["3-4 bullet strings. Each: one crisp sentence about the current problem/workflow this company faces. Name their actual system or workflow where possible."],
    "pain_point_proof": ["1-2 bullet strings. Concrete, observable evidence that this pain point is REAL for this specific company — cite their architecture choices, public integrations, known incidents, customer complaints, or structural constraints. No speculation. If the Pain Evidence field above contains relevant facts, use them."],
    "kima_role": ["2-3 bullet strings. Exactly what Kima does — which API, which settlement path, which chains/rails."],
    "aeredium_role": ["1-2 bullet strings showing Aeredium's exact contribution, or empty array [] if not relevant to this use case."],
    "outcome_for_company": ["1-2 bullet strings with concrete measurable outcomes — time saved, cost reduced, new markets unlocked, compliance met."],
    "outcome_for_kima": ["1 bullet string: transaction volume, fee revenue, or strategic partnership value."],
    "feasibility": "high | medium | low",
    "impact": "transformative | significant | incremental",
    "why_now": "One sentence on why RIGHT NOW is the moment to act. Empty string if no strong trigger."
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
