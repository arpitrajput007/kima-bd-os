// ============================================================
// /api/ai/qualify-lead
//
// URL-first lead qualification. User submits a company website URL;
// this route:
//   1. Infers the company name from the domain.
//   2. Calls gpt-4o-search-preview to pull live web intelligence.
//   3. Passes that intel to Claude (CLAUDE_RESEARCH) for a single,
//      comprehensive JSON analysis that fills EVERY Lead field in
//      the database — including the "gap" fields that the manual form
//      never populated: risk_angle, settlement_angle, security_angle,
//      revenue_potential, integration_feasibility, competitor context,
//      social links, facts[], assumptions[], evidence_type, etc.
//
// Returns:
//   { success: true, data: QualifyResult, web_research_used: boolean }
// ============================================================

import { claudeJSON, CLAUDE_RESEARCH } from '@/lib/claude'
import { NextRequest, NextResponse } from 'next/server'
import { PRODUCT_BRAIN, AERPOLICE_KNOWLEDGE, PRODUCTS_CATALOG } from '@/lib/kima-knowledge'
import { scoringMemory } from '@/lib/agent-memory'

// ── Infer company name from a URL ─────────────────────────────
function guessCompanyName(url: string): string {
  try {
    const clean = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
    const domain = clean.split('/')[0].split('?')[0]
    const label  = domain.split('.')[0]
    if (!label || label.length < 2) return 'Unknown'
    return label.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  } catch {
    return 'Unknown Company'
  }
}

// ── Live web research via gpt-4o-search-preview ───────────────
async function webResearchCompany(url: string, companyName: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) return ''
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-search-preview',
        web_search_options: {},
        messages: [
          {
            role: 'user',
            content: `Research this company thoroughly for B2B fintech / Web3 BD qualification:

Company: ${companyName}
Website: ${url}

Find and summarize:
1. What exactly does this company do? (product, tech stack, business model, target customers)
2. What blockchain networks, payment rails, bridges, or settlement infra do they use?
3. What payment / custody / bridge / settlement providers are they currently using?
   (e.g. Fireblocks, LayerZero, Wormhole, SWIFT, Circle, Stripe, Transak)
4. Recent news: fundraising, product launches, security hacks/exploits, chain expansions, partnerships?
5. What pain points might they have around cross-chain settlement, on/off-ramp, bridge security, payment rails?
6. Who are the founders and key leadership team?
7. What is their primary geographic market / region?
8. Do they have a Twitter/X account? Telegram? Discord?
9. Are they experiencing any growth friction or scaling challenges?
10. Any compliance, regulatory, or security pressures they face?

Be specific and factual. Include URLs to relevant news, press releases, or data sources.`,
          },
        ],
        max_tokens: 2000,
      }),
      signal: AbortSignal.timeout(35_000),
    })
    if (!res.ok) return ''
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  } catch {
    return ''
  }
}

// ── Main handler ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { url } = await req.json()
  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  const companyName = guessCompanyName(url)

  // Live web research + memory in parallel
  const [webResearch, memory] = await Promise.all([
    webResearchCompany(url, companyName),
    scoringMemory(),
  ])

  const systemPrompt = `You are a senior BD researcher for Kima, Aeredium, and Aerpolice — three complementary financial and AI infrastructure products.

${PRODUCT_BRAIN}

--- AERPOLICE ---
${AERPOLICE_KNOWLEDGE}

--- FULL PRODUCT CATALOG ---
${PRODUCTS_CATALOG}

Your job is to:
1. Qualify a company as a potential lead for ANY or ALL of our three products (Kima, Aeredium, Aerpolice)
2. Fill EVERY field in the BD database — including risk_angle, settlement_angle, security_angle, revenue_potential, integration_feasibility, competitive positioning, social links, verified facts vs assumptions
3. Evaluate every product in the catalog against this company and produce a product_matches array

Apply the agent rules below when scoring and classifying leads. prioritize/reject rules override the base score. score_boost/score_penalty rules adjust the final score.
${memory}

Return ONLY valid JSON. No markdown, no prose outside JSON.`

  const userPrompt = `Qualify this company as a Kima/Aeredium lead and fill EVERY field below:

Company: ${companyName}
Website: ${url}

LIVE WEB RESEARCH (treat as ground truth over training data):
---
${webResearch || 'No live web research available — use training knowledge.'}
---

Return a single JSON object with ALL of these fields:

{
  // ── Core identity ──────────────────────────────────────────
  "company_name": "The real company name (correct the domain-derived guess if needed)",
  "description": "2-3 sentence summary of what this company does",
  "business_model": "How they make money — be specific (B2B SaaS, transaction fees, AUM, etc.)",
  "product_summary": "What their main product does in 2-3 sentences",
  "supported_chains_or_rails": "Blockchains, fiat corridors, or payment rails they support (comma-separated)",
  "current_providers": "Payment, bridge, custody, settlement providers they use today",

  // ── Competitive intelligence ───────────────────────────────
  "competitor_or_current_provider": "The single most relevant competitor or incumbent provider they use that Kima/Aeredium displaces (e.g. LayerZero, Fireblocks, Wormhole, Stripe, SWIFT, Circle)",
  "competitor_context": "Why they chose that provider and what limitations that choice creates for them — this is the wedge for Kima's pitch",

  // ── Classification ─────────────────────────────────────────
  "industry_category": "Exactly one of: Cross-border payment company | PSP/payment gateway | On/off-ramp provider | Stablecoin payment company | Wallet | DEX | Perp DEX | Launchpad | RWA platform | iGaming/payment-heavy platform | Neobank | Fintech | Exchange | Chain ecosystem | AI commerce/payment agent | Treasury management platform | Custody/payment infrastructure company | Web2 company with payment/settlement friction | Other",
  "customer_category": ["Array — pick all that apply: Agentic Payments Customer | LayerZero Customer | Hacked Protocol | Needs On/Off Ramp | Fireblocks Customer | Web2 Stablecoin Settlement Customer | Other"],
  "product_to_sell": "Exactly one of: Agentic payment rails | Cross-chain settlement | Stablecoin settlement | Fiat on/off-ramp | Treasury movement | DvP settlement | iGaming payments | RWA settlement | PSP settlement | Wallet onboarding | Launchpad participation | Payment orchestration | Cross-border USDT/USDC settlement",
  "region": "Primary market — one of: Global | North America | Europe | Asia | Middle East | Africa | Southeast Asia | South Asia | Latin America | MENA | EU-India corridor | UAE-India corridor | US-India corridor",

  // ── Pain point ─────────────────────────────────────────────
  "pain_point": "The single most important pain point Kima/Aeredium can solve for this specific company",
  "pain_point_severity": "critical | high | medium | low",
  "pain_point_evidence": "Specific evidence — quote a real article/hack report if found, or explain the reasoning from their tech stack",
  "pain_point_source_url": "Exact URL proving this pain — empty string if none, NEVER invent a URL",
  "pain_point_evidence_type": "verified_source (real article explicitly mentions this pain) | agent_analysis (reasoned from public facts) | inferred (general industry knowledge)",

  // ── Trigger ────────────────────────────────────────────────
  "trigger_reason": "Why reach out NOW — recent funding, hack, expansion, product launch, regulatory change, etc.",
  "trigger_source_url": "URL to the trigger event — empty string if not found",

  // ── Kima / Aeredium fit ────────────────────────────────────
  "kima_fit": "Exactly how Kima helps this company — specific use case and integration angle",
  "suggested_use_case": "The single best Kima use case to pitch",
  "settlement_angle": "How Kima's atomic cross-chain settlement specifically improves their current setup",
  "aeredium_fit": "How Aeredium's TEE/trust layer strengthens the pitch for this company",
  "security_angle": "The specific TEE / MPC / compliance / execution-integrity angle for Aeredium",
  "risk_angle": "What specific risks (bridge exploits, custody failure, settlement failure) Aeredium mitigates for them",

  // ── Commercial ─────────────────────────────────────────────
  "revenue_potential": "Estimated revenue/business impact for them if they integrate Kima (be specific — transaction volume, cost savings, new markets)",
  "integration_feasibility": "high | medium | low — and one sentence explaining why",

  // ── Social links (research from web) ──────────────────────
  "twitter_url": "Full https://x.com/... or https://twitter.com/... URL if found — empty string if not",
  "telegram_url": "Full https://t.me/... URL if found — empty string if not",
  "discord_url": "Full https://discord.gg/... or discord.com/invite/... URL if found — empty string if not",

  // ── Verified facts vs assumptions ──────────────────────────
  "facts": [
    {"label": "short label", "value": "verified fact from web research or public source"}
  ],
  "assumptions": [
    {"label": "short label", "value": "inferred/assumed — not directly verified"}
  ],

  // ── Scoring ────────────────────────────────────────────────
  "lead_score": 0-100,
  "confidence_score": 0-100,
  "priority": "excellent | qualified | needs_research | low_priority",

  // ── Verdict ────────────────────────────────────────────────
  "verdict": "good_lead | not_a_lead",
  "verdict_reasoning": "3-5 sentences on why this is or isn't a good Kima/Aeredium lead",
  "verdict_flags": ["concerns or red flags — empty array if none"],
  "verdict_strengths": ["positive signals — things that make this a strong lead"],

  // ── Source ─────────────────────────────────────────────────
  "source_url": "The single most useful URL found (news article, funding post, etc.)",
  "source_summary": "One sentence describing what that source reveals",

  // ── Product & use-case match matrix ────────────────────────
  // Evaluate EVERY product in the catalog. Return exactly 9 entries — one per product.
  // match values: "strong" | "partial" | "none"
  // why: 1-2 specific sentences explaining the match or mismatch for THIS company
  // use_case: concrete use case sentence if match is strong or partial, else ""
  "product_matches": [
    {
      "product": "Kima UPR",
      "company": "Kima",
      "match": "strong | partial | none",
      "why": "specific reason for this company",
      "use_case": "e.g. Enable cross-chain USDC deposits across 5 chains via one API integration"
    },
    {
      "product": "Kima LaaS",
      "company": "Kima",
      "match": "strong | partial | none",
      "why": "...",
      "use_case": ""
    },
    {
      "product": "Kima DvP",
      "company": "Kima",
      "match": "strong | partial | none",
      "why": "...",
      "use_case": ""
    },
    {
      "product": "Aeredium Institutional L1",
      "company": "Aeredium",
      "match": "strong | partial | none",
      "why": "...",
      "use_case": ""
    },
    {
      "product": "Aeredium AERLink",
      "company": "Aeredium",
      "match": "strong | partial | none",
      "why": "...",
      "use_case": ""
    },
    {
      "product": "Aeredium AERKey",
      "company": "Aeredium",
      "match": "strong | partial | none",
      "why": "...",
      "use_case": ""
    },
    {
      "product": "Aerpolice Agent Identity",
      "company": "Aerpolice",
      "match": "strong | partial | none",
      "why": "...",
      "use_case": ""
    },
    {
      "product": "Aerpolice Execution Gate",
      "company": "Aerpolice",
      "match": "strong | partial | none",
      "why": "...",
      "use_case": ""
    },
    {
      "product": "Aerpolice Audit Trail",
      "company": "Aerpolice",
      "match": "strong | partial | none",
      "why": "...",
      "use_case": ""
    }
  ]
}

SCORING:
- 85-100 (excellent): perfect ICP fit, clear pain, verified trigger, easy integration
- 70-84 (qualified): good fit, real pain, some trigger signals
- 50-69 (needs_research): possible fit but missing key info
- 0-49 (low_priority): poor fit, speculative pain, not really a Kima customer

VERDICT:
- good_lead: score ≥ 55 AND at least one concrete pain Kima/Aeredium can solve
- not_a_lead: score < 55 OR company clearly doesn't need our infrastructure`

  try {
    const result = await claudeJSON({
      model: CLAUDE_RESEARCH,
      system: systemPrompt,
      user: userPrompt,
      maxTokens: 5500,
    })

    return NextResponse.json({
      success: true,
      data: result,
      web_research_used: webResearch.length > 0,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI qualification failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
