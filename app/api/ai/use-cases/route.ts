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

  const system = `You are a senior solutions architect for Kima, Aeredium, and Aergap.

${PRODUCT_BRAIN}

${routingBlock}

${memory}

Your job is to generate 2-3 use cases that are OPERATIONALLY BELIEVABLE — concrete enough that an engineer could build them, a solutions architect could diagram them, and a Head of Partnerships would believe them.

════════════════════════════════════════════════════════
THE ANTI-ABSTRACTION RULE — THIS IS THE WHOLE POINT
════════════════════════════════════════════════════════
A use case that just "identifies an opportunity" is USELESS. You must specify exactly what happened, with numbers and named systems.

❌ UNACCEPTABLE: "The agent identifies an opportunity."
✅ REQUIRED: "The AI trading agent monitors the spread between BTC spot on Exchange A and CME Bitcoin futures. When the spread exceeds 2.3% — the firm's profitability threshold after fees — the strategy decides to execute an arbitrage trade within 30 seconds."

Every use case MUST follow this structure:
  Trigger → Decision → Workflow → Products & Features → Business Outcome

1. TRIGGER — the EXACT event that starts everything. Must be concrete and measurable:
   - "A treasury balance falls below $250,000."
   - "BTC futures trade at a 2.3% premium to spot."
   - "A merchant's daily settlement window opens at 6 PM."
   - "A payout file contains more than 10,000 approved transactions."
   - "An invoice over $50,000 is approved by Finance."
   - "An AI agent receives a request to pay a supplier outside its approved whitelist."
   - "A stablecoin pool becomes imbalanced by more than 5%."
   Never write "an opportunity arises" — name the specific condition with a number.

2. DECISION — what the system or agent decides to do as a direct result of the trigger.

3. WORKFLOW — numbered concrete steps. Each step must, across the sequence, answer:
   - What system initiated the action?
   - What asset moved?
   - From where? To where?
   - Through which infrastructure?
   - Which component of OUR stack was involved?
   - Why was that component necessary?
   - What would happen without it?

4. PRODUCTS & FEATURES — for each product used, name the EXACT feature/capability and explain WHY it matters for this specific company.
   ❌ "Aeredium provides MPC."
   ✅ "Because traders should not hold private keys directly, Aeredium's MPC custody lets treasury, compliance, and ops jointly authorize sensitive actions without ever assembling a single signing key."

5. BUSINESS OUTCOME — the measurable result.

If a use case cannot answer "What exactly triggered this? Which exact feature? Why this feature? How does the workflow actually work? What happens without us?" — DO NOT include it. It is too generic.

HONESTY RULES:
- Only generate use cases where the fit is genuine. 2 deeply concrete use cases beat 3 forced ones.
- Pick the RIGHT product for each scenario. Do not shoehorn all three products into every use case.
- For Aergap scenarios, the trigger is usually an agent attempting an action that hits a policy boundary (amount threshold, recipient not on whitelist, unusual transaction). Show the policy evaluation → approval → execution → audit flow.
- If Aeredium genuinely isn't needed in a use case, leave its products out — don't force it.

Return ONLY valid JSON — no markdown, no text outside the array.`

  const user = `Generate operationally-concrete use cases for this company:

Company: ${lead.company_name}
Website: ${lead.website || 'N/A'}
Customer Category: ${cats.join(', ') || 'N/A'}
What they do: ${lead.description || lead.product_summary || 'N/A'}
Business Model: ${lead.business_model || 'N/A'}
Industry: ${lead.industry_category || 'N/A'}
Existing Infrastructure / Providers: ${lead.current_providers || 'N/A'}
Supported Chains/Rails: ${lead.supported_chains_or_rails || 'N/A'}
Product to Sell: ${lead.product_to_sell || 'N/A'}
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

Use the company's ACTUAL product, customers, and infrastructure in every scenario. If the scenario would make equal sense for a different company, it is too generic — rewrite it.

Return a JSON array of 2-3 use case objects in this EXACT structure:

[
  {
    "id": "short-kebab-slug",
    "title": "Specific title naming the actual workflow (e.g. 'Funding an arbitrage trade before the spread closes')",
    "category": "Settlement | Payments | Treasury | Security | On/Off-ramp | Agentic | DvP | Other",
    "scenario": "1-2 sentences. Who at this company operates what system. Set the stage concretely. E.g. 'An institutional trading desk runs an automated BTC arbitrage strategy through Alpaca, with treasury held as USDC on Ethereum.'",
    "trigger": "The EXACT triggering event with a number or named condition. E.g. 'BTC spot on Exchange A trades 2.4% below CME futures — above the firm's configured 2.0% execution threshold.' NEVER 'an opportunity arises'.",
    "decision": "What the system/agent decides to do. E.g. 'The agent decides to deploy an additional $500,000 of capital immediately to capture the spread before it closes.'",
    "workflow": [
      "Numbered concrete steps as an array. Each step names what moved, from where, to where, through which infrastructure, and which of our components was involved. E.g.:",
      "1. The trading agent requests $500K capital deployment to its Alpaca account.",
      "2. Treasury funds are held as USDC in the firm's Ethereum wallet.",
      "3. Kima initiates atomic settlement from the Ethereum treasury to the trading environment — no bridge, no wrapped asset.",
      "4. Funds arrive and the arbitrage executes before the spread disappears."
    ],
    "products_used": [
      {
        "product": "Kima | Aeredium | Aergap",
        "features": ["Exact features used, e.g. 'Atomic settlement', 'Cross-system interoperability', 'Instant settlement', 'MPC custody', 'Execution Gate', 'Policy enforcement', 'Immutable audit trail'"],
        "why": "Why THESE features matter for THIS company's specific situation — explain the necessity, not the feature. E.g. 'Without atomic settlement the firm risks a half-completed transfer leaving capital stranded mid-trade while the arbitrage window closes.'"
      }
    ],
    "without_us": "What concretely happens today WITHOUT our product — the failure mode, the delay, the risk. E.g. 'The firm relies on manual treasury ops or a centralized bridge that can take 10-20 minutes, by which time the arbitrage spread has usually closed.'",
    "business_outcome": "The measurable result. E.g. 'The firm captures arbitrage spreads it currently misses, while eliminating settlement risk and manual treasury intervention.'",
    "feasibility": "high | medium | low",
    "impact": "transformative | significant | incremental",
    "why_now": "One sentence on why now is the moment to act. Empty string if no strong trigger."
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
