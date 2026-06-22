// ============================================================
// Shared BD Brief generation logic
// Used by:
//   - /api/ai/bd-brief (standalone regeneration)
//   - /api/ai/enrich-lead (auto-generated at pipeline end)
// ============================================================

import { claudeJSON, CLAUDE_RESEARCH } from '@/lib/claude'
import { PRODUCT_BRAIN, productFocusDirective, type LeadFocusInput } from '@/lib/kima-knowledge'
import { fullMemory } from '@/lib/agent-memory'
import type { BDBrief } from '@/lib/types'

const SYSTEM = `You are a senior solutions architect and BD strategist for Kima, Aeredium, and Aergap — financial infrastructure companies.

${PRODUCT_BRAIN}

YOUR JOB: Write a BD brief that feels like it was prepared by someone who spent hours researching this specific company. The benchmark: if you replace the company name with a different company and the brief still makes sense, you have failed.

WRITING RULES — non-negotiable:
1. Understand the company before evaluating products. The brief must reflect deep company knowledge, not a product pitch.
2. "No fit" or "Weak Fit" is an acceptable BD verdict. If the fit is weak, say so clearly and explain why. This protects the BD team's time and credibility.
3. Plain English. Write as if explaining to a smart business person who is not technical.
4. Every sentence must pass the "So what?" test. If it doesn't help decide whether to pursue — cut it.
5. No marketing language. No feature lists. No repeating product features unless they directly solve a named problem.
6. The real-life use case must be OPERATIONALLY BELIEVABLE — concrete enough that an engineer could build it and a Head of Partnerships would believe it. Follow Trigger → Decision → Workflow → Products/Features → Outcome.
   - The TRIGGER must be an exact event with a number or named condition ("a treasury balance falls below $250K", "an agent tries to pay a supplier not on the whitelist") — NEVER "an opportunity arises".
   - For each product, name the EXACT feature and explain WHY it matters for this company. Not "Aeredium provides MPC" but "Because traders shouldn't hold keys directly, Aeredium's MPC custody lets treasury and compliance jointly authorize without assembling a single signing key."
   - Always answer "what happens without us" concretely — the failure mode, the delay, the risk.
   BAD: "Kima enables cross-chain interoperability."
   GOOD: "Trigger: BTC spot trades 2.4% below CME futures, above the firm's 2.0% threshold. Decision: the agent deploys $500K immediately. Workflow: treasury USDC on Ethereum → Kima atomic settlement → Alpaca trading account → arbitrage executes before the spread closes. Without Kima: a centralized bridge takes 10-20 min and the window closes."
7. Pain points must be OPERATIONAL problems specific to this company's actual workflow and infrastructure — not generic category challenges.
8. The opportunity section must answer: why THIS product for THIS company, and why the other products are less relevant.
9. Discovery questions must be ones you would actually ask on a first call — diagnostic, not generic.
10. Strategic hypotheses must be clearly labeled as future-state possibilities, not current facts.

Return ONLY valid JSON. No markdown, no text outside the JSON.`

export async function generateBDBrief(lead: Record<string, unknown>): Promise<BDBrief> {
  const cats = Array.isArray(lead.customer_category)
    ? (lead.customer_category as string[]).join(', ')
    : String(lead.customer_category || 'N/A')

  const assumptions = Array.isArray(lead.assumptions)
    ? (lead.assumptions as {text:string}[]).map(a => a.text || String(a)).join('\n')
    : ''

  const user = `Generate a BD brief for this company. The agent has already done deep research — use all the enriched data below.

COMPANY: ${lead.company_name}
WEBSITE: ${lead.website || 'N/A'}
INDUSTRY: ${lead.industry_category || 'N/A'}
CUSTOMER CATEGORY: ${cats}
REGION: ${lead.region || 'N/A'}
STAGE: ${lead.business_model ? 'see business model' : 'unknown'}

WHAT THEY ACTUALLY DO:
${lead.description || lead.product_summary || 'N/A'}

BUSINESS MODEL: ${lead.business_model || 'N/A'}
EXISTING INFRASTRUCTURE / STACK: ${lead.current_providers || 'N/A'}
CHAINS / RAILS THEY SUPPORT: ${lead.supported_chains_or_rails || 'N/A'}

IDENTIFIED PAIN POINTS: ${lead.pain_point || 'N/A'}
PAIN SEVERITY: ${lead.pain_point_severity || 'N/A'}
PAIN EVIDENCE (what makes this pain credible): ${lead.pain_point_evidence || 'N/A'}

PRODUCT FIT ANALYSIS:
- Kima fit: ${lead.kima_fit || 'N/A'}
- Aeredium fit: ${lead.aeredium_fit || 'N/A'}
- Settlement angle: ${lead.settlement_angle || 'N/A'}
- Security angle: ${lead.security_angle || 'N/A'}
- Risk angle: ${lead.risk_angle || 'N/A'}
- Competitor context: ${lead.competitor_context || 'N/A'}

PRODUCT TO SELL: ${lead.product_to_sell || 'N/A'}
SUGGESTED USE CASE: ${lead.suggested_use_case || 'N/A'}
INTEGRATION FEASIBILITY: ${lead.integration_feasibility || 'N/A'}

TRIGGER / WHY NOW: ${lead.trigger_reason || 'N/A'}
REVENUE POTENTIAL: ${lead.revenue_potential || 'N/A'}
LEAD SCORE: ${lead.lead_score ?? 'N/A'} / 100

STRATEGIC HYPOTHESES (future-state possibilities flagged by the agent):
${assumptions || 'None identified'}

━━ OUTPUT REQUIREMENTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The brief must be specific to ${lead.company_name}. If you can replace the name with any other company and the brief still makes sense — rewrite it.

The BD Verdict must be honest. If the fit is weak, say so and explain why. The BD team needs signal, not manufactured confidence.

Return this exact JSON structure:

{
  "lead_summary": [
    "2–3 bullets. What does ${lead.company_name} specifically do — not the category, the actual product and workflow? What problem do they solve for their customers?"
  ],
  "how_money_moves": "2–3 sentences. How does value actually flow through their product? Who sends what, to whom, across which systems? Be specific to their actual infrastructure.",
  "pain_points": [
    "Top 3 operational problems specific to ${lead.company_name}'s situation. Each as one punchy sentence. Traceable to their actual workflow or stack — NOT generic industry problems."
  ],
  "opportunity": {
    "products": ["Only list products with genuine fit: 'Kima', 'Aeredium', 'Aergap'. If none fit strongly, list the best one with caveats. If truly no fit, say ['No clear fit at this time']."],
    "gap_solved": "One sentence: what specific gap in ${lead.company_name}'s current setup does our product fill? Name their actual limitation.",
    "why_they_care": "One sentence: what concrete business outcome do they get? (not features — outcomes: faster settlement, new corridor opened, compliance unlocked, cost reduced by X%)",
    "why_not_the_others": "One sentence: briefly explain why the other products are less relevant for this specific company right now."
  },
  "real_use_case": {
    "title": "Specific title naming the actual workflow at ${lead.company_name} — not a generic payment scenario",
    "scenario": "1-2 sentences. Who at ${lead.company_name} operates what system. Set the stage concretely using their actual product and infrastructure.",
    "trigger": "The EXACT triggering event with a number or named condition. E.g. 'A treasury balance falls below $250K' or 'An agent attempts to pay a supplier not on the approved whitelist'. NEVER 'an opportunity arises'.",
    "decision": "What the system or agent decides to do as a direct result of the trigger.",
    "workflow": [
      "3-5 numbered concrete steps. Each names what moved, from where, to where, through which infrastructure, and which of our components was involved. Specific enough that an engineer could build it."
    ],
    "products_used": [
      {
        "product": "Kima | Aeredium | Aergap",
        "features": ["Exact features used — e.g. 'Atomic settlement', 'MPC custody', 'Execution Gate', 'Immutable audit trail'"],
        "why": "Why THESE features matter for THIS company specifically — explain the necessity. E.g. 'Without atomic settlement, a half-completed transfer would strand capital mid-trade.' Not just 'provides MPC'."
      }
    ],
    "without_us": "What concretely happens today WITHOUT our product — the failure mode, delay, or risk. Name specifics.",
    "business_outcome": "One sentence: the measurable result — time saved, cost reduced, risk eliminated, market accessed."
  },
  "discovery_questions": [
    "3–5 questions for the first call. Each must be diagnostic — designed to surface whether the pain is real and whether there is budget and authority to act. Not 'Tell us about your payment flows' — more specific than that."
  ],
  "strategic_hypotheses": [
    "1–3 future-state possibilities. Clearly labeled as hypotheses, not current facts. E.g. 'If they expand into Southeast Asia, Kima becomes relevant because their current EVM-only stack doesn't cover those corridors.'"
  ],
  "bd_verdict": {
    "fit": "Strong Fit | Moderate Fit | Weak Fit",
    "reason": "One sentence. Reference something specific about ${lead.company_name} — their stage, their infrastructure, their customer type, or their identified pain. Not generic."
  }
}`

  // Inject learned memory (rules/knowledge/feedback) + deterministic product
  // focus so the brief reflects everything taught via Make Agent Learn and
  // routes AI-agent companies to Aergap instead of defaulting to Kima.
  const [memory, { directive }] = await Promise.all([
    fullMemory({ tags: (lead.tags as string[] | null) || [] }),
    Promise.resolve(productFocusDirective(lead as LeadFocusInput)),
  ])

  const system = `${SYSTEM}${memory}\n\n${directive}`

  return claudeJSON({
    model: CLAUDE_RESEARCH,
    system,
    user,
    maxTokens: 2500,
  }) as Promise<BDBrief>
}
