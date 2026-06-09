// ============================================================
// /api/ai/qualify-lead
//
// URL-first lead qualification. User submits a company website URL;
// this route:
//   1. Infers the company name from the domain.
//   2. Calls gpt-4o-search-preview to pull live web intelligence.
//   3. Passes that intel to Claude (CLAUDE_RESEARCH) for a single,
//      comprehensive JSON analysis covering all BD form fields +
//      a verdict (good_lead | not_a_lead).
//
// Returns:
//   { success: true, data: QualifyResult }
// ============================================================

import { claudeJSON, CLAUDE_RESEARCH } from '@/lib/claude'
import { NextRequest, NextResponse } from 'next/server'
import { PRODUCT_BRAIN } from '@/lib/kima-knowledge'

// ── Infer company name from a URL ─────────────────────────────
function guessCompanyName(url: string): string {
  try {
    const clean = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
    const domain = clean.split('/')[0].split('?')[0]
    // Take first label before the first dot
    const label = domain.split('.')[0]
    if (!label || label.length < 2) return 'Unknown'
    // Capitalise first letter of each word-part (handles kebab-case domains)
    return label
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
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
            content: `Research this company for B2B fintech / Web3 business development:

Company: ${companyName}
Website: ${url}

Find and summarize:
1. What exactly does this company do? (product, tech stack, business model, target customers)
2. What blockchain networks, payment rails, bridges, or settlement infra do they use?
3. What payment / custody / bridge providers are they currently using? (e.g. Fireblocks, LayerZero, Wormhole, SWIFT)
4. Recent news: fundraising rounds, product launches, security hacks/exploits, chain expansions, partnerships?
5. What potential pain points might they have around cross-chain settlement, on/off-ramp, bridge security, or payment rails?
6. Who are the founders and key leadership team?
7. What is their primary geographic market / region?

Be specific and factual. Include URLs to relevant news articles, press releases, or data sources you found.`,
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

  // Step 1 — live web research (runs in parallel with the prompt being built)
  const webResearch = await webResearchCompany(url, companyName)

  // Step 2 — comprehensive Claude analysis in one shot
  const systemPrompt = `You are a senior BD researcher for Kima and Aeredium — financial infrastructure companies.

${PRODUCT_BRAIN}

Your job is to qualify a company as a potential Kima/Aeredium lead. You will be given live web research about the company. Use that research PLUS your own training knowledge to fill out a complete BD qualification form.

Return ONLY valid JSON. No markdown, no prose outside JSON. Separate FACTS from ASSUMPTIONS where relevant.`

  const userPrompt = `Qualify this company as a Kima/Aeredium lead:

Company: ${companyName}
Website: ${url}

LIVE WEB RESEARCH (use this as ground truth when it contradicts your training data):
---
${webResearch || 'No live web research available — use your training knowledge.'}
---

Return a single JSON object with ALL of these fields:

{
  "company_name": "The real company name (may differ from the domain-derived guess)",
  "description": "2-3 sentence summary of what this company does",
  "business_model": "How they make money",
  "product_summary": "What their main product does, in one paragraph",
  "supported_chains_or_rails": "Blockchains, payment rails, or fiat corridors they support (comma-separated)",
  "current_providers": "Known payment, bridge, settlement, or custody providers they use today (e.g. Fireblocks, LayerZero, SWIFT)",

  "industry_category": "Exactly one of: Cross-border payment company | PSP/payment gateway | On/off-ramp provider | Stablecoin payment company | Wallet | DEX | Perp DEX | Launchpad | RWA platform | iGaming/payment-heavy platform | Neobank | Fintech | Exchange | Chain ecosystem | AI commerce/payment agent | Treasury management platform | Custody/payment infrastructure company | Web2 company with payment/settlement friction | Other",
  "customer_category": ["Array of matching categories: Agentic Payments Customer | LayerZero Customer | Hacked Protocol | Needs On/Off Ramp | Fireblocks Customer | Web2 Stablecoin Settlement Customer | Other"],
  "product_to_sell": "Exactly one of: Agentic payment rails | Cross-chain settlement | Stablecoin settlement | Fiat on/off-ramp | Treasury movement | DvP settlement | iGaming payments | RWA settlement | PSP settlement | Wallet onboarding | Launchpad participation | Payment orchestration | Cross-border USDT/USDC settlement",
  "region": "Their primary market region — one of: Global | North America | Europe | Asia | Middle East | Africa | Southeast Asia | South Asia | Latin America | MENA | EU-India corridor | UAE-India corridor | US-India corridor",

  "pain_point": "The single most important pain point Kima/Aeredium can solve for this specific company",
  "pain_point_severity": "critical | high | medium | low",
  "pain_point_evidence": "Specific evidence. If from a real article/news/hack report, quote it. If reasoned from their tech stack, explain the reasoning.",
  "pain_point_source_url": "Exact URL to an article/news/tweet/hack report that proves this pain — empty string if none found, NEVER invent URLs",

  "trigger_reason": "Why is NOW a good time to reach out? (recent funding, hack, chain expansion, product launch, regulatory change, etc.)",
  "trigger_source_url": "URL to the trigger event article/press release — empty string if not found",

  "kima_fit": "Exactly how Kima can help this company — be specific about the use case and integration angle",
  "aeredium_fit": "How Aeredium's TEE/trust layer strengthens the pitch for this company",
  "suggested_use_case": "The single best Kima use case to pitch to them",

  "lead_score": 0-100 integer,
  "confidence_score": 0-100 integer (how confident are you in this analysis),
  "priority": "excellent | qualified | needs_research | low_priority",

  "verdict": "good_lead | not_a_lead",
  "verdict_reasoning": "3-5 sentences explaining why this is or isn't a good lead for Kima/Aeredium",
  "verdict_flags": ["Array of concerns or red flags — empty array if none"],
  "verdict_strengths": ["Array of positive signals — things that make this a strong lead"],

  "source_url": "The single most useful URL found during research (news article, funding post, etc.)",
  "source_summary": "One sentence describing what that source reveals"
}

SCORING GUIDANCE:
- Score 85-100 (excellent): perfect ICP fit, clear pain, verified trigger, easy integration
- Score 70-84 (qualified): good fit, real pain, some trigger signals
- Score 50-69 (needs_research): possible fit but unclear pain or missing key info
- Score 0-49 (low_priority): poor fit, speculative pain, or not really a Kima customer

VERDICT GUIDANCE:
- good_lead: score ≥ 55 AND there is at least one concrete, specific pain Kima/Aeredium can solve
- not_a_lead: score < 55 OR the company clearly doesn't need cross-chain settlement / payment rails`

  try {
    const result = await claudeJSON({
      model: CLAUDE_RESEARCH,
      system: systemPrompt,
      user: userPrompt,
      maxTokens: 3000,
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
