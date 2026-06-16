// ============================================================
// Shared BD Brief generation logic
// Used by:
//   - /api/ai/bd-brief (standalone regeneration)
//   - /api/ai/enrich-lead (auto-generated at pipeline end)
// ============================================================

import { claudeJSON, CLAUDE_RESEARCH } from '@/lib/claude'
import { PRODUCT_BRAIN } from '@/lib/kima-knowledge'
import type { BDBrief } from '@/lib/types'

const SYSTEM = `You are a senior BD analyst for Kima, Aeredium, and Aergap — financial infrastructure companies.

${PRODUCT_BRAIN}

YOUR JOB: Write a BD brief that helps a sales person decide in 30–60 seconds whether this lead is worth pursuing, what problem we solve for them, and what to say on the first call.

WRITING RULES — follow these exactly:
1. Plain English only. Write as if explaining to a smart businessperson who is not technical.
2. Every sentence must pass the "So what?" test. If it doesn't help decide whether to pursue, cut it.
3. No marketing language. No feature lists. No long paragraphs. No repeating product features.
4. For the real-life use case, use the "Sender A → Receiver B" storytelling format.
   BAD: "Kima enables cross-chain interoperability and atomic settlement."
   GOOD: "An AI trading agent earns USDC on Solana and needs to pay a supplier who only accepts USDT on BNB Chain. Without Kima, this requires 3 separate bridges, manual steps, and counterparty risk. With Kima, the agent calls one API — the payment settles end-to-end in under 60 seconds."
5. Pain points must be OPERATIONAL problems this specific company faces — not generic industry challenges.
6. Discovery questions must be ones you would ACTUALLY ask on a first call — not generic filler.
7. BE SPECIFIC. Name their actual workflows, their stack, their customers. Generic = useless.

Return ONLY valid JSON. No markdown, no text outside the JSON.`

export async function generateBDBrief(lead: Record<string, unknown>): Promise<BDBrief> {
  const cats = Array.isArray(lead.customer_category)
    ? (lead.customer_category as string[]).join(', ')
    : String(lead.customer_category || 'N/A')

  const user = `Generate a BD brief for this lead. Use all the enriched data below — it contains research findings, pain analysis, and product fit analysis already done by the agent.

COMPANY: ${lead.company_name}
WEBSITE: ${lead.website || 'N/A'}
INDUSTRY: ${lead.industry_category || 'N/A'}
CUSTOMER CATEGORY: ${cats}
REGION: ${lead.region || 'N/A'}

WHAT THEY DO:
${lead.description || lead.product_summary || 'N/A'}

BUSINESS MODEL: ${lead.business_model || 'N/A'}
CHAINS / RAILS THEY SUPPORT: ${lead.supported_chains_or_rails || 'N/A'}
CURRENT PROVIDERS / STACK: ${lead.current_providers || 'N/A'}

PAIN POINT: ${lead.pain_point || 'N/A'}
PAIN SEVERITY: ${lead.pain_point_severity || 'N/A'}
PAIN EVIDENCE: ${lead.pain_point_evidence || 'N/A'}

KIMA FIT: ${lead.kima_fit || 'N/A'}
AEREDIUM FIT: ${lead.aeredium_fit || 'N/A'}
SETTLEMENT ANGLE: ${lead.settlement_angle || 'N/A'}
SECURITY ANGLE: ${lead.security_angle || 'N/A'}
RISK ANGLE: ${lead.risk_angle || 'N/A'}
PRODUCT TO SELL THEM: ${lead.product_to_sell || 'N/A'}
SUGGESTED USE CASE: ${lead.suggested_use_case || 'N/A'}
INTEGRATION FEASIBILITY: ${lead.integration_feasibility || 'N/A'}

TRIGGER / REASON TO REACH OUT NOW: ${lead.trigger_reason || 'N/A'}
REVENUE POTENTIAL: ${lead.revenue_potential || 'N/A'}
LEAD SCORE: ${lead.lead_score ?? 'N/A'} / 100

Return this exact JSON structure. Every field is required. Keep bullets SHORT — max 20 words each:

{
  "lead_summary": [
    "2–3 short bullet strings. What does this company do, in plain English? What problem are they solving for their customers?"
  ],
  "how_money_moves": "2–3 sentences. Walk through how money, assets, or value actually flows through their product. Be specific about who pays who, in what currency, across which rails.",
  "pain_points": [
    "Top 3 operational problems they face RIGHT NOW. Each as one short punchy sentence. Name the actual pain — not abstract industry challenges."
  ],
  "opportunity": {
    "products": ["List only the products that genuinely apply: 'Kima', 'Aeredium', 'Aergap'. Do not list all three if only one fits."],
    "gap_solved": "One sentence: what specific gap in their current setup does our product fill?",
    "why_they_care": "One sentence: what business outcome do they get — faster settlement, lower cost, compliance, new markets, reduced risk?"
  },
  "real_use_case": {
    "title": "Short action title for this specific scenario (not generic)",
    "story": [
      "3–4 bullet strings. Walk through the exact scenario step by step using Sender A / User A → Receiver B framing.",
      "Each bullet = one step in the story. Who initiates? What happens? Where does it break without us?"
    ],
    "without_us": "One sentence: what actually happens today without our product. Be specific and concrete.",
    "with_us": "One sentence: what happens when they use our product instead. Same specificity.",
    "outcome": "One sentence: the measurable result — time saved, cost reduced, risk eliminated, new capability unlocked."
  },
  "discovery_questions": [
    "3–5 questions you would actually ask on a first call to validate the opportunity. Not generic filler — questions that surface their real pain and budget authority."
  ],
  "bd_verdict": {
    "fit": "Strong Fit | Moderate Fit | Weak Fit",
    "reason": "One sentence explaining why. Reference something specific about this company."
  }
}`

  return claudeJSON({
    model: CLAUDE_RESEARCH,
    system: SYSTEM,
    user,
    maxTokens: 2500,
  }) as Promise<BDBrief>
}
